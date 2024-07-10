import os
import json  # Ensure json is imported
import traceback  # Ensure traceback is imported
import logging
from flask import Blueprint, request, jsonify, render_template, current_app, session
from flask_login import login_required, current_user
from bson import ObjectId
from pymongo import MongoClient
from config import Config
from app.utils import (
    generate_embedding,
    search_similar_questions,
    add_question_answer,
    check_database_connection,
    get_collection_stats,
    json_serialize,
    store_message,
    get_user_conversations,
    get_conversation_messages,
    start_new_conversation  # Ensure this is imported

)

main = Blueprint('main', __name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname=s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB client and collections
client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
conversation_collection = db['conversations']

@main.route('/')
def index():
    try:
        current_app.logger.debug(f"Request received for index route")
        
        # Debug session information
        if session:
            current_app.logger.debug(f"Session keys: {list(session.keys())}")
            for key in session.keys():
                current_app.logger.debug(f"Session[{key}]: {session.get(key)}")
        else:
            current_app.logger.debug("Session is empty")

        # Debug current_user information
        if current_user:
            current_app.logger.debug(f"Current user: {current_user}")
            current_app.logger.debug(f"User authenticated: {current_user.is_authenticated}")
            if current_user.is_authenticated:
                current_app.logger.debug(f"Authenticated user: {getattr(current_user, 'email', 'Email not found')}")
            else:
                current_app.logger.debug("User is not authenticated")
        else:
            current_app.logger.debug("current_user is None")

        # Debug template information
        template_folder = current_app.template_folder
        index_html_path = os.path.join(template_folder, 'index.html')
        current_app.logger.debug(f"Template folder: {template_folder}")
        current_app.logger.debug(f"index.html exists: {os.path.exists(index_html_path)}")

        return render_template('index.html', is_chat=False)
    except Exception as e:
        current_app.logger.error(f"Error in index route: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 500

@main.route('/chat')
@login_required
def chat():
    try:
        current_app.logger.debug(f"Request received for chat route")
        
        return render_template('index.html', is_chat=True)
    except Exception as e:
        current_app.logger.error(f"Error in chat route: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 500

@main.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        return jsonify({"error": "Unauthorized access"}), 403
    return render_template('admin.html')

@main.route('/api/chat', methods=['POST'])
@login_required
def chat_api():
    debug_info = {}
    try:
        debug_info['request'] = {
            'method': request.method,
            'headers': dict(request.headers),
            'json': request.json
        }
        if 'question' not in request.json:
            raise ValueError("Missing 'question' in request payload")

        user_question = request.json['question']

        user_id = current_user.get_id()

        # Generate a title for the conversation
        title = user_question[:50]  # Use the first 50 characters of the question as the title
        
        # Start a new conversation if no active conversation exists
        conversation_id = start_new_conversation(user_id, title)
        
        store_message(user_id, user_question, 'User', conversation_id)

        question_embedding, embed_debug = generate_embedding(user_question)
        debug_info['embedding'] = embed_debug

        similar_questions, search_debug = search_similar_questions(question_embedding)
        debug_info['search'] = search_debug

        if similar_questions:
            response_message = similar_questions[0]['answer']
            response = {
                'question': similar_questions[0]['question'],
                'answer': response_message,
                'score': similar_questions[0]['score'],
                'debug_info': debug_info
            }
        else:
            response_message = 'No similar questions found'
            response = {'error': response_message, 'debug_info': debug_info}

        store_message(user_id, response_message, 'Assistant', conversation_id)
        return json.dumps(response, default=json_serialize), 200, {'Content-Type': 'application/json'}
    except ValueError as e:
        logger.error(f"Value error in chat route: {str(e)}")
        debug_info['error'] = str(e)
        return json.dumps({'error': str(e), 'debug_info': debug_info}, default=json_serialize), 400, {'Content-Type': 'application/json'}
    except Exception as e:
        logger.error(f"Error in chat route: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        return json.dumps({'error': str(e), 'debug_info': debug_info}, default=json_serialize), 500, {'Content-Type': 'application/json'}


@main.route('/api/add_question', methods=['POST'])
@login_required
def add_question():
    debug_info = {}
    try:
        debug_info['database_connection'] = check_database_connection()
        if not debug_info['database_connection']:
            raise Exception("Database connection failed")

        debug_info['stats_before'] = get_collection_stats()

        question = request.json['question']
        answer = request.json['answer']
        
        inserted_id, add_debug = add_question_answer(question, answer)
        debug_info['add_question'] = add_debug

        debug_info['stats_after'] = get_collection_stats()

        response = {
            'message': 'Question and answer added successfully',
            'id': str(inserted_id),
            'debug_info': debug_info
        }
        return json.dumps(response, default=json_serialize), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        logger.error(f"Error in add_question route: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        return json.dumps({'error': str(e), 'debug_info': debug_info}, default=json_serialize), 500, {'Content-Type': 'application/json'}

@main.route('/api/conversations', methods=['GET'])
@login_required
def get_conversations():
    user_id = current_user.get_id()
    conversations = get_user_conversations(user_id)  # Ensure this function fetches conversations correctly
    return jsonify(list(conversations)), 200

@main.route('/api/conversations/<string:conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    try:
        result = conversation_collection.delete_one({'_id': ObjectId(conversation_id)})
        if result.deleted_count == 1:
            return jsonify({'message': 'Conversation deleted successfully'}), 200
        else:
            return jsonify({'error': 'Conversation not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting conversation: {str(e)}")
        return jsonify({'error': 'An error occurred'}), 500

@main.route('/api/conversations/<string:conversation_id>', methods=['GET'])
@login_required
def conversation_messages(conversation_id):
    try:
        messages = get_conversation_messages(ObjectId(conversation_id))
        return json.dumps(list(messages), default=json_serialize), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        logger.error(f"Error in conversation_messages route: {str(e)}")
        return jsonify({'error': 'Invalid conversation ID'}), 400
