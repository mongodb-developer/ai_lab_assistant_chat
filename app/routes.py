import os
import json 
import traceback 
import logging
from flask import Blueprint, flash, redirect, request, jsonify, render_template, current_app, session, send_from_directory, url_for
from flask_login import login_required, current_user
from bson import ObjectId
from pymongo import MongoClient
from config import Config
from datetime import datetime
import markdown2
from bs4 import BeautifulSoup
from .question_generator import process_content, save_to_mongodb, fetch_content_from_url, extract_text_from_file
import requests
from werkzeug.utils import secure_filename
import pytz
from app.utils import analyze_transcript, update_design_review_data, get_collection, get_or_create_conversation, create_new_conversation, close_active_conversations, get_conversation_collection, get_unanswered_collection, get_documents_collection, get_users_collection, get_feedback_collection, get_answer_feedback_collection, get_events_collection, verify_question_similarity
from .design_review_service import DesignReviewService
from bson.son import SON
import openai
import PyPDF2
import io

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
    get_conversation_context,
    generate_potential_answer_v2,
    get_active_conversation,
    start_new_conversation,  # Ensure this is imported
    add_unanswered_question,  # Ensure this is imported
    is_event_related_question,
    fetch_relevant_events, 
    format_events_response,
    get_db_connection,
    update_user_login_info
)
from werkzeug.exceptions import HTTPException

main = Blueprint('main', __name__)

