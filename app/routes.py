import os
import json  # Ensure json is imported
import traceback  # Ensure traceback is imported
import logging
from flask import Blueprint, request, jsonify, render_template, current_app, session
from flask_login import login_required, current_user
from bson import ObjectId
from pymongo import MongoClient
from config import Config
from datetime import datetime
from app.utils import (
    generate_embedding,
    search_similar_questions,
    add_question_answer,
    check_database_connection,
    get_collection_stats,
    json_serialize,
    store_message,
    generate_title,
    generate_references,
    generate_summary,
    get_user_conversations,
    get_conversation_messages,
    start_new_conversation,  # Ensure this is imported
    add_unanswered_question  # Ensure this is imported
)
import openai

main = Blueprint('main', __name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname=s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB client and collections
client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
conversation_collection = db['conversations']
documents_collection = db['documents']
unanswered_collection = db['unanswered_questions']
users_collection = db['users']
SIMILARITY_THRESHOLD = float(Config.SIMILARITY_THRESHOLD)  # Ensure this is float

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

@main.route('/about')
def about():
    return render_template('about.html')

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
        user_name = current_user.name

        # Generate a title for the conversation
        title = user_question[:50]  # Use the first 50 characters of the question as the title
        
        # Start a new conversation if no active conversation exists
        conversation_id = start_new_conversation(user_id, title)
        
        store_message(user_id, user_question, 'User', conversation_id)

        # Generate the question embedding
        question_embedding, embed_debug = generate_embedding(user_question)
        debug_info['embedding'] = embed_debug

        # Search for similar questions
        similar_questions, search_debug = search_similar_questions(question_embedding)
        debug_info['search'] = search_debug

        if similar_questions and similar_questions[0]['score'] > SIMILARITY_THRESHOLD:
            response_message = similar_questions[0]['answer']
            response = {
                'question': similar_questions[0]['question'],
                'answer': response_message,
                'score': similar_questions[0]['score'],
                'debug_info': debug_info
            }
        else:
            # Add the unanswered question to the unanswered_questions collection
            add_unanswered_question(user_id, user_name, user_question)
            potential_answer = generate_potential_answer(user_question)
            response_message = 'No similar questions found. Your question has been logged for review.'

            response = {
                'error': response_message,
                'potential_answer': potential_answer['answer'],  # Ensure only the answer part is sent to the user
                'debug_info': debug_info
            }
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

@main.route('/api/questions', methods=['POST'])
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


@main.route('/api/questions', methods=['GET'])
@login_required
def get_questions():
    try:
        questions = list(documents_collection.find())
        for question in questions:
            question['_id'] = str(question['_id'])
        return jsonify(questions), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching questions: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500


@main.route('/api/questions/<string:question_id>', methods=['PUT'])
@login_required
def update_question(question_id):
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')

    current_app.logger.info(f"Received request to update question with ID: {question_id}")
    current_app.logger.info(f"New question: {question}")
    current_app.logger.info(f"New answer: {answer}")

    if not question or not answer:
        current_app.logger.error("Question or answer missing")
        return jsonify({'error': 'Question and answer are required.'}), 400

    try:
        # Check if the question_id exists in the unanswered_collection
        unanswered_question = unanswered_collection.find_one({'_id': ObjectId(question_id)})
        if unanswered_question:
            # Update the unanswered question with the answered flag
            result = unanswered_collection.update_one(
                {'_id': ObjectId(question_id)},
                {'$set': {'answered': True, 'answer': answer, 'answered_at': datetime.now()}}
            )

            if result.matched_count == 0:
                current_app.logger.error("Unanswered question not found")
                return jsonify({'error': 'Unanswered question not found'}), 404

            # Generate embeddings for the question and the answer
            question_embedding, question_debug = generate_embedding(question)
            answer_embedding, answer_debug = generate_embedding(answer)

            # Add the answered question to the documents collection
            documents_collection.insert_one({
                'question': unanswered_question['question'],
                'question_embedding': question_embedding,
                'answer': answer,
                'answer_embedding': answer_embedding,
                'created_at': unanswered_question.get('created_at', datetime.now()),  # Default to now if not present
                'updated_at': datetime.now()
            })
            current_app.logger.info("Question updated in unanswered_questions and moved to documents collection with embeddings")

            return jsonify({'message': 'Question updated successfully'}), 200

        # If the question_id is not in the unanswered_collection, check the documents_collection
        result = documents_collection.update_one(
            {'_id': ObjectId(question_id)},
            {'$set': {'question': question, 'answer': answer, 'updated_at': datetime.now()}}
        )

        if result.matched_count == 0:
            current_app.logger.error("Question not found in documents collection")
            return jsonify({'error': 'Question not found in documents collection'}), 404

        current_app.logger.info("Question updated in documents collection")
        return jsonify({'message': 'Question updated successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating question: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/questions/<string:question_id>', methods=['DELETE'])
@login_required
def delete_question(question_id):
    try:
        result = documents_collection.delete_one({'_id': ObjectId(question_id)})
        if result.deleted_count == 1:
            return jsonify({'message': 'Question deleted successfully'}), 200
        else:
            return jsonify({'error': 'Question not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting question: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/unanswered_questions', methods=['GET'])
@login_required
def get_unanswered_questions():
    try:
        # Find all unanswered questions
        unanswered_questions = list(unanswered_collection.find({"$or": [{"answered": {"$exists": False}}, {"answered": False}]}))
        user_ids = [question['user_id'] for question in unanswered_questions]
        
        # Fetch user names for the corresponding user IDs
        users = db.users.find({"_id": {"$in": [ObjectId(user_id) for user_id in user_ids]}})
        user_dict = {str(user['_id']): user['name'] for user in users}
        
        for question in unanswered_questions:
            question['_id'] = str(question['_id'])
            question['user_name'] = user_dict.get(question['user_id'], 'Unknown User')
        
        return jsonify(unanswered_questions), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching unanswered questions: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500
    
@main.route('/api/unanswered_questions/<id>', methods=['DELETE'])
def delete_unanswered_question(id):
    try:
        result = unanswered_collection.delete_one({'_id': ObjectId(id)})
        if result.deleted_count == 1:
            return jsonify({'message': 'Unanswered question deleted successfully'}), 200
        else:
            return jsonify({'message': 'Unanswered question not found'}), 404
    except Exception as e:
        return jsonify({'message': str(e)}), 500
    
@main.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        return jsonify({"error": "Unauthorized access"}), 403
    return render_template('admin.html')

# New route to fetch all users
@main.route('/api/users', methods=['GET'])
@login_required
def get_users():
    users = list(users_collection.find())
    for user in users:
        user['_id'] = str(user['_id'])
    return jsonify(users)

# New route to update a user's admin status
@main.route('/api/users/<id>', methods=['PUT'])
@login_required
def update_user(id):
    data = request.json
    users_collection.update_one({'_id': ObjectId(id)}, {'$set': data})
    return '', 204

@main.route('/api/feedback', methods=['POST'])
def receive_feedback():
    data = request.json
    rating = data.get('rating')
    
    if rating:
        # Store the feedback in the database
        feedback = {
            'rating': rating,
            'timestamp': datetime.now()
        }
        db.feedback.insert_one(feedback)
        return jsonify({"message": "Feedback received"}), 200
    else:
        return jsonify({"error": "Invalid feedback"}), 400
