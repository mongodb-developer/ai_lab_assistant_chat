import openai
from pymongo import MongoClient, ASCENDING
from pymongo.operations import IndexModel
from pymongo.collection import Collection
from pymongo.database import Database
from typing import Optional
from config import Config
import json
import logging
from datetime import datetime, timezone, timedelta
from bson import ObjectId, json_util
from flask_login import login_required, current_user
from flask import request, current_app
import PyPDF2

import traceback
import requests
from typing import Any, Dict, List, Tuple, Union
import re
from collections import Counter

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk
from functools import wraps

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
SIMILARITY_THRESHOLD = 0.91  # or whatever value you want to use


def get_db_connection() -> Optional[Database]:
    if 'mongo_client' not in current_app.config:
        try:
            current_app.logger.info(f"Attempting to connect to MongoDB with URI: {current_app.config['MONGODB_URI']}")
            current_app.config['mongo_client'] = MongoClient(current_app.config['MONGODB_URI'])
            current_app.logger.info("Successfully connected to MongoDB")
        except Exception as e:
            current_app.logger.error(f"Failed to connect to MongoDB: {str(e)}")
            return None

    try:
        db = current_app.config['mongo_client'].get_database(current_app.config['MONGODB_DB'])
        current_app.logger.info(f"Successfully got database: {current_app.config['MONGODB_DB']}")
        return db
    except Exception as e:
        current_app.logger.error(f"Failed to get database: {str(e)}")
        return None

def get_collection(collection_name: str) -> Optional[Collection]:
    try:
        db = get_db_connection()
        if db is None:
            current_app.logger.error(f"Failed to get database connection for collection: {collection_name}")
            return None
        collection = db[collection_name]
        current_app.logger.info(f"Successfully got collection: {collection_name}")
        return collection
    except Exception as e:
        current_app.logger.error(f"Error getting collection {collection_name}: {str(e)}")
        return None