def custom_json_encoder(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
    
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname=s - %(message)s')
logger = logging.getLogger(__name__)

# # MongoDB client and collections
# client = MongoClient(Config.MONGODB_URI)
# db = client[Config.MONGODB_DB]
# conversation_collection = db['conversations']
# documents_collection = db['documents']
# unanswered_collection = db['unanswered_questions']
# users_collection = db['users']
# feedback_collection = db['feedback']
# events_collection = db['events']

# Default sessions
DEFAULT_SESSIONS = [
    {"name": "Data Modeling", "instructor": ""},
    {"name": "Intro Lab", "instructor": ""},
    {"name": "Aggregations", "instructor": ""},
    {"name": "Atlas Search", "instructor": ""},
    {"name": "VectorSearch", "instructor": ""}
]
SIMILARITY_THRESHOLD = float(Config.SIMILARITY_THRESHOLD)  # Ensure this is float

@main.route('/')
def home():

    labs = [
        {
            "title": "Intro Lab",
            "description": "Get started with MongoDB basics",
            "url": "https://mongodb-developer.github.io/intro-lab/"
        },
        {
            "title": "Search Lab",
            "description": "Learn about MongoDB's search capabilities",
            "url": "https://mongodb-developer.github.io/search-lab/"
        },
        {
            "title": "Aggregation Pipeline Lab",
            "description": "Master MongoDB's powerful aggregation framework",
            "url": "https://mongodb-developer.github.io/aggregation-pipeline-lab/"
        },
        {
            "title": "Relational Migrator Lab",
            "description": "Migrate from relational databases to MongoDB",
            "url": "https://mongodb-developer.github.io/relational-migrator-lab/"
        }
    ]
    try:
        current_app.logger.debug("Entering home route")
        return render_template('home.html', labs=labs)
    except Exception as e:
        current_app.logger.error(f"Error in home route: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return "An error occurred", 500

@main.route('/chat')
def chat():
    try:
        current_app.logger.debug("Entering chat route")
        user_data = get_users_collection().find_one({'_id': ObjectId(current_user.id)})
        logger.info(f"User data: {user_data}")
        return render_template('chat.html')
    except Exception as e:
        current_app.logger.error(f"Error in chat route: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return "An error occurred", 500
    
    # user_data = get_users_collection().find_one({'_id': ObjectId(current_user.id)})
    # logger.info("User:" + jsonify(user_data).get_json())
    # try:
    #     # Your existing chat route code here
    #     return render_template('index.html', is_chat=True, user=user_data)
    # except Exception as e:
    #     logger.error(f"Error in chat route: {str(e)}", exc_info=True)
    #     return "An error occurred", 500

# Route: Index
# Description: Renders the main page of the application
# Parameters: None
# Returns: Rendered index.html template
@main.route('/')
def index():
    current_app.logger.debug("Starting index route")
    
    try:
        user_data = None
        current_app.logger.debug("Initialized user_data to None")

        if session:
            current_app.logger.debug(f"Session keys: {list(session.keys())}")
            for key in session.keys():
                current_app.logger.debug(f"Session[{key}]: {session.get(key)}")
        else:
            current_app.logger.debug("Session is empty")

        current_app.logger.debug(f"Current user authenticated: {current_user.is_authenticated}")

        if current_user.is_authenticated:
            current_app.logger.debug(f"Current user: {current_user}")
            current_app.logger.debug(f"Authenticated user email: {getattr(current_user, 'email', 'Email not found')}")


            current_app.logger.debug(f"Fetching user data for id: {current_user.id}")
            user_data = get_users_collection().find_one({'_id': ObjectId(current_user.id)})

            if user_data:
                current_app.logger.debug("User data found, updating login info")
                update_user_login_info(str(current_user.id))
            else:
                current_app.logger.error(f"User data not found for id: {current_user.id}")
        else:
            current_app.logger.debug("User is not authenticated")

        template_folder = current_app.template_folder
        index_html_path = os.path.join(template_folder, 'index.html')
        current_app.logger.debug(f"Template folder: {template_folder}")
        current_app.logger.debug(f"index.html exists: {os.path.exists(index_html_path)}")

        current_app.logger.debug("Rendering template")
        return render_template('index.html', is_chat=False, user=user_data)
    
    except Exception as e:
        current_app.logger.error(f"Error in index route: {str(e)}")
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "An internal error occurred"}), 500

# # Route: Chat
# # Description: Renders the chat page of the application
# # Parameters: None
# # Returns: Rendered index.html template with is_chat=True
# @main.route('/chat')
# @login_required
# def chat():
#     try:
#         current_app.logger.debug(f"Request received for chat route")
        
#         return render_template('index.html', is_chat=True)
#     except Exception as e:
#         current_app.logger.error(f"Error in chat route: {str(e)}")
#         return jsonify({"error": "An internal error occurred"}), 500
    
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
        selected_module = request.json.get('module', '')
        force_new_conversation = request.json.get('force_new_conversation', False)
        
        logging.info(f"Searching for similar questions to: {user_question}")
        user_id = current_user.get_id()
        user_name = current_user.name

        # Check for active conversation or create a new one
        active_conversation = get_active_conversation(user_id)
        
        if force_new_conversation or not active_conversation:
            conversation_id = create_new_conversation(user_id)
            logging.info(f"Created new conversation: {conversation_id}")
        else:
            conversation_id = str(active_conversation['_id'])
            logging.info(f"Using existing conversation: {conversation_id}")

        store_message(user_id, user_question, 'User', conversation_id)

        # Generate the question embedding
        question_embedding, embed_debug = generate_embedding(user_question)
        debug_info['embedding'] = embed_debug

        # Search for similar questions with module consideration
        # similar_questions = search_similar_questions(question_embedding, user_question, selected_module)
        similar_questions, debug_info = search_similar_questions(question_embedding, user_question, selected_module)

        logging.info(f"Found {len(similar_questions)} similar questions")

        if similar_questions:
            best_match = similar_questions[0]
            logging.info(f"Best match: '{best_match['question']}' with score {best_match['combined_score']}")

            # Check if the best match is actually relevant
            if best_match['combined_score'] > SIMILARITY_THRESHOLD and verify_question_similarity(user_question, best_match['question']) >= 0.8:
                response_message = best_match['answer']
                response_data = {
                    'question': best_match['question'],
                    'answer': response_message,
                    'score': best_match['combined_score'],
                    'title': best_match.get('title', ''),
                    'summary': best_match.get('summary', ''),
                    'references': best_match.get('references', ''),
                    'source': 'database',
                    'match_score': round(best_match['combined_score'], 4),
                    "debug_info": debug_info

                }
            else:
                logging.info("Best match didn't pass relevance check. Generating new answer.")
                response_message = generate_potential_answer_v2(user_question)
                response_data = {
                    'question': user_question,
                    'answer': response_message.get('answer', ''),
                    'title': response_message.get('title', ''),
                    'summary': response_message.get('summary', ''),
                    'references': response_message.get('references', ''),
                    'source': 'LLM',
                    "debug_info": debug_info

                }
                add_unanswered_question(user_id, user_name, user_question, response_data, selected_module)
        else:
            logging.info("No similar questions found. Generating new answer.")
            response_message = generate_potential_answer_v2(user_question)
            response_data = {
                'question': user_question,
                'answer': response_message['answer'],
                'title': response_message.get('title', ''),
                'summary': response_message.get('summary', ''),
                'references': response_message.get('references', ''),
                'source': 'LLM',
                "debug_info": debug_info

            }
            add_unanswered_question(user_id, user_name, user_question, response_data, selected_module)

        store_message(user_id, response_message, 'Assistant', conversation_id)
        
        response_data['conversation_id'] = conversation_id
        return json.dumps(response_data, default=json_serialize), 200, {'Content-Type': 'application/json'}
    except ValueError as e:
        logger.error(f"Value error in chat route: {str(e)}")
        debug_info['error'] = str(e)
        return json.dumps({'error': str(e), 'debug_info': debug_info}, default=json_serialize), 400, {'Content-Type': 'application/json'}
    except Exception as e:
        logger.error(f"Error in chat route: {str(e)}")
        debug_info['error'] = str(e)
        debug_info['traceback'] = traceback.format_exc()
        return json.dumps({'error': str(e), 'debug_info': debug_info}, default=json_serialize), 500, {'Content-Type': 'application/json'}

# Route: Get Questions
# Description: Retrieves all questions from the database
# Parameters: None
# Returns: JSON array of questions
@main.route('/api/questions', methods=['GET'])
@login_required
def get_questions():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))  # Number of items per page
        documents_collection = get_documents_collection()

        total = documents_collection.count_documents({})
        
        questions = list(documents_collection.find()
                         .skip((page - 1) * per_page)
                         .limit(per_page))

        for question in questions:
            question['_id'] = str(question['_id'])

        return jsonify({
            'questions': questions,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching questions: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/questions', methods=['POST'])
@login_required
def add_question():
    try:
        data = request.json
        if not data or 'question' not in data or 'answer' not in data:
            return jsonify({'error': 'Invalid request data'}), 400

        question = data['question']
        answer = data['answer']
        title = data.get('title', '')
        summary = data.get('summary', '')
        references = data.get('references', '')

        # Generate embeddings and add the question to the database
        question_id, debug_info = add_question_answer(question, answer, title, summary, references)

        return jsonify({
            'message': 'Question added successfully',
            'question_id': str(question_id),
            'debug_info': debug_info
        }), 201
    except Exception as e:
        current_app.logger.error(f"Error adding question: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@main.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(main.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

# Add a general error handler for the blueprint
@main.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify(error=str(e)), e.code
    # Handle non-HTTP exceptions here
    return jsonify(error="An unexpected error occurred"), 500

@main.route('/api/questions/<string:question_id>', methods=['GET'])
@login_required
def get_question(question_id):
    documents_collection = get_documents_collection()
    try:
        question = documents_collection.find_one({'_id': ObjectId(question_id)})
        if question:
            question['_id'] = str(question['_id'])  # Convert ObjectId to string
            return jsonify(question), 200
        else:
            return jsonify({'error': 'Question not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error fetching question: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/questions/<string:question_id>', methods=['PUT'])
@login_required
def update_question(question_id):
    data = request.get_json()
    question = data.get('question')
    answer = data.get('answer')
    title = data.get('title')
    summary = data.get('summary')
    references = data.get('references')
    unanswered_collection = get_unanswered_collection()
    documents_collection = get_documents_collection()

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
            new_document = {
                'question': unanswered_question['question'],
                'question_embedding': question_embedding,
                'answer': answer,
                'title': title,
                'summary': summary,
                'references': references,
                'answer_embedding': answer_embedding,
                'created_at': unanswered_question.get('created_at', datetime.now()),
                'updated_at': datetime.now()
            }
            insert_result = get_documents_collection().insert_one(new_document)
            
            current_app.logger.info("Question updated in unanswered_questions and moved to documents collection with embeddings")
            return jsonify({'message': 'Question updated successfully', 'new_id': str(insert_result.inserted_id)}), 200

        # If the question_id is not in the unanswered_collection, check the documents_collection
        update_data = {
            'question': question,
            'answer': answer,
            'title': title,
            'summary': summary,
            'references': references,
            'updated_at': datetime.now()
        }
        
        # Generate new embeddings
        question_embedding, _ = generate_embedding(question)
        answer_embedding, _ = generate_embedding(answer)
        update_data['question_embedding'] = question_embedding
        update_data['answer_embedding'] = answer_embedding

        result = get_documents_collection().update_one(
            {'_id': ObjectId(question_id)},
            {'$set': update_data}
        )

        if result.matched_count == 0:
            current_app.logger.error("Question not found in documents collection")
            return jsonify({'error': 'Question not found in documents collection'}), 404

        current_app.logger.info("Question updated in documents collection")
        return jsonify({'message': 'Question updated successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating question: {str(e)}")
        return jsonify({'error': f'An internal error occurred: {str(e)}'}), 500

@main.route('/api/questions/<string:question_id>', methods=['DELETE'])
@login_required
def delete_question(question_id):
    documents_collection = get_documents_collection()
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
        unanswered_questions = list(get_unanswered_collection().find({"$or": [{"answered": {"$exists": False}}, {"answered": False}]}))
        user_ids = [question['user_id'] for question in unanswered_questions]
        
        # Fetch user names for the corresponding user IDs
        users = get_users_collection().find({"_id": {"$in": [ObjectId(user_id) for user_id in user_ids]}})
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
        result = get_unanswered_collection().delete_one({'_id': ObjectId(id)})
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
        flash("You don't have permission to access the admin page.", "error")
        return redirect(url_for('main.index'))
    
    # Fetch any necessary data for the admin dashboard
    # For example:
    total_users = get_users_collection().count_documents({})
    total_questions = get_documents_collection().count_documents({})
    
    return render_template('admin.html', 
                           google_maps_api_key=Config.GOOGLE_MAPS_API_KEY,
                           total_users=total_users, 
                           total_questions=total_questions)

# New route to fetch all users
@main.route('/api/users', methods=['GET'])
@login_required
def get_users():
    users = list(get_users_collection().find())
    for user in users:
        user['_id'] = str(user['_id'])
    return jsonify(users)

# New route to update a user's admin status
@main.route('/api/users/<id>', methods=['PUT'])
@login_required
def update_user(id):
    data = request.json
    get_users_collection().update_one({'_id': ObjectId(id)}, {'$set': data})
    return '', 204

@main.route('/feedback')
def feedback():
    try:
        current_app.logger.info("Accessing feedback route")
        return render_template('feedback.html')
    except Exception as e:
        current_app.logger.error(f"Error in feedback route: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 500

@main.route('/api/app_feedback', methods=['POST'])
def receive_app_feedback():
    data = request.json
    rating = data.get('rating')
    
    if rating is not None:
        feedback = {
            'rating': rating,
            'timestamp': datetime.now()
        }
        get_feedback_collection().insert_one(feedback)
        return jsonify({"message": "Application feedback received"}), 200
    else:
        return jsonify({"error": "Invalid feedback"}), 400
@main.route('/api/message_feedback', methods=['POST'])
@login_required
def submit_message_feedback():
    data = request.json
    print("Received feedback data:", data)  # Debug print
    
    question_id = data.get('question_id')
    original_question = data.get('original_question')
    proposed_answer = data.get('proposed_answer')
    is_positive = data.get('is_positive')

    if is_positive is None:
        print("Invalid feedback data: is_positive is None")
        return jsonify({'error': 'Invalid feedback data'}), 400

    try:
        feedback_entry = {
            'user_id': str(current_user.id),  # Convert to string to avoid ObjectId issues
            'is_positive': is_positive,
            'timestamp': datetime.now()
        }
        
        # Add fields only if they are present
        if original_question:
            feedback_entry['original_question'] = original_question
        if proposed_answer:
            feedback_entry['proposed_answer'] = proposed_answer
        if question_id:
            feedback_entry['question_id'] = question_id  # Store as string, don't convert to ObjectId

        # Always insert into the same collection
        get_feedback_collection().insert_one(feedback_entry)
        
        print("Feedback submitted successfully:", feedback_entry)  # Debug print
        return jsonify({'message': 'Message feedback submitted successfully'}), 200
    except Exception as e:
        print("Error submitting feedback:", str(e))  # Debug print
        return jsonify({'error': f'An error occurred while submitting message feedback: {str(e)}'}), 500
    
@main.route('/about')
def about():
    try:
        changelog_path = os.path.join(current_app.root_path, '..', 'CHANGELOG.md')
        with open(changelog_path, 'r') as file:
            changelog_content = file.read()
        changelog_html = markdown2.markdown(changelog_content)
        return render_template('about.html', changelog_content=changelog_html)
    except Exception as e:
        current_app.logger.error(f"Error reading CHANGELOG.md: {str(e)}")
        return jsonify({'error': 'An internal error occurred while reading the changelog.'}), 500

@main.route('/changelog')
def changelog():
    try:
        # Adjust path if CHANGELOG.md is in the root directory
        changelog_path = os.path.join(current_app.root_path, '..', 'CHANGELOG.md')
        with open(changelog_path, 'r') as file:
            changelog_content = file.read()
        return render_template('index.html', changelog_content=changelog_content)
    except Exception as e:
        current_app.logger.error(f"Error reading CHANGELOG.md: {str(e)}")
        return jsonify({'error': 'An internal error occurred while reading the changelog.'}), 500

@main.route('/profile')
@login_required
def profile():
    return render_template('profile.html', user=current_user)

@main.route('/api/generate_answer', methods=['POST'])
@login_required
def generate_answer():
    data = request.json
    question = data.get('question')
    conversation_id = data.get('conversation_id')

    if not question:
        return jsonify({'error': 'Question is required.'}), 400

    try:
        # Get conversation context
        context, last_assistant_message = get_conversation_context(conversation_id) if conversation_id else ("", "")
        
        # Generate the question with context
        question_with_context = f"Context: {context}\n\nQuestion: {question}"
        
        # Generate the answer
        answer_data = generate_potential_answer_v2(question_with_context, last_assistant_message)
        return jsonify(answer_data), 200
    except Exception as e:
        current_app.logger.error(f"Error generating answer: {str(e)}")
        return jsonify({'error': 'An error occurred while generating the answer.'}), 500

@main.route('/api/user_feedback_status', methods=['GET', 'POST'])
@login_required
def user_feedback_status():
    try:
        user_id = current_user.id
        users_collection = get_users_collection()
        
        if request.method == 'GET':
            user = users_collection.find_one({'_id': ObjectId(user_id)})
            if user and 'feedback_status' in user:
                return jsonify({
                    'status': 'success',
                    'feedback_status': user['feedback_status'],
                    'last_feedback_interaction': user.get('last_feedback_interaction')
                }), 200
            else:
                return jsonify({
                    'status': 'success',
                    'feedback_status': 'not_interacted',
                    'last_feedback_interaction': None
                }), 200
        
        elif request.method == 'POST':
            result = users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'feedback_status': 'interacted',
                        'last_feedback_interaction': datetime.now()
                    }
                }
            )
            
            if result.modified_count > 0:
                return jsonify({'status': 'success', 'message': 'User feedback status updated'}), 200
            else:
                return jsonify({'status': 'error', 'message': 'User not found or status not updated'}), 404

    except Exception as e:
        current_app.logger.error(f"Error handling user feedback status: {str(e)}")
        return jsonify({'status': 'error', 'message': 'An error occurred while handling feedback status'}), 500

@main.route('/api/current_user_id', methods=['GET'])
@login_required
def get_current_user_id():
    try:
        return jsonify({'userId': current_user.id}), 200
    except Exception as e:
        current_app.logger.error(f"Error in get_current_user_id: {str(e)}")
        return jsonify({'error': 'Failed to get current user ID'}), 500

@main.route('/api/answer_feedback', methods=['POST'])
@login_required
def submit_answer_feedback():
    data = request.json
    logger.debug(f"Received feedback data: {data}")  # Add this line for debugging

    question_id = data.get('question_id')
    original_question = data.get('original_question')
    proposed_answer = data.get('proposed_answer')
    is_positive = data.get('is_positive')

    if not all([original_question, proposed_answer, is_positive is not None]):
        logger.error(f"Invalid feedback data: {data}")  # Add this line for debugging
        return jsonify({'error': 'Invalid feedback data'}), 400

    try:
        feedback_entry = {
            'user_id': ObjectId(current_user.id),
            'original_question': original_question,
            'proposed_answer': proposed_answer,
            'is_positive': is_positive,
            'timestamp': datetime.now()
        }
        
        if question_id:
            feedback_entry['matched_question_id'] = ObjectId(question_id)

        get_answer_feedback_collection().insert_one(feedback_entry)
        
        logger.info(f"Feedback submitted successfully: {feedback_entry}")  # Add this line for debugging
        return jsonify({'message': 'Answer feedback submitted successfully'}), 200
    except Exception as e:
        logger.error(f"Error submitting answer feedback: {str(e)}")
        return jsonify({'error': 'An error occurred while submitting answer feedback'}), 500

@main.route('/api/answer_feedback_stats', methods=['GET'])
@login_required
def get_answer_feedback_stats():
    if not current_user.is_admin:
        return jsonify({"error": "Unauthorized access"}), 403

    try:
        pipeline = [
            {
                '$group': {
                    '_id': {
                        '$ifNull': ['$matched_question_id', '$original_question']
                    },
                    'total_feedback': {'$sum': 1},
                    'positive_feedback': {
                        '$sum': {'$cond': ['$is_positive', 1, 0]}
                    },
                    'original_questions': {'$addToSet': '$original_question'},
                    'is_matched': {'$max': {'$cond': [{'$ifNull': ['$matched_question_id', False]}, True, False]}}
                }
            },
            {
                '$lookup': {
                    'from': 'documents',
                    'localField': '_id',
                    'foreignField': '_id',
                    'as': 'question_data'
                }
            },
            {
                '$project': {
                    'matched_question': {
                        '$cond': [
                            {'$eq': ['$question_data', []]},
                            {'$ifNull': [{'$arrayElemAt': ['$original_questions', 0]}, 'Unknown']},
                            {'$ifNull': [{'$arrayElemAt': ['$question_data.question', 0]}, 'Unknown']}
                        ]
                    },
                    'original_questions': 1,
                    'total_feedback': 1,
                    'positive_feedback': 1,
                    'effectiveness': {
                        '$cond': [
                            {'$eq': ['$total_feedback', 0]},
                            0,
                            {
                                '$multiply': [
                                    {'$divide': ['$positive_feedback', '$total_feedback']},
                                    100
                                ]
                            }
                        ]
                    },
                    'is_matched': 1
                }
            }
        ]
        
        stats = list(get_answer_feedback_collection().aggregate(pipeline))
        
        # Convert ObjectId to string, handle None values, and join original questions
        for stat in stats:
            if stat['_id'] is None:
                stat['_id'] = 'Unknown'
            elif isinstance(stat['_id'], ObjectId):
                stat['_id'] = str(stat['_id'])
            else:
                stat['_id'] = str(stat['_id'])  # Convert any other type to string
            
            stat['original_questions'] = '; '.join(set(filter(None, stat.get('original_questions', []))))
            
            # Ensure all fields are present
            stat.setdefault('matched_question', 'Unknown')
            stat.setdefault('total_feedback', 0)
            stat.setdefault('positive_feedback', 0)
            stat.setdefault('effectiveness', 0)
            stat.setdefault('is_matched', False)

        return jsonify(stats), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching answer feedback stats: {str(e)}")
        return jsonify({'error': 'An error occurred while fetching answer feedback stats'}), 500


@main.route('/api/overall_statistics', methods=['GET'])
@login_required
def get_overall_statistics():
    try:
        users_collection = get_collection('users')
        questions_collection = get_collection('documents')
        unanswered_collection = get_collection('unanswered_questions')
        feedback_collection = get_collection('feedback')
        answer_feedback_collection = get_collection('answer_feedback')

        if any(coll is None for coll in [users_collection, questions_collection, unanswered_collection, feedback_collection, answer_feedback_collection]):
            current_app.logger.error("Failed to get one or more collections")
            return jsonify({"error": "Database connection error"}), 500
        

        # Calculate statistics
        total_users = users_collection.count_documents({})
        total_questions = get_documents_collection().count_documents({})
        
        # Count answered questions from unanswered_collection
        answered_questions = unanswered_collection.count_documents({"answered": True})
        
        # Count total questions in unanswered_collection
        total_unanswered = unanswered_collection.count_documents({})
        
        # Calculate unanswered questions
        unanswered_questions = total_unanswered - answered_questions

        # Calculate average feedback rating
        feedback_pipeline = [
            {
                "$match": {
                    "rating": {"$exists": True, "$ne": None}
                }
            },
            {
                "$addFields": {
                    "numericRating": {
                        "$cond": {
                            "if": {"$eq": [{"$type": "$rating"}, "string"]},
                            "then": {"$toDouble": "$rating"},
                            "else": "$rating"
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_rating": {"$avg": "$numericRating"},
                    "count": {"$sum": 1}
                }
            }
        ]
        feedback_result = list(get_feedback_collection().aggregate(feedback_pipeline))
        
        if feedback_result:
            avg_rating = round(feedback_result[0]['avg_rating'], 2)
            rating_count = feedback_result[0]['count']
        else:
            avg_rating = "N/A"
            rating_count = 0

        # Calculate percentage of positive answer feedback
        answer_feedback_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_count": {"$sum": 1},
                    "positive_count": {
                        "$sum": {"$cond": [{"$eq": ["$is_positive", True]}, 1, 0]}
                    }
                }
            },
            {
                "$project": {
                    "positive_percentage": {
                        "$multiply": [
                            {"$divide": ["$positive_count", "$total_count"]},
                            100
                        ]
                    }
                }
            }
        ]
        answer_feedback_result = list(get_answer_feedback_collection().aggregate(answer_feedback_pipeline))
        
        if answer_feedback_result:
            positive_feedback_percentage = round(answer_feedback_result[0]['positive_percentage'], 2)
        else:
            positive_feedback_percentage = "N/A"

        # Prepare statistics object
        statistics = {
            "total_users": total_users,
            "total_questions": total_questions + total_unanswered,  # Include both collections
            "answered_questions": answered_questions + total_questions,  # Include answered from both collections
            "unanswered_questions": unanswered_questions,
            "average_rating": avg_rating,
            "rating_count": rating_count,
            "positive_feedback_percentage": positive_feedback_percentage
        }

        return jsonify(statistics), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching overall statistics: {str(e)}")
        return jsonify({"error": "An error occurred while fetching statistics"}), 500
        
@main.route('/statistics')
def statistics():
    # Get total users
    total_users = get_users_collection().count_documents({})

    # Get total questions
    total_questions = get_documents_collection().count_documents({})

    # Get answered questions
    answered_questions = get_documents_collection().count_documents({"status": "answered"})

    # Get unanswered questions
    unanswered_questions = get_documents_collection().count_documents({"status": "unanswered"})

    # Get top 5 categories
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_categories = list(get_documents_collection().aggregate(pipeline))

    # Prepare data for the template
    stats = {
        "total_users": total_users,
        "total_questions": total_questions,
        "answered_questions": answered_questions,
        "unanswered_questions": unanswered_questions,
        "top_categories": top_categories
    }

    return render_template('statistics.html', stats=stats)

@main.route('/api/conversations', methods=['GET'])
@login_required
def get_conversations():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))
    
    total = get_conversation_collection().count_documents({})
    
    conversations = list(get_conversation_collection().find()
                         .sort('last_updated', -1)
                         .skip((page - 1) * per_page)
                         .limit(per_page))
    
    serialized_conversations = []
    for conv in conversations:
        serialized_conv = {
            '_id': str(conv['_id']),
            'user_name': conv.get('user_name', 'Unknown User'),  # Assuming user_name is stored in the conversation document
            'last_updated': conv.get('last_updated', 'Unknown').isoformat() if isinstance(conv.get('last_updated'), datetime) else 'Unknown',
            'preview': [msg.get('content', '')[:50] + '...' for msg in conv.get('messages', [])[:2]]
        }
        serialized_conversations.append(serialized_conv)
    
    return jsonify({
        'conversations': serialized_conversations,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })

@main.route('/api/conversations/<conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    conversation = get_conversation_collection().find_one({'_id': ObjectId(conversation_id)})
    if conversation:
        serialized_conv = {
            '_id': str(conversation['_id']),
            'user_name': conversation.get('user_name', 'Unknown User'),
            'last_updated': conversation.get('last_updated', 'Unknown').isoformat() if isinstance(conversation.get('last_updated'), datetime) else 'Unknown',
            'messages': [
                {
                    'role': msg.get('role'),
                    'content': msg.get('content'),
                    'timestamp': msg.get('timestamp').isoformat() if isinstance(msg.get('timestamp'), datetime) else 'Unknown'
                }
                for msg in conversation.get('messages', [])
            ]
        }
        return jsonify(serialized_conv)
    else:
        return jsonify({'error': 'Conversation not found'}), 404
    
@main.route('/api/user_growth', methods=['GET'])
@login_required
def get_user_growth():
    try:
        users_collection = get_users_collection()
        if users_collection is None:
            current_app.logger.error("Failed to get users collection")
            return jsonify({"error": "Database connection error"}), 500

        pipeline = [
            {
                '$group': {
                    '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$created_at'}},
                    'count': {'$sum': 1}
                }
            },
            {'$sort': SON([('_id', 1)])}
        ]

        current_app.logger.info("Attempting to run aggregation pipeline")
        result = list(users_collection.aggregate(pipeline))
        current_app.logger.debug(f"Raw aggregation result: {result}")

        formatted_result = []
        for item in result:
            if item['_id'] is not None:
                try:
                    date = datetime.strptime(item['_id'], '%Y-%m-%d')
                    if date.year >= 2020:
                        formatted_result.append({
                            '_id': date.isoformat(),
                            'count': item['count']
                        })
                except ValueError:
                    current_app.logger.warning(f"Invalid date format: {item['_id']}")
            else:
                current_app.logger.warning("Encountered a None _id value")

        current_app.logger.info(f"User growth data: {formatted_result}")
        return jsonify(formatted_result)

    except Exception as e:
        current_app.logger.error(f"Error in get_user_growth: {str(e)}", exc_info=True)
        return jsonify({"error": "An internal error occurred"}), 500

