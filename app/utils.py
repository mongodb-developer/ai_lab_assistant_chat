import openai
from pymongo import MongoClient
from config import Config
import json
import logging
from datetime import datetime
from bson import ObjectId, json_util

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
collection = db[Config.MONGODB_COLLECTION]
conversation_collection = db['conversations']  # New collection for conversations

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
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    return db

openai.api_key = Config.OPENAI_API_KEY

def generate_embedding(text):
    debug_info = {}
    try:
        logger.debug(f"Generating embedding for text: {text[:50]}...")
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
    debug_info = {}
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
                'limit': 1
            }
        }
        results = collection.aggregate([
            {
                '$vectorSearch': {
                    'index': 'question_index',
                    'path': 'question_embedding',
                    'queryVector': question_embedding,
                    'numCandidates': 10,
                    'limit': 1
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'question': 1,
                    'answer': 1,
                    'score': {
                        '$meta': 'vectorSearchScore'
                    }
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
    
import json
from bson import json_util
from datetime import datetime

# ... (keep the existing imports and configurations)

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
        'timestamp': datetime.utcnow()
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

    __all__ = ['get_db_connection', 'generate_embedding', 'add_question_answer', 'search_similar_questions', 'json_serialize']