def with_db_connection(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        db = get_db_connection()
        return f(db, *args, **kwargs)
    return decorated_function

def init_db(app):
    with app.app_context():
        db = get_db_connection()
        # Perform any initial setup if needed
        # For example, creating indexes
    if db is not None:
        app.config['db'] = db
    else:
        raise Exception("Failed to initialize the database.")            # Your index creation code here
    pass

SIMILARITY_THRESHOLD = 0.91  # Governs matching of similar questions from database collection `documents`

# Attempt to connect to MongoDB
try:
    client = MongoClient(Config.MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.server_info()  # Will raise an exception if unable to connect
    
    logger.info(f"Successfully connected to MongoDB. Database: {Config.MONGODB_DB}, Collection: {Config.MONGODB_COLLECTION}")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    client = None
    db = None
    collection = None

client = None
db = None

openai.api_key = Config.OPENAI_API_KEY

@with_db_connection
def update_user_login_info(db, user_id):
    users_collection = db['users']

    current_app.logger.info(f"Updating login info for user ID: {user_id}")

    # Get user's IP address
    if request.headers.getlist("X-Forwarded-For"):
        ip = request.headers.getlist("X-Forwarded-For")[0]
        current_app.logger.info(f"IP address from X-Forwarded-For: {ip}")
    else:
        ip = request.remote_addr
        current_app.logger.info(f"IP address from remote_addr: {ip}")
    
    update_data = {
        'last_login': datetime.now(timezone.utc),
        'last_ip': ip
    }
    
    current_app.logger.info(f"Initial update data: {update_data}")

    # Use a geolocation API to get location info
    try:
        geolocation_url = f'http://ip-api.com/json/{ip}'
        current_app.logger.info(f"Requesting geolocation data from: {geolocation_url}")
        
        response = requests.get(geolocation_url, timeout=5)  # Add a timeout
        current_app.logger.info(f"Geolocation API response status code: {response.status_code}")
        
        if response.status_code == 200:
            location_data = response.json()
            current_app.logger.info(f"Received location data: {location_data}")
            
            update_data['last_location'] = {
                'country': location_data.get('country'),
                'region': location_data.get('regionName'),
                'city': location_data.get('city'),
                'lat': location_data.get('lat'),
                'lon': location_data.get('lon')
            }
            current_app.logger.info(f"Updated location data: {update_data['last_location']}")
        else:
            current_app.logger.warning(f"Unexpected status code from geolocation API: {response.status_code}")
            current_app.logger.warning(f"Response content: {response.text}")
    except requests.RequestException as e:
        current_app.logger.error(f"RequestException while getting location data: {str(e)}")
    except Exception as e:
        current_app.logger.error(f"Unexpected error while getting location data: {str(e)}")
        current_app.logger.error(f"Error traceback: {traceback.format_exc()}")
    
    current_app.logger.info(f"Final update data: {update_data}")
    
    result = users_collection.update_one({'_id': ObjectId(user_id)}, {'$set': update_data})
    current_app.logger.info(f"Database update result: {result.modified_count} document(s) modified")

    return update_data

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

@with_db_connection
def add_question_answer(db, question, answer, title, summary, references):
    try:
        document = {
            'question': question,
            'answer': answer,
            'title': title,
            'summary': summary,
            'references': references,
            'question_embedding': generate_embedding(question)[0],
            'answer_embedding': generate_embedding(answer)[0],
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'schema_version': 2,
            'created_by': 'ai'
        }
        result = db.documents.insert_one(document)
        return str(result.inserted_id)
    except Exception as e:
        current_app.logger.error(f"Error adding question and answer: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        raise

def generate_title(question):
    # Use the first few words of the question as the title
    max_words = 5
    title = ' '.join(question.split()[:max_words])
    return title if len(title) < 30 else title[:27] + '...'


from bson import ObjectId

#def search_similar_questions(db, question_embedding, query_text, similarity_threshold=0.8):
#def search_similar_questions(db, query, is_embedding=False, similarity_threshold=0.8):
# def search_similar_questions(db, question_embedding, query_text=None, similarity_threshold=0.8):
@with_db_connection
def search_similar_questions(db, question_embedding, user_question, module, similarity_threshold=SIMILARITY_THRESHOLD):
    user_question_lower = user_question.lower()

    # Exact match stage (unchanged)
    exact_match_query = {
        "question": {"$regex": f"^{re.escape(user_question_lower)}$", "$options": "i"}
    }
    exact_matches = list(get_documents_collection().find(exact_match_query))

    if exact_matches:
        for match in exact_matches:
            match['exact_match'] = True
            match['combined_score'] = 1000
        return exact_matches[:5], {
            "exact_match_query": exact_match_query,
            "exact_matches_count": len(exact_matches),
            "search_type": "exact_match"
        }

    # Vector search stage with workshop content boosting
    vector_search_stage = [
        {
            '$vectorSearch': {
                'index': 'question_index',
                'path': 'question_embedding',
                'queryVector': question_embedding,
                'numCandidates': 100,
                'limit': 20  # Increased limit to get more potential matches
            }
        },
        {
            '$project': {
                'question': 1,
                'answer': 1,
                'title': 1,
                'summary': 1,
                'references': 1,
                'module': 1,
                'is_workshop_content': 1,  # New field to indicate workshop content
                'vector_score': {'$meta': 'vectorSearchScore'},
            }
        },
        {
            '$addFields': {
                'boosted_score': {
                    '$cond': [
                        {'$eq': ['$is_workshop_content', True]},
                        {'$multiply': ['$vector_score', 1.5]},  # Boost workshop content
                        '$vector_score'
                    ]
                }
            }
        },
        {'$sort': {'boosted_score': -1}}
    ]

    # Text search stage with workshop content boosting
    text_search_stage = [
        {
            '$search': {
                'index': 'default',
                'compound': {
                    'must': [{
                        'text': {
                            'query': user_question_lower,
                            'path': 'question',
                            'fuzzy': {'maxEdits': 2}
                        }
                    }],
                    'should': [{
                        'text': {
                            'query': user_question_lower,
                            'path': 'workshop_keywords',  # New field for workshop-specific keywords
                            'score': {'boost': {'value': 2}}  # Boost matches in workshop keywords
                        }
                    }]
                }
            }
        },
        {
            '$project': {
                'question': 1,
                'answer': 1,
                'title': 1,
                'summary': 1,
                'references': 1,
                'module': 1,
                'is_workshop_content': 1,
                'text_score': {'$meta': 'searchScore'},
            }
        },
        {
            '$addFields': {
                'boosted_score': {
                    '$cond': [
                        {'$eq': ['$is_workshop_content', True]},
                        {'$multiply': ['$text_score', 1.5]},  # Boost workshop content
                        '$text_score'
                    ]
                }
            }
        },
        {'$sort': {'boosted_score': -1}}
    ]

    # Apply module filter if specified
    if module and module.lower() != "select a module":
        module_filter = {'$match': {'module': module}}
        vector_search_stage.insert(1, module_filter)
        text_search_stage.insert(1, module_filter)

    vector_results = list(get_documents_collection().aggregate(vector_search_stage))
    text_results = list(get_documents_collection().aggregate(text_search_stage))

    # Combine and process results
    all_results = vector_results + text_results
    for result in all_results:
        result['combined_score'] = (result.get('boosted_score', 0) * 2 + 
                                    result.get('vector_score', 0) * 0.7 + 
                                    result.get('text_score', 0) * 0.3)

    # Remove duplicates and sort
    seen_questions = set()
    unique_results = []
    for result in sorted(all_results, key=lambda x: x['combined_score'], reverse=True):
        if result['question'].lower() not in seen_questions:
            seen_questions.add(result['question'].lower())
            unique_results.append(result)

    # Filter results
    filtered_results = [r for r in unique_results if r['combined_score'] >= similarity_threshold]

    debug_info = {
        "vector_results_count": len(vector_results),
        "text_results_count": len(text_results),
        "all_results_count": len(all_results),
        "unique_results_count": len(unique_results),
        "filtered_results_count": len(filtered_results),
        "top_5_scores": [r['combined_score'] for r in filtered_results[:5]],
        "search_type": "vector_and_text_with_boosting",
        "module_filter_applied": bool(module and module.lower() != "select a module")
    }

    return filtered_results[:5], debug_info



@with_db_connection
def add_unanswered_question(db, user_id, user_name, question, potential, module):
    debug_info = {'function': 'add_unanswered_questions'}

    try:
        get_unanswered_collection().insert_one({
            'user_id': user_id,
            'user_name': user_name,
            'question': question,
            'timestamp': datetime.now(),
            'answered': False,
            'module': module,  # Include the module in the unanswered question
            'answer': potential.get('answer'),
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

@with_db_connection
def check_database_connection(db):
    try:
        if client is None:
            return False
        client.admin.command('ping')
        logger.info("Database connection successful.")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        return False
    
@with_db_connection
def get_collection_stats(db):
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

def get_events_collection():
    return get_collection('events')

def get_answer_feedback_collection():
    return get_collection('answer_feedback')

def get_conversation_collection():
    return get_collection('conversations')

def get_feedback_collection():
    return get_collection('feedback')

def get_users_collection() -> Optional[Collection]:
    return get_collection('users')

def get_unanswered_collection():
    return get_collection('unanswered_questions')

def get_documents_collection():
    return get_collection('documents')

def store_message(user_id, message, sender, conversation_id=None):
    current_app.logger.debug(f"Storing message for user {user_id}, sender {sender}, conversation_id {conversation_id}")

    if not conversation_id:
        conversation_id = get_or_create_conversation(user_id)
    
    # Ensure message is a dictionary with 'content' field
    if isinstance(message, dict) and 'content' in message:
        message_entry = {
            'role': sender,
            'content': message['content'],
            'timestamp': datetime.utcnow()
        }
    else:
        message_entry = {
            'role': sender,
            'content': str(message),
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
    
    result = get_conversation_collection().update_one(
        {'_id': ObjectId(conversation_id)},
        update_data
    )
    current_app.logger.debug(f"Update result: matched={result.matched_count}, modified={result.modified_count}")
    
    update_conversation_context(conversation_id)
    
    return conversation_id

def get_active_conversation(user_id):
    conversation_collection = get_conversation_collection()
    return conversation_collection.find_one(
        {'user_id': user_id, 'status': 'active'},
        sort=[('last_updated', -1)]
    )


def close_active_conversations(user_id):
    get_conversation_collection().update_many(
        {'user_id': user_id, 'status': 'active'},
        {'$set': {'status': 'closed', 'closed_at': datetime.now()}}
    )

def create_new_conversation(user_id):
    close_active_conversations(user_id)
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
    result = get_conversation_collection().insert_one(new_conversation)
    return str(result.inserted_id)

def get_or_create_conversation(user_id):
    current_app.logger.debug(f"Getting or creating conversation for user {user_id}")
    
    # Check for an active conversation
    active_conversation = get_conversation_collection().find_one(
        {'user_id': user_id, 'status': 'active'},
        sort=[('last_updated', -1)]
    )
    
    if active_conversation:
        current_app.logger.debug(f"Found active conversation: {active_conversation['_id']}")
        # Check if the conversation has messages
        if active_conversation.get('messages', []):
            current_app.logger.debug("Active conversation has messages. Creating a new one.")
            # If it has messages, create a new conversation
            return create_new_conversation(user_id)
        else:
            current_app.logger.debug("Active conversation has no messages. Using it.")
            return str(active_conversation['_id'])
    else:
        current_app.logger.debug("No active conversation found. Creating a new one.")
        return create_new_conversation(user_id)

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
@with_db_connection
def update_conversation_context(db, conversation_id):
    conversation_collection = get_collection('conversations')
    conversation = conversation_collection.find_one({'_id': ObjectId(conversation_id)})
    
    if not conversation:
        return
    
    last_n_messages = conversation['messages'][-5:]  # Consider last 5 messages
    
    # Modified this line to handle potential dictionary messages
    context_text = " ".join([msg['content'] if isinstance(msg, dict) else str(msg) for msg in last_n_messages])
    
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

@with_db_connection
def get_current_conversation(db, user_id):
    conversation_collection = get_collection('conversations')
    conversation = conversation_collection.find_one(
        {'user_id': user_id, 'active': True},
        sort=[('timestamp', -1)]
    )
    return conversation['_id'] if conversation else None

@with_db_connection
def start_new_conversation(db, user_id, title):
    conversation_collection = get_collection('conversations')
    conversation_entry = {
        'user_id': user_id,
        'title': title,
        'active': True,
        'timestamp': datetime.utcnow()
    }
    result = conversation_collection.insert_one(conversation_entry)
    return result.inserted_id

@with_db_connection
def end_conversation(db, conversation_id):
    conversations_collection = get_collection('conversations')
    conversations_collection.update_one(
        {'_id': conversation_id},
        {'$set': {'active': False}}
    )

@with_db_connection
def get_user_conversations(db, user_id):
    conversations_collection = get_collection('conversations')
    conversations = conversations_collection.find(
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

@with_db_connection
def get_conversation_context(db, conversation_id):
    conversations = get_collection('conversations')
    conversation = conversations.find_one({'_id': ObjectId(conversation_id)})
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

@with_db_connection
def get_conversation_messages(db, conversation_id):
    conversations = get_collect('conversations');
    return conversations.find(
        {'conversation_id': conversation_id}
    ).sort('timestamp', 1)

    __all__ = ['get_db_connection', 'generate_embedding', 'add_question_answer', 'add_unanswered_question','search_similar_questions', 'json_serialize']

def generate_potential_answer_v2(question, last_assistant_message=""):
    logger.debug(f"Generating potential answer for question: {question}")
    
    if is_event_related_question(question):
        logger.debug("Question identified as event-related")
        events_data = fetch_relevant_events(question)
        logger.debug(f"Fetched {len(events_data)} relevant events")
        if events_data:
            logger.debug("Formatting events response")
            return format_events_response(events_data, question)
        else:
            logger.debug("No relevant events found, returning default message")
            return {
                'title': 'No Upcoming Events',
                'summary': 'There are currently no upcoming events in our database.',
                'answer': "I'm sorry, but there are currently no upcoming events scheduled in our database for the next three months. We're continuously updating our event calendar. Please check back later for updates on future events, or you can visit our official website for the most up-to-date information on MongoDB Developer Day events.",
                'references': 'Events data from MongoDB events collection.'
            }
        
    # Existing code for non-event questions
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"""
    Previous assistant message: {last_assistant_message}

    New question with context: {question}

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
    logger.debug(f"Generated answer: {answer}")

    title = generate_title(answer)
    summary = generate_summary(answer)
    references = generate_references(answer)

    return {
        'title': title,
        'summary': summary,
        'answer': answer,
        'references': references
    }

def is_event_related_question(question):
    prompt = f"""
    Determine if the following question is related to events, specifically MongoDB Developer Day events or similar tech conferences. 
    Respond with 'Yes' if it's event-related, or 'No' if it's not.

    Question: {question}

    Is this question related to events?
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that determines if questions are related to events."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=5  # We only need a short response
        )
        
        answer = response['choices'][0]['message']['content'].strip().lower()
        return answer == 'yes'
    except Exception as e:
        logger.error(f"Error in is_event_related_question: {str(e)}")
        # If there's an error, we'll fall back to the keyword method
        event_keywords = ['event', 'developer day', 'conference', 'workshop', 'upcoming', 'schedule', 'calendar']
        return any(keyword in question.lower() for keyword in event_keywords)

@with_db_connection
def fetch_relevant_events(db, question):
    logger.debug(f"Fetching relevant events for question: {question}")
    events_collection = get_collection('events')

    now = datetime.now(timezone.utc)
    three_months_from_now = now + timedelta(days=90)

    # Default to fetching upcoming events
    query = {'date_time': {'$gte': now, '$lte': three_months_from_now}}

    logger.debug(f"Initial query: {query}")

    # # Adjust query based on question specifics
    # question_lower = question.lower()
    # if 'past' in question_lower:
    #     query = {'date_time': {'$lt': now}}
    # elif 'all' in question_lower:
    query = {}

    logger.debug(f"Adjusted query: {query}")

    # Sort events by date
    events = list(events_collection.find(query).sort('date_time', 1).limit(10))
    
    logger.debug(f"Found {len(events)} events")
    for event in events:
        logger.debug(f"Event: {event.get('title', 'No title')} at {event.get('date_time', 'No date')}")

    return events

def format_events_response(events, question):
    logger.debug(f"Formatting response for {len(events)} events")
    
    if not events:
        return {
            'title': 'No Upcoming Events Found',
            'summary': 'There are no upcoming events in our database at this time.',
            'answer': f"I'm sorry, but I couldn't find any upcoming events that match your query: '{question}'. Please check back later for updates on future events.",
            'references': 'Events data from MongoDB events collection.'
        }

    # Create a table of events
    table_rows = []
    for event in events:
        logger.debug(f"Processing event: {event}")
        
        # Extract date and time
        date_time = event.get('date_time')
        if isinstance(date_time, str):
            try:
                date_time = datetime.fromisoformat(date_time)
            except ValueError:
                date_time = None
        
        if isinstance(date_time, datetime):
            date = date_time.strftime('%Y-%m-%d')
            time = date_time.strftime('%H:%M %Z')
        else:
            date = "Date not specified"
            time = "Time not specified"

        title = event.get('title', 'Event title not specified')
        location = f"{event.get('city', 'N/A')}, {event.get('state', 'N/A')}, {event.get('country_code', 'N/A')}"
        
        # Add registration URL if available
        registration_url = event.get('registration_url')
        if registration_url:
            title = f"[{title}]({registration_url})"
        
        table_rows.append(f"| {title} | {date} | {time} | {location} |")

    table_header = "| Event | Date | Time | Location |\n|-------|------|------|----------|\n"
    table = table_header + '\n'.join(table_rows)

    answer = f"Yes, there are upcoming Developer Day events. Here are the details:\n\n{table}\n\nClick on the event name to register or get more information. If there's no link, please check the official MongoDB Developer Day website for registration details."

    return {
        'title': 'Upcoming Developer Day Events',
        'summary': f"Found {len(events)} upcoming events.",
        'answer': answer,
        'references': 'Events data from MongoDB events collection.'
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

@with_db_connection
def print_db_info(db):
    logging.info(f"Current database: {db.name}")
    logging.info(f"Collections in database: {db.list_collection_names()}")
    collection = get_collection('documents')
    logging.info(f"Current collection: {collection.name}")
    logging.info(f"Document count in collection: {collection.count_documents({})}")

def verify_question_similarity(query, candidate):
    prompt = f"""
    On a scale of 1 to 10, how similar are these two questions in terms of their intent and subject matter?
    Question 1: {query}
    Question 2: {candidate}
    Only respond with a number between 1 and 10.
    """
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that rates the similarity of questions."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=5
    )
    
    try:
        similarity_score = int(response['choices'][0]['message']['content'].strip())
        return similarity_score / 10  # Normalize to 0-1 range
    except ValueError:
        return 0 
def analyze_transcript(filepath, user_context):
    try:
        # Check if the file is a PDF
        if filepath.lower().endswith('.pdf'):
            with open(filepath, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                transcript = ""
                for page in reader.pages:
                    transcript += page.extract_text()
        else:
            # For non-PDF files, try reading as UTF-8 with error handling
            with open(filepath, 'r', encoding='utf-8', errors='replace') as file:
                transcript = file.read()

        # Truncate the transcript if it's too long
        max_tokens = 3000  # Adjust this value based on your needs
        if len(transcript) > max_tokens:
            transcript = transcript[:max_tokens] + "..."

        prompt = f"""
        Analyze the following transcript from a design review meeting, taking into consideration the additional context provided by the user:

        User Context:
        {user_context}

        Transcript:
        {transcript}

        Please provide a summary in the following format:
        1. What We Heard: Summarize the main points discussed in the meeting, incorporating relevant user context.
        2. Key Issues: Identify the main challenges or problems mentioned, considering the user's specific situation.
        3. What We Advise: Based on the discussion and user context, what recommendations would you make?

        Provide your analysis as plain text, not in JSON format. Use the exact headings "What We Heard:", "Key Issues:", and "What We Advise:" to separate the sections.
        """

        # Call the OpenAI API using the new interface
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an expert in MongoDB design reviews. Your task is to analyze transcripts from design review meetings and provide insightful summaries and recommendations."},
                {"role": "user", "content": prompt}
            ]
        )

        # Extract the generated text
        analysis = response.choices[0].message.content

        # Print the raw response for debugging
        print("Raw API response:", analysis)

        # Parse the response into sections
        sections = re.split(r'(What We Heard:|Key Issues:|What We Advise:)', analysis)[1:]  # Split and keep separators
        parsed_response = {}
        current_key = None
        for item in sections:
            if item in ["What We Heard:", "Key Issues:", "What We Advise:"]:
                current_key = item.strip(':').lower().replace(' ', '_')
            elif current_key:
                parsed_response[current_key] = item.strip()

        # If any section is missing, add a placeholder
        for key in ['what_we_heard', 'key_issues', 'what_we_advise']:
            if key not in parsed_response:
                parsed_response[key] = f"No {key.replace('_', ' ')} provided in the analysis."
        return parsed_response

    except Exception as e:
        print(f"An error occurred while analyzing the transcript: {str(e)}")
        return {
            'what_we_heard': f'Error occurred during analysis: {str(e)}',
            'key_issues': 'Error occurred during analysis.',
            'what_we_advise': 'Error occurred during analysis.'
        }
    
def update_design_review_data(review_id, update_data):
    design_reviews_collection = get_collection('design_reviews')

    result = design_reviews_collection.update_one(
        {'_id': ObjectId(review_id)},
        {'$set': update_data}
    )

    if result.modified_count == 1:
        return True
    else:
        return False