@main.route('/api/events', methods=['GET'])
@login_required
def get_events():
    try:
        # Fetch all events from the database
        events = list(get_events_collection().find())

        # Process each event
        processed_events = []
        for event in events:
            # Convert ObjectId to string for JSON serialization
            event['_id'] = str(event['_id'])

            # Handle date_time field
            if 'date_time' in event and event['date_time']:
                if isinstance(event['date_time'], str):
                    # If date_time is already a string, just use it as is
                    date_time_str = event['date_time']
                else:
                    # If it's a datetime object, convert to ISO format
                    date_time = event['date_time']
                    if date_time.tzinfo is None or date_time.tzinfo.utcoffset(date_time) is None:
                        date_time = pytz.utc.localize(date_time)
                    date_time_str = date_time.isoformat()
            else:
                date_time_str = ''

            # Ensure all fields are present, even if they're empty
            processed_event = {
                '_id': event['_id'],
                'title': event.get('title', ''),
                'date_time': date_time_str,
                'time_zone': event.get('time_zone', ''),
                'address1': event.get('address1', ''),
                'address2': event.get('address2', ''),
                'city': event.get('city', ''),
                'state': event.get('state', ''),
                'postal_code': event.get('postal_code', ''),
                'country_code': event.get('country_code', ''),
                'registration_url': event.get('registration_url', ''),
                'feedback_url': event.get('feedback_url', ''),
                'location': event.get('location', {})
            }
            processed_events.append(processed_event)

        return jsonify(processed_events), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching events: {str(e)}")
        return jsonify({"error": "An error occurred while fetching events"}), 500

