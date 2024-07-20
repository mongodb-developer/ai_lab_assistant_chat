import openai
from pymongo import MongoClient
from config import Config
import json
import logging
from datetime import datetime
from bson import ObjectId, json_util
import traceback
import requests
from typing import Any, Dict, List, Tuple, Union


# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
collection = db[Config.MONGODB_COLLECTION]
conversation_collection = db['conversations']  # New collection for conversations
unanswered_collection = db['unanswered_questions']

SIMILARITY_THRESHOLD = 0.91  # Adjust this value as needed

# Attempt to connect to MongoDB
try:
    client = MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.server_info()  # Will raise an exception if unable to connect
    db = client[Config.MONGODB_DB]
    collection = db[Config.MONGODB_COLLECTION]
    logger.info(f"Successfully connected to MongoDB. Database: {Config.MONGODB_DB}, Collection: {Config.MONGODB_COLLECTION}")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    client = None
    db = None
    collection = None

client = None
db = None

def get_db_connection():
    global client, db
    if client is None:
        try:
            client = MongoClient(Config.MONGODB_URI)
            db = client[Config.MONGODB_DB]
            logger.info(f"Successfully connected to MongoDB. Database: {Config.MONGODB_DB}")
            return db
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    return db

openai.api_key = Config.OPENAI_API_KEY

def generate_embedding(text):
    debug_info = {}
    if isinstance(text, dict):
        text = str(text)
    elif isinstance(text, list):
        text = ' '.join(map(str, text))
    elif not isinstance(text, str):
        text = str(text)
    
    logger.debug(f"Generating embedding for text: {text[:50]}...")

    try:
        logger.debug(f"Generating embedding for text: {text if isinstance(text, str) else str(text)[:50]}...")
        debug_info['openai_request'] = {
            'model': "text-embedding-ada-002",
            'input': text
        }
        response = openai.Embedding.create(model="text-embedding-ada-002", input=text)
        debug_info['openai_response'] = json.loads(json.dumps(response, default=str))
        embedding = response['data'][0]['embedding']
        debug_info['embedding_length'] = len(embedding)
        logger.debug(f"Embedding generated successfully. Length: {len(embedding)}")
        return embedding, debug_info
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        raise

