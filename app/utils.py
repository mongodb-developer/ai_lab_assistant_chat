import openai
from pymongo import MongoClient, ASCENDING
from pymongo.operations import IndexModel
from config import Config
import json
import logging
from datetime import datetime
from bson import ObjectId, json_util
from flask_login import login_required, current_user
import traceback
import requests
from typing import Any, Dict, List, Tuple, Union
import re
from collections import Counter
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk
nltk.data.path.append('/tmp/nltk_data')


# Download necessary NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('averaged_perceptron_tagger')
nltk.download('maxent_ne_chunker')
nltk.download('words')


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
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

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
        conversation_id = get_or_create_conversation(user_id)
    
    message_entry = {
        'role': sender,
        'content': message,
        'timestamp': datetime.utcnow()
    }
    
    update_data = {
        '$push': {'messages': message_entry},
        '$set': {'last_updated': datetime.utcnow()},
        '$inc': {'context.last_n_messages': 1}
    }
    
    if sender == 'User':
        # Assuming current_user.name is available
        update_data['$set']['user_name'] = current_user.name
    
    conversation_collection.update_one(
        {'_id': ObjectId(conversation_id)},
        update_data
    )
    
    update_conversation_context(conversation_id)
    
    return conversation_id

def get_or_create_conversation(user_id):
    active_conversation = conversation_collection.find_one(
        {'user_id': user_id, 'status': 'active'},
        sort=[('last_updated', -1)]
    )
    
    if active_conversation:
        return str(active_conversation['_id'])
    
    new_conversation = {
        'user_id': user_id,
        'title': 'New Conversation',
        'status': 'active',
        'messages': [],
        'context_summary': '',
        'context': {
            'topics': [],
            'entities': [],
            'last_n_messages': 0
        },
        'metadata': {
            'source': 'chat',
            'tags': [],
            'custom_fields': {}
        },
        'created_at': datetime.utcnow(),
        'last_updated': datetime.utcnow()
    }
    
    result = conversation_collection.insert_one(new_conversation)
    return str(result.inserted_id)

import re
from collections import Counter
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk

# Download necessary NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('averaged_perceptron_tagger')
nltk.download('maxent_ne_chunker')
nltk.download('words')

def extract_topics(text, top_n=5):
    # Tokenize the text
    tokens = word_tokenize(text.lower())
    
    # Remove stopwords and non-alphabetic tokens
    stop_words = set(stopwords.words('english'))
    tokens = [token for token in tokens if token.isalpha() and token not in stop_words]
    
    # Count the frequency of each token
    word_freq = Counter(tokens)
    
    # Get the top N most common words as topics
    topics = [word for word, _ in word_freq.most_common(top_n)]
    
    return topics

def extract_entities(text):
    # Tokenize and tag the text
    tokens = word_tokenize(text)
    tagged = nltk.pos_tag(tokens)
    
    # Use NLTK's named entity recognition
    entities = nltk.chunk.ne_chunk(tagged)
    
    # Extract named entities
    named_entities = []
    for subtree in entities:
        if isinstance(subtree, nltk.Tree):
            entity_type = subtree.label()
            entity_value = ' '.join([leaf[0] for leaf in subtree.leaves()])
            named_entities.append((entity_type, entity_value))
    
    return named_entities

def generate_context_summary(context_text, max_length=200):
    # This is a very basic summary generation.
    # For better results, consider using an AI model or a more sophisticated summarization algorithm.
    sentences = re.split(r'(?<=[.!?])\s+', context_text)
    summary = ' '.join(sentences[:3])  # Take first 3 sentences
    if len(summary) > max_length:
        summary = summary[:max_length] + '...'
    return summary