@main.route('/api/events/<event_id>', methods=['GET'])
@login_required
def get_event(event_id):
    try:
        event = get_events_collection().find_one({'_id': ObjectId(event_id)})
        if event:
            # Handle date_time field
            date_time = event.get('date_time')
            if date_time:
                if isinstance(date_time, str):
                    # If it's already a string, use it as is
                    date_time_str = date_time
                else:
                    # If it's a datetime object, convert to ISO format
                    if date_time.tzinfo is None or date_time.tzinfo.utcoffset(date_time) is None:
                        date_time = pytz.utc.localize(date_time)
                    date_time_str = date_time.isoformat()
            else:
                date_time_str = ''

            event_data = {
                '_id': str(event['_id']),
                'title': event.get('title', ''),
                'date_time': date_time_str,
                'time_zone': event.get('time_zone', ''),
                'address1': event.get('address1', ''),
                'address2': event.get('address2', ''),
                'city': event.get('city', ''),
                'state': event.get('state', ''),
                'postal_code': event.get('postal_code', ''),
                'country_code': event.get('country_code', ''),
                'registration_url': event.get('registration_url', ''),
                'feedback_url': event.get('feedback_url', '')
            }
            return jsonify(event_data)
        return jsonify({'error': 'Event not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error fetching event: {str(e)}")
        return jsonify({"error": "An error occurred while fetching the event"}), 500

@main.route('/api/events', methods=['POST'])
@login_required
def add_event():
    event_data = request.json
    
    # Validate required fields
    required_fields = ['title', 'date_time', 'time_zone', 'address1', 'city', 'state', 'postal_code', 'country_code']
    for field in required_fields:
        if field not in event_data or not event_data[field]:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    # Geocode the address
    location = geocode_address(
        event_data.get('address1'),
        event_data.get('address2'),
        event_data.get('city'),
        event_data.get('state'),
        event_data.get('postal_code'),
        event_data.get('country_code')
    )

    date_time_str = event_data.get('date_time')
    if date_time_str:
        try:
            # Parse the string to a datetime object
            date_time = datetime.fromisoformat(date_time_str.replace('Z', '+00:00'))
            # Ensure it's in UTC
            date_time = date_time.astimezone(pytz.utc)
            # Store it as an ISO format string
            event_data['date_time'] = date_time.isoformat()
        except ValueError:
            # If parsing fails, store the original string
            event_data['date_time'] = date_time_str
    else:
        event_data['date_time'] = ''

    if location:
        event_data['location'] = location
    
    event_data['feedback_url'] = event_data.get('feedback_url', '')

    result = get_events_collection().insert_one(event_data)
    event_data['_id'] = str(result.inserted_id)
    
    return jsonify({'message': 'Event added successfully', 'event': event_data}), 201

@main.route('/api/events/<event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    event_data = request.json
    
    required_fields = ['title', 'date_time', 'time_zone', 'address1', 'city', 'state', 'postal_code', 'country_code']
    for field in required_fields:
        if field not in event_data or not event_data[field]:
            return jsonify({'error': f'Missing required field: {field}'}), 400


    # Geocode the address
    location = geocode_address(
        event_data.get('address1'),
        event_data.get('address2'),
        event_data.get('city'),
        event_data.get('state'),
        event_data.get('postal_code'),
        event_data.get('country_code')
    )
    
    if location:
        event_data['location'] = location
    else:
        event_data.pop('location', None)
    
    date_time_str = event_data.get('date_time')
    if date_time_str:
        try:
            # Parse the string to a datetime object
            date_time = datetime.fromisoformat(date_time_str.replace('Z', '+00:00'))
            # Ensure it's in UTC
            date_time = date_time.astimezone(pytz.utc)
            # Store it as an ISO format string
            event_data['date_time'] = date_time.isoformat()
        except ValueError:
            # If parsing fails, store the original string
            event_data['date_time'] = date_time_str
    else:
        event_data['date_time'] = ''

    # Update feedback_url
    event_data['feedback_url'] = event_data.get('feedback_url', '')

    result = get_events_collection().update_one({'_id': ObjectId(event_id)}, {'$set': event_data})
    
    if result.modified_count:
        updated_event = get_events_collection().find_one({'_id': ObjectId(event_id)})
        if updated_event:
            updated_event['_id'] = str(updated_event['_id'])
            return jsonify({'message': 'Event updated successfully', 'event': updated_event})
    
    return jsonify({'error': 'Event not found or no changes made'}), 404

@main.route('/api/events/<event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    result = get_events_collection().delete_one({'_id': ObjectId(event_id)})
    if result.deleted_count:
        return jsonify({'message': 'Event deleted successfully'})
    return jsonify({'error': 'Event not found'}), 404

def geocode_address(address1, address2, city, state, postal_code, country_code):
    if not all([address1, city, state, postal_code, country_code]):
        return None  # Skip geocoding if essential fields are missing

    api_key = Config.GOOGLE_MAPS_API_KEY
    full_address = f"{address1}, {address2}, {city}, {state} {postal_code}, {country_code}"
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={full_address}&key={api_key}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['status'] == 'OK':
            location = data['results'][0]['geometry']['location']
            return {
                "type": "Point",
                "coordinates": [location['lng'], location['lat']]
            }
    return None

@main.route('/api/process_files', methods=['POST'])
def process_files():
    if 'files' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    files = request.files.getlist('files')
    similarity_threshold = float(request.form.get('similarity_threshold', current_app.config['SIMILARITY_THRESHOLD']))
    
    questions_added = 0
    
    for file in files:
        if file.filename == '':
            continue
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            content = extract_text_from_file(file_path)
            qa_pairs = process_content(content)
            
            for question, answer in qa_pairs:
                if save_to_mongodb(question, answer, similarity_threshold):
                    questions_added += 1
            
            os.remove(file_path)  # Remove the file after processing
    
    return jsonify({'questionsAdded': questions_added})

@main.route('/api/process_url', methods=['POST'])
def process_url():
    data = request.json
    url = data.get('url')
    similarity_threshold = float(data.get('similarity_threshold', current_app.config['SIMILARITY_THRESHOLD']))
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    content = fetch_content_from_url(url)
    qa_pairs = process_content(content)
    
    questions_added = 0
    for question, answer in qa_pairs:
        if save_to_mongodb(question, answer, similarity_threshold):
            questions_added += 1
    
    return jsonify({'questionsAdded': questions_added})

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pptx', 'docx', 'txt'}

@main.route('/admin/question_sources')
def question_sources():
    return render_template('question_sources.html')

@main.route('/api/admin/search_questions', methods=['GET'])
@login_required
def search_questions():
    if not current_user.is_admin:
        return jsonify({"error": "Unauthorized access"}), 403

    query = request.args.get('query', '')
    current_app.logger.info(f"Received search query: {query}")

    if not query:
        return jsonify({"error": "No search query provided"}), 400

    try:
        result = get_documents_collection().aggregate([
            {
                "$search": {
                    "index": "default",  # Make sure this matches your Atlas Search index name
                    "text": {
                        "query": query,
                        "path": ["question", "answer", "title"]  # Adjust based on your document structure
                    }
                }
            },
            {
                "$project": {
                    "_id": {"$toString": "$_id"},
                    "question": 1,
                    "answer": 1,
                    "title": 1,
                    "score": {"$meta": "searchScore"}
                }
            },
            {
                "$limit": 10  # Adjust as needed
            }
        ])

        questions = list(result)
        current_app.logger.info(f"Search results: {questions}")
        return jsonify(questions), 200

    except Exception as e:
        current_app.logger.error(f"Error searching questions: {str(e)}")
        return jsonify({"error": "An error occurred while searching questions"}), 500
    
@main.route('/api/autocomplete', methods=['GET'])
def autocomplete():
    prefix = request.args.get('prefix', '')
    if not prefix:
        return jsonify([]), 200

    try:
        pipeline = [
            {
                "$search": {
                    "index": "autocomplete",  # Make sure to create this index
                    "autocomplete": {
                        "query": prefix,
                        "path": "question",
                        "tokenOrder": "sequential"
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "question": 1,
                    "score": {"$meta": "searchScore"}
                }
            },
            {"$limit": 5}  # Adjust the number of suggestions as needed
        ]

        results = list(get_documents_collection().aggregate(pipeline))
        suggestions = [result['question'] for result in results]
        return jsonify(suggestions), 200
    except Exception as e:
        current_app.logger.error(f"Error in autocomplete: {str(e)}")
        return jsonify({"error": "An error occurred during autocomplete"}), 500
    
@main.route('/api/design_review', methods=['POST'])
def design_review():
    try:

        # Fetch current user's email
        user_email = getattr(current_user, 'email', 'Email not found')

        if not user_email:
            return jsonify({'error': 'User not authenticated'}), 401

        # Get form data
        full_name = request.form.get('full-name')
        company_name = request.form.get('company-name')
        application_status = request.form.get('application-status')
        model_ready = request.form.get('model-ready')
        project_description = request.form.get('project-description')
        skill_level = request.form.get('skill-level')
        requirements = request.form.getlist('requirements')
        data_size = request.form.get('data-size').lower.replace('gb', '').strip()
        uptime_sla = request.form.get('uptime-sla')
        cloud_provider = request.form.get('cloud-provider')
        team_members = request.form.get('team-members')
        team_goals = request.form.get('team-goals')
        sample_documents = request.files.getlist('sample-documents')
        sample_queries = request.files.getlist('sample-queries')

        # Save sample documents
        sample_doc_paths = []
        for file in sample_documents:
            if file:
                filename = secure_filename(file.filename)
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                sample_doc_paths.append(file_path)

        # Save sample queries
        sample_query_paths = []
        for file in sample_queries:
            if file:
                filename = secure_filename(file.filename)
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                sample_query_paths.append(file_path)

        # Calculate scores
        completeness_score = calculate_completeness_score(full_name, user_email, company_name, application_status, project_description, sample_doc_paths, sample_query_paths)
        skill_level_score = calculate_skill_level_score(skill_level)
        application_status_score = calculate_application_status_score(application_status)
        use_case_score = calculate_use_case_score(requirements)
        data_volume_score = calculate_data_volume_score(data_size)
        uptime_sla_score = calculate_uptime_sla_score(uptime_sla)
        previous_interaction_score = calculate_previous_interaction_score(team_members)  # Adjust as needed

        total_score = (completeness_score + skill_level_score + application_status_score + 
                       use_case_score + data_volume_score + uptime_sla_score + 
                       previous_interaction_score)

        # Log the data being inserted
        # Log the data being inserted
        review_request = {
            'user_email': user_email,  # Include user's email
            'full_name': full_name,
            'company_name': company_name,
            'application_status': application_status,  # This is the status of the customer's project
            'review_status': 'Pending',
            'model_ready': model_ready,
            'project_description': project_description,
            'skill_level': skill_level,
            'requirements': requirements,
            'data_size': data_size,
            'uptime_sla': uptime_sla,
            'cloud_provider': cloud_provider,
            'team_members': team_members,
            'team_goals': team_goals,
            'sample_documents': sample_doc_paths,
            'sample_queries': sample_query_paths,
            'completeness_score': completeness_score,
            'skill_level_score': skill_level_score,
            'application_status_score': application_status_score,
            'use_case_score': use_case_score,
            'data_volume_score': data_volume_score,
            'uptime_sla_score': uptime_sla_score,
            'previous_interaction_score': previous_interaction_score,
            'total_score': total_score
        }
        print(f"Review request data: {review_request}")

        # Save the request to MongoDB
        db = current_app.config['db']
        result = db.design_reviews.insert_one(review_request)
        print(f"Inserted ID: {result.inserted_id}")

        return jsonify({'message': 'Design Review request submitted successfully!'}), 200
    except Exception as e:
        print(f"Error in design_review: {e}")
        return jsonify({'error': 'Failed to submit Design Review request.'}), 500

@main.route('/api/design_reviews', methods=['GET'])
@login_required
def get_all_design_reviews():
    try:
        reviews = DesignReviewService.get_all_reviews()
        if reviews:
            serialized_reviews = []
            for review in reviews:
                serialized_review = {
                    '_id': str(review['_id']),
                    'full_name': review.get('full_name', 'N/A'),
                    'company_name': review.get('company_name', 'N/A'),
                    'application_status': review.get('application_status', 'N/A'),
                    'skill_level': review.get('skill_level', 'N/A'),
                    'total_score': review.get('total_score', 0),
                    'review_status': review.get('review_status', 'N/A'),
                    'review_details': review.get('review_details', '')
                }
                serialized_reviews.append(serialized_review)
            return jsonify(serialized_reviews), 200
        return jsonify({'message': 'No reviews found'}), 204
    except Exception as e:
        current_app.logger.error(f"Error fetching design reviews: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

    
@main.route('/api/design_reviews/<review_id>', methods=['GET'])
@login_required
def get_design_review(review_id):
    try:
        review = DesignReviewService.get_review(review_id)
        if review:
            # Use the custom JSONEncoder to handle ObjectId serialization
            return json.dumps(review, cls=JSONEncoder), 200, {'Content-Type': 'application/json'}
        return jsonify({'error': 'Review not found'}), 404
    except Exception as e:
        current_app.logger.error(f"Error fetching design review: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/design_reviews/<review_id>', methods=['PUT'])
@login_required
def update_design_review(review_id):
    try:
        current_app.logger.info(f"Received PUT request for review_id: {review_id}")
        data = request.json
        current_app.logger.info(f"Request data: {data}")

        if not data:
            current_app.logger.warning("No data provided in the request")
            return jsonify({'error': 'No data provided'}), 400

        # Validate the input data
        allowed_fields = ['what_we_heard', 'key_issues', 'what_we_advise', 'references']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        current_app.logger.info(f"Filtered update data: {update_data}")
        
        if not update_data:
            current_app.logger.warning("No valid fields to update")
            return jsonify({'error': 'No valid fields to update'}), 400

        # Update the review
        current_app.logger.info(f"Attempting to update review {review_id}")
        success, status = DesignReviewService.update_review(review_id, update_data)
        
        if success:
            if status == "Updated":
                current_app.logger.info(f"Successfully updated review {review_id}")
                return jsonify({'message': 'Review updated successfully', 'review_id': review_id}), 200
            elif status == "No changes":
                current_app.logger.info(f"No changes made to review {review_id}")
                return jsonify({'message': 'No changes were necessary', 'review_id': review_id}), 200
        else:
            if status == "Not found":
                current_app.logger.warning(f"Review {review_id} not found")
                return jsonify({'error': 'Design review not found'}), 404
            else:
                current_app.logger.error(f"Failed to update review {review_id}: {status}")
                return jsonify({'error': f'Failed to update the review: {status}'}), 500
    except Exception as e:
        current_app.logger.error(f"Error updating design review {review_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f'An error occurred while updating the review: {str(e)}'}), 500

@main.route('/api/design_reviews/<review_id>', methods=['DELETE'])
@login_required
def delete_design_review(review_id):
    try:
        if DesignReviewService.delete_review(review_id):
            return jsonify({'message': 'Design review request deleted successfully!'}), 200
        else:
            return jsonify({'error': 'Design review request not found.'}), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting design review: {str(e)}")
        return jsonify({'error': 'Failed to delete design review request.'}), 500

@main.route('/api/design_reviews/<review_id>/review', methods=['POST'])
def review_design_review(review_id):
    try:
        current_app.logger.info(f"Received review request for design review ID: {review_id}")
        
        review_details = request.form.get('review-details')
        transcript_file = request.files.get('transcript')

        current_app.logger.debug(f"Review details: {review_details}")
        current_app.logger.debug(f"Transcript file received: {bool(transcript_file)}")

        if transcript_file:
            filename = secure_filename(transcript_file.filename)
            transcript_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            transcript_file.save(transcript_path)
            current_app.logger.info(f"Transcript saved to: {transcript_path}")

            with open(transcript_path, 'r') as file:
                transcript_content = file.read()

            # Call OpenAI API to analyze the transcript
            # Note: Make sure you have the OpenAI API key configured
            response = openai.Completion.create(
                model="text-davinci-003",
                prompt=f"Analyze the following transcript for a MongoDB design review and provide recommendations based on MongoDB best practices:\n\n{transcript_content}",
                max_tokens=1000
            )

            llm_analysis = response.choices[0].text.strip()
            current_app.logger.info("LLM analysis completed")
        else:
            llm_analysis = "No transcript uploaded."
            current_app.logger.info("No transcript provided")

        design_reviews = get_collection('design_reviews')
        result = design_reviews.update_one(
            {'_id': ObjectId(review_id)},
            {'$set': {'review_details': review_details, 'llm_analysis': llm_analysis}}
        )
        
        if result.matched_count == 1:
            current_app.logger.info(f"Review submitted successfully for ID: {review_id}")
            return jsonify({'message': 'Review submitted successfully!', 'llm_analysis': llm_analysis}), 200
        else:
            current_app.logger.warning(f"Design review request not found for ID: {review_id}")
            return jsonify({'error': 'Design review request not found.'}), 404
    except Exception as e:
        current_app.logger.error(f"Error submitting review: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to submit review: {str(e)}'}), 500

@main.route('/api/design_reviews/<review_id>/upload_transcript', methods=['POST'])
@login_required
def upload_and_analyze_transcript(review_id):
    if 'transcript' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['transcript']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        try:
            filename = secure_filename(file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            
            DesignReviewService.update_transcript_path(review_id, file_path)
            analysis_result = DesignReviewService.analyze_transcript(review_id, file_path)
            
            if analysis_result:
                DesignReviewService.update_review_analysis(review_id, analysis_result)
                return jsonify(analysis_result), 200
            else:
                return jsonify({'error': 'Failed to analyze transcript'}), 500
        except Exception as e:
            current_app.logger.error(f"Error processing transcript: {str(e)}")
            return jsonify({'error': 'An error occurred while processing the transcript'}), 500
    
    return jsonify({'error': 'Invalid request'}), 400
    
@main.route('/api/design_reviews/<review_id>/summarize', methods=['POST'])
def summarize_transcription(review_id):
    review = get_design_review(review_id)
    if not review or 'transcription_path' not in review:
        return jsonify({'error': 'Transcription not found'}), 404

    with open(review['transcription_path'], 'r') as file:
        transcription_text = file.read()

    summary = summarize_text(transcription_text)
    
    # Update the design review document with the summaries
    update_design_review(review_id, {
        'what_we_heard': summary['what_we_heard'],
        'key_issues': summary['key_issues'],
        'what_we_recommend': summary['what_we_recommend'],
        'references': summary['references']
    })

    return jsonify(summary), 200
    

@main.route('/request-design-review')
def request_design_review():
    return render_template('design_review_request.html')

@main.route('/api/design_reviews', methods=['POST'])
@login_required
def submit_design_review():
    try:
        data = request.json
        current_app.logger.info(f"Received design review submission: {data}")

        if not data:
            current_app.logger.error("No data provided in the request")
            return jsonify({'error': 'No data provided'}), 400

        # Convert hyphenated keys to underscore keys
        converted_data = {k.replace('-', '_'): v for k, v in data.items()}

        # Validate required fields
        required_fields = ['full_name', 'company_name', 'application_status', 'skill_level']
        for field in required_fields:
            if field not in converted_data:
                current_app.logger.error(f"Missing required field: {field}")
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Convert data size to integer (GB)
        data_size_str = converted_data.get('data_size', '0').lower().replace('gb', '').strip()
        try:
            data_size = int(float(data_size_str))
            converted_data['data_size'] = f"{data_size}GB"
        except ValueError:
            return jsonify({'error': 'Invalid data size format. Please enter a number in GB.'}), 400

        # Set initial status
        converted_data['status'] = 'SUBMITTED'

        # Add user_id and timestamp
        converted_data['user_id'] = current_user.id
        converted_data['submitted_at'] = datetime.utcnow()

        # Calculate scores
        converted_data['completeness_score'] = DesignReviewService.calculate_completeness_score(converted_data)
        converted_data['skill_level_score'] = DesignReviewService.calculate_skill_level_score(converted_data.get('skill_level'))
        converted_data['application_status_score'] = DesignReviewService.calculate_application_status_score(converted_data.get('application_status'))
        converted_data['use_case_score'] = DesignReviewService.calculate_use_case_score(converted_data.get('requirements', []))
        converted_data['data_volume_score'] = DesignReviewService.calculate_data_volume_score(converted_data.get('data_size'))
        converted_data['uptime_sla_score'] = DesignReviewService.calculate_uptime_sla_score(converted_data.get('uptime_sla'))
        converted_data['previous_interaction_score'] = DesignReviewService.calculate_previous_interaction_score(converted_data.get('team_members'))

        converted_data['total_score'] = sum([
            converted_data['completeness_score'],
            converted_data['skill_level_score'],
            converted_data['application_status_score'],
            converted_data['use_case_score'],
            converted_data['data_volume_score'],
            converted_data['uptime_sla_score'],
            converted_data['previous_interaction_score']
        ])

        # Determine opportunity level
        if converted_data['total_score'] >= 80:
            converted_data['opportunity_level'] = 'High'
        elif converted_data['total_score'] >= 50:
            converted_data['opportunity_level'] = 'Medium'
        else:
            converted_data['opportunity_level'] = 'Low'

        # Insert the document into the database
        result = DesignReviewService.create_review(converted_data)
        
        if result:
            return jsonify({
                'message': 'Design review request submitted successfully', 
                'id': result,
                'total_score': converted_data['total_score'],
                'opportunity_level': converted_data['opportunity_level']
            }), 201
        else:
            return jsonify({'error': 'Failed to submit design review request'}), 500

    except Exception as e:
        current_app.logger.error(f"Error in submit_design_review: {str(e)}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred', 'details': str(e)}), 500

@main.route('/api/design_reviews/<review_id>/accept', methods=['POST'])
@login_required
def accept_design_review(review_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    if DesignReviewService.accept_review(review_id, current_user.id):
        return jsonify({'message': 'Design review accepted'}), 200
    return jsonify({'error': 'Failed to accept design review'}), 400

@main.route('/api/design_reviews/<review_id>/reject', methods=['POST'])
@login_required
def reject_design_review(review_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    if DesignReviewService.reject_review(review_id, current_user.id):
        return jsonify({'message': 'Design review rejected'}), 200
    return jsonify({'error': 'Failed to reject design review'}), 400

@main.route('/api/design_reviews/<review_id>/assign', methods=['POST'])
@login_required
def assign_design_review(review_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    reviewer_id = request.json.get('reviewer_id')
    if DesignReviewService.assign_reviewer(review_id, reviewer_id):
        return jsonify({'message': 'Reviewer assigned successfully'}), 200
    return jsonify({'error': 'Failed to assign reviewer'}), 400

@main.route('/api/design_reviews/<review_id>/schedule', methods=['POST'])
@login_required
def schedule_design_review(review_id):
    review = DesignReviewService.get_review(review_id)
    if str(review['assigned_reviewer_id']) != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    if DesignReviewService.schedule_review(review_id):
        return jsonify({'message': 'Design review scheduled'}), 200
    return jsonify({'error': 'Failed to schedule design review'}), 400

@main.route('/api/design_reviews/<review_id>/complete', methods=['POST'])
@login_required
def complete_design_review(review_id):
    review = DesignReviewService.get_review(review_id)
    if str(review['assigned_reviewer_id']) != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    if DesignReviewService.complete_review(review_id):
        return jsonify({'message': 'Design review completed'}), 200
    return jsonify({'error': 'Failed to complete design review'}), 400

@main.route('/api/design_reviews/<review_id>/send_report', methods=['POST'])
@login_required
def send_design_review_report(review_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    if DesignReviewService.send_report(review_id):
        return jsonify({'message': 'Report sent successfully'}), 200
    return jsonify({'error': 'Failed to send report'}), 400