def add_question_answer(question, answer):
    debug_info = {}
    try:
        if collection is None:
            raise Exception("MongoDB connection not established")

        logger.info(f"Adding question and answer to database. Question: {question[:50]}...")
        question_embedding, q_debug = generate_embedding(question)
        answer_embedding, a_debug = generate_embedding(answer)

        # Generate a title for the conversation
        title = generate_title(question)
        
        document = {
            'question': question,
            'answer': answer,
            'question_embedding': question_embedding,
            'answer_embedding': answer_embedding,
            'title': title  # Add the title to the document
        }
        
        debug_info['question_embedding'] = q_debug
        debug_info['answer_embedding'] = a_debug
        
        logger.debug(f"Inserting document into MongoDB: {json.dumps(document, default=str)[:200]}...")
        result = collection.insert_one(document)
        inserted_id = result.inserted_id
        debug_info['inserted_id'] = str(inserted_id)
        logger.info(f"Document inserted successfully. ID: {inserted_id}")
        
        # Verify insertion
        verification = collection.find_one({'_id': inserted_id})
        if verification:
            logger.info("Document verified in database.")
            debug_info['verification'] = 'successful'
        else:
            logger.warning("Unable to verify document in database.")
            debug_info['verification'] = 'failed'
        
        return inserted_id, debug_info
    except Exception as e:
        logger.error(f"Error adding question and answer: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        raise

def generate_title(question):
    # Use the first few words of the question as the title
    max_words = 5
    title = ' '.join(question.split()[:max_words])
    return title if len(title) < 30 else title[:27] + '...'


def search_similar_questions(question_embedding):
    debug_info = {'function': 'search_similar_questions'}
    try:
        if collection is None:
            raise Exception("MongoDB connection not established")
        
        logger.info("Searching for similar questions...")
        debug_info['mongodb_query'] = {
            'vectorSearch': {
                'index': 'question_index',
                'path': 'question_embedding',
                'queryVector': f"[{question_embedding[:5]}...{question_embedding[-5:]}]",  # Truncated for brevity
                'numCandidates': 10,
                'limit': 10
            }
        }
        
        results = collection.aggregate([
            {
                '$vectorSearch': {
                    'index': 'question_index',
                    'path': 'question_embedding',
                    'queryVector': question_embedding,
                    'numCandidates': 10,
                    'limit': 10
                }
            },
            {
                '$project': {
                    '_id': 1,
                    'question': 1,
                    'answer': 1,
                    'summary': 1,
                    'title': 1,
                    'references': 1,
                    'score': {
                        '$meta': 'vectorSearchScore'
                    }
                }
            },
            {
                '$match': {
                    'score': {'$gte': SIMILARITY_THRESHOLD}
                }
            }
        ])
        
        results_list = list(results)
        debug_info['mongodb_results'] = json.loads(json.dumps(results_list, default=str))
        debug_info['results_count'] = len(results_list)
        logger.info(f"Search complete. Found {len(results_list)} results.")
        
        return results_list, debug_info
    except Exception as e:
        logger.error(f"Error searching similar questions: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        raise

def add_unanswered_question(user_id, user_name, question, potential):
    debug_info = {'function': 'add_unanswered_questions'}

    try:
        unanswered_collection.insert_one({
            'user_id': user_id,
            'user_name': user_name,
            'question': question,
            'timestamp': datetime.now(),
            'answered': False,
            'answer': potential.get('potential_answer'),
            'title': potential.get('title'),
            'summary': potential.get('summary'),
            'references': potential.get('references'),
        })
        logger.info(f"Unanswered question added for user {user_name} (ID: {user_id})")
        debug_info['unanswered_question'] = {
            'user_id': user_id,
            'user_name': user_name,
            'question': question,
            'timestamp': datetime.now(),
            'answered': False,
            'potential_answer': potential,
        }
    except Exception as e:
        logger.error(f"Error adding unanswered question: {str(e)}")
        raise

def check_database_connection():
    try:
        if client is None:
            return False
        client.admin.command('ping')
        logger.info("Database connection successful.")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return False

def get_collection_stats():
    try:
        if db is None or collection is None:
            raise Exception("MongoDB connection not established")
        logger.info("Getting collection stats...")
        stats = db.command("collstats", Config.MONGODB_COLLECTION)
        logger.info(f"Collection stats: {json.dumps(stats, default=str)}")
        return stats
    except Exception as e:
        logger.error(f"Error getting collection stats: {str(e)}")
        return None

def json_serialize(obj):
    """
    JSON serializer for objects not serializable by default json code
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    return json_util.default(obj)

def get_collection_stats():
    try:
        if db is None or collection is None:
            raise Exception("MongoDB connection not established")
        logger.info("Getting collection stats...")
        stats = db.command("collstats", Config.MONGODB_COLLECTION)
        # Convert stats to a JSON-serializable format
        serializable_stats = json.loads(json_util.dumps(stats))
        logger.info(f"Collection stats: {json.dumps(serializable_stats, default=json_serialize)}")
        return serializable_stats
    except Exception as e:
        logger.error(f"Error getting collection stats: {str(e)}")
        return None
    
def store_message(user_id, message, sender, conversation_id=None):
    if not conversation_id:
        conversation_id = get_current_conversation(user_id)
    
    # If there's an active conversation, end it before starting a new one
    if sender == 'User' and not conversation_id:
        conversation_id = start_new_conversation(user_id, generate_title(message))
    
    message_entry = {
        'conversation_id': conversation_id,
        'sender': sender,
        'message': message,
        'timestamp': datetime.now()
    }
    conversation_collection.insert_one(message_entry)


def get_current_conversation(user_id):
    conversation = conversation_collection.find_one(
        {'user_id': user_id, 'active': True},
        sort=[('timestamp', -1)]
    )
    return conversation['_id'] if conversation else None

def start_new_conversation(user_id, title):
    conversation_entry = {
        'user_id': user_id,
        'title': title,
        'active': True,
        'timestamp': datetime.utcnow()
    }
    result = conversation_collection.insert_one(conversation_entry)
    return result.inserted_id

def end_conversation(conversation_id):
    conversation_collection.update_one(
        {'_id': conversation_id},
        {'$set': {'active': False}}
    )

def get_user_conversations(user_id):
    conversations = conversation_collection.find(
        {'user_id': user_id}
    ).sort('timestamp', -1)
    
    formatted_conversations = []
    for conv in conversations:
        formatted_conversations.append({
            'id': str(conv['_id']),
            'title': conv.get('title', 'Conversation'),
            'timestamp': conv['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
        })
    return formatted_conversations

def get_conversation_messages(conversation_id):
    return conversation_collection.find(
        {'conversation_id': conversation_id}
    ).sort('timestamp', 1)

    __all__ = ['get_db_connection', 'generate_embedding', 'add_question_answer', 'add_unanswered_question','search_similar_questions', 'json_serialize']

def generate_potential_answer(question):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a detailed answer for the following question:\n\n{question}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides detailed answers."},
            {"role": "user", "content": prompt}
        ]
    )
    answer = response['choices'][0]['message']['content'].strip()

    # Generate title, summary, and references
    title = generate_title(answer)
    summary = generate_summary(answer)
    references = generate_references(answer)

    return {
        'title': title,
        'summary': summary,
        'answer': answer,
        'references': references
    }

def generate_title(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a concise and descriptive title for the following answer:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides concise and descriptive titles."},
            {"role": "user", "content": prompt}
        ]
    )
    title = response['choices'][0]['message']['content'].strip()
    return title

def generate_summary(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease summarize the following text:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides summaries."},
            {"role": "user", "content": prompt}
        ]
    )
    summary = response['choices'][0]['message']['content'].strip()
    return summary

def generate_references(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a relevant reference for the following text from the MongoDB documentation:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides relevant references."},
            {"role": "user", "content": prompt}
        ]
    )
    references = response['choices'][0]['message']['content'].strip()
    if not references:
        references = "No specific references provided. Please refer to the MongoDB Documentation at https://www.mongodb.com/docs/"
    return references

def fetch_changelog(repo_owner, repo_name, access_token=None):
    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/CHANGELOG.md"
    headers = {"Accept": "application/vnd.github.v3.raw"}
    
    if access_token:
        headers["Authorization"] = f"token {access_token}"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Failed to fetch changelog: {response.status_code} {response.text}")