# Update the update_conversation_context function
def update_conversation_context(conversation_id):
    conversation = conversation_collection.find_one({'_id': ObjectId(conversation_id)})
    
    if not conversation:
        return
    
    last_n_messages = conversation['messages'][-5:]  # Consider last 5 messages
    context_text = " ".join([msg['content'] for msg in last_n_messages])
    
    context_summary = generate_context_summary(context_text)
    topics = extract_topics(context_text)
    entities = extract_entities(context_text)
    
    conversation_embedding = generate_embedding(context_text)
    
    conversation_collection.update_one(
        {'_id': ObjectId(conversation_id)},
        {
            '$set': {
                'context_summary': context_summary,
                'context.topics': topics,
                'context.entities': entities,
                'embedding': conversation_embedding
            }
        }
    )

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

def get_conversation_context(conversation_id):
    conversation = conversation_collection.find_one({'_id': ObjectId(conversation_id)})
    if not conversation:
        return "", ""
    
    context_summary = conversation.get('context_summary', '')
    topics = conversation.get('context', {}).get('topics', [])
    entities = conversation.get('context', {}).get('entities', [])
    
    context = f"Summary: {context_summary}\n"
    context += f"Topics: {', '.join(topics)}\n"
    context += f"Entities: {', '.join([f'{e[1]}' for e in entities])}\n"
    
    # Get the last few messages for immediate context
    last_messages = conversation.get('messages', [])[-5:]  # Get last 5 messages
    context += "Recent messages:\n"
    last_assistant_message = ""
    for msg in last_messages:
        context += f"{msg['role']}: {msg['content']}\n"
        if msg['role'] == 'Assistant':
            last_assistant_message = msg['content']
    
    return context, last_assistant_message

def get_conversation_messages(conversation_id):
    return conversation_collection.find(
        {'conversation_id': conversation_id}
    ).sort('timestamp', 1)

    __all__ = ['get_db_connection', 'generate_embedding', 'add_question_answer', 'add_unanswered_question','search_similar_questions', 'json_serialize']

def generate_potential_answer_v2(question_with_context, last_assistant_message=""):
    print(f"Debug - Question with context: {question_with_context[:100]}...")  # Print first 100 chars
    print(f"Debug - Last assistant message: {last_assistant_message[:100]}...")  # Print first 100 chars
    
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"""
    Previous assistant message: {last_assistant_message}

    New question with context: {question_with_context}

    {context}

    Please provide a detailed answer for the new question, taking into account the previous assistant message and the provided context. Ensure your response is consistent with the ongoing conversation and relates to MongoDB topics.
    """
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides detailed answers about MongoDB, maintaining context throughout the conversation."},
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
    
def setup_database():
    conversation_collection.create_indexes([
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("last_updated", ASCENDING)]),
        IndexModel([("embedding", ASCENDING)], sparse=True)
    ])
setup_database()

def extract_topics(text, top_n=5):
    # Tokenize the text
    tokens = word_tokenize(text.lower())
    
    # Remove stopwords and non-alphabetic tokens
    stop_words = set(stopwords.words('english'))
    tokens = [token for token in tokens if token.isalpha() and token not in stop_words]
    
    # Count the frequency of each token
    word_freq = Counter(tokens)
    
    # Get the top N most common words as topics
    topics = [word for word, _ in word_freq.most_common(top_n)]
    
    return topics

def extract_entities(text):
    # Tokenize and tag the text
    tokens = word_tokenize(text)
    tagged = nltk.pos_tag(tokens)
    
    # Use NLTK's named entity recognition
    entities = nltk.chunk.ne_chunk(tagged)
    
    # Extract named entities
    named_entities = []
    for subtree in entities:
        if isinstance(subtree, nltk.Tree):
            entity_type = subtree.label()
            entity_value = ' '.join([leaf[0] for leaf in subtree.leaves()])
            named_entities.append((entity_type, entity_value))
    
    return named_entities

def generate_context_summary(context_text, max_length=200):
    # This is a very basic summary generation.
    # For better results, consider using an AI model or a more sophisticated summarization algorithm.
    sentences = re.split(r'(?<=[.!?])\s+', context_text)
    summary = ' '.join(sentences[:3])  # Take first 3 sentences
    if len(summary) > max_length:
        summary = summary[:max_length] + '...'
    return summary