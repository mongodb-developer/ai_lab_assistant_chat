import os
import json  # Ensure json is imported
import traceback  # Ensure traceback is imported
import logging
from flask import Blueprint, request, jsonify, render_template, current_app, session, send_from_directory
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

from app.utils import (
    generate_embedding,
    search_similar_questions,
    add_question_answer,
    check_database_connection,
    get_collection_stats,
    json_serialize,
    fetch_changelog,
    store_message,
    generate_title,
    generate_references,
    generate_summary,
    get_user_conversations,
    get_conversation_messages,
    get_conversation_context,
    generate_potential_answer_v2,
    start_new_conversation,  # Ensure this is imported
    add_unanswered_question,  # Ensure this is imported
    is_event_related_question,
    fetch_relevant_events, 
    format_events_response,
    get_db_connection,
    update_user_login_info

)
import openai

from werkzeug.exceptions import HTTPException

main = Blueprint('main', __name__)

def custom_json_encoder(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
    

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
feedback_collection = db['feedback']
events_collection = db['events']

# Default sessions
DEFAULT_SESSIONS = [
    {"name": "Data Modeling", "instructor": ""},
    {"name": "Intro Lab", "instructor": ""},
    {"name": "Aggregations", "instructor": ""},
    {"name": "Atlas Search", "instructor": ""},
    {"name": "VectorSearch", "instructor": ""}
]
SIMILARITY_THRESHOLD = float(Config.SIMILARITY_THRESHOLD)  # Ensure this is float

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

            db = get_db_connection()
            users_collection = db['users']
            current_app.logger.debug(f"Fetching user data for id: {current_user.id}")
            user_data = users_collection.find_one({'_id': ObjectId(current_user.id)})

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

# Route: Chat
# Description: Renders the chat page of the application
# Parameters: None
# Returns: Rendered index.html template with is_chat=True
@main.route('/chat')
@login_required
def chat():
    try:
        current_app.logger.debug(f"Request received for chat route")
        
        return render_template('index.html', is_chat=True)
    except Exception as e:
        current_app.logger.error(f"Error in chat route: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 500
    
# Route: Chat API
# Description: Handles chat messages, processes them, and returns responses
# Parameters: None (expects JSON payload in request)
# Returns: JSON response with answer or error message
# Route: Chat API
# Description: Handles chat messages, processes them, and returns responses
# Parameters: None (expects JSON payload in request)
# Returns: JSON response with answer or error message
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
        title = user_question[:50]
        
        # Start a new conversation if no active conversation exists
        conversation_id = start_new_conversation(user_id, title)
        
        store_message(user_id, user_question, 'User', conversation_id)

        # Generate the question embedding
        question_embedding, embed_debug = generate_embedding(user_question)
        debug_info['embedding'] = embed_debug

        # Search for similar questions
        similar_questions = search_similar_questions(question_embedding, user_question)

        response_data = {}
        
        if similar_questions and similar_questions[0]['combined_score'] > SIMILARITY_THRESHOLD:
            response_message = similar_questions[0]['answer']
            response_data = {
                'question': similar_questions[0]['question'],
                'answer': response_message,
                'score': similar_questions[0]['combined_score'],
                'title': similar_questions[0].get('title', ''),
                'summary': similar_questions[0].get('summary', ''),
                'references': similar_questions[0].get('references', ''),
                'usage_count': similar_questions[0].get('usage_count', 0) + 1,
                'debug_info': debug_info
            }
        else:
            # Add the unanswered question to the unanswered_questions collection
            response_message = 'This question has not been specifically answered for MongoDB Developer Days. However, here is some information I found that may assist you.</br>'
            potential_answer_data = generate_potential_answer_v2(user_question)

            response_data = {
                'error': response_message,
                'answer': potential_answer_data['answer'],
                'title': response_message + "<br>\n" + potential_answer_data.get('title', ''),
                'summary': potential_answer_data.get('summary', ''),
                'references': potential_answer_data.get('references', ''),
                'debug_info': debug_info
            }
            add_unanswered_question(user_id, user_name, user_question, response_data)

    
        store_message(user_id, response_message, 'Assistant', conversation_id)
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
            insert_result = documents_collection.insert_one(new_document)
            
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

        result = documents_collection.update_one(
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

@main.route('/feedback')
def feedback():
    try:
        current_app.logger.info("Accessing feedback route")
        return render_template('feedback.html')
    except Exception as e:
        current_app.logger.error(f"Error in feedback route: {str(e)}")
        return jsonify({"error": "An internal error occurred"}), 500

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
            'timestamp': datetime.utcnow()
        }
        
        if question_id:
            feedback_entry['matched_question_id'] = ObjectId(question_id)

        db.answer_feedback.insert_one(feedback_entry)
        
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
        
        stats = list(db.answer_feedback.aggregate(pipeline))
        
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
        # Get database collections
        users_collection = db.users
        questions_collection = db.questions
        unanswered_collection = db.unanswered_questions
        feedback_collection = db.feedback
        answer_feedback_collection = db.answer_feedback

        # Calculate statistics
        total_users = users_collection.count_documents({})
        total_questions = questions_collection.count_documents({})
        
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
                    "rating": {"$exists": True, "$ne": None},
                    "$expr": {"$ne": [{"$type": "$rating"}, "string"]}  # Exclude string ratings
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_rating": {"$avg": {"$toInt": "$rating"}},
                    "count": {"$sum": 1}
                }
            }
        ]
        feedback_result = list(feedback_collection.aggregate(feedback_pipeline))
        
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
        answer_feedback_result = list(answer_feedback_collection.aggregate(answer_feedback_pipeline))
        
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
    total_users = db.users.count_documents({})

    # Get total questions
    total_questions = db.questions.count_documents({})

    # Get answered questions
    answered_questions = db.questions.count_documents({"status": "answered"})

    # Get unanswered questions
    unanswered_questions = db.questions.count_documents({"status": "unanswered"})

    # Get top 5 categories
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_categories = list(db.questions.aggregate(pipeline))

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
    
    total = conversation_collection.count_documents({})
    
    conversations = list(conversation_collection.find()
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
    conversation = conversation_collection.find_one({'_id': ObjectId(conversation_id)})
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
    pipeline = [
        {
            '$group': {
                '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$created_at'}},
                'count': {'$sum': 1}
            }
        },
        {'$sort': {'_id': 1}}
    ]
    result = list(db.users.aggregate(pipeline))
    
    # Convert string dates to ISO format, handle None values, and filter out dates before 2020
    formatted_result = []
    for item in result:
        if item['_id'] is not None:
            try:
                date = datetime.strptime(item['_id'], '%Y-%m-%d')
                if date.year >= 2020:  # Filter out dates before 2020
                    formatted_result.append({
                        '_id': date.isoformat(),
                        'count': item['count']
                    })
            except ValueError:
                print(f"Invalid date format: {item['_id']}")
        else:
            print("Encountered a None _id value")
    
    print("User growth data:", formatted_result)
    return jsonify(formatted_result)

@main.route('/api/events', methods=['GET'])
@login_required
def get_events():
    try:
        # Fetch all events from the database
        events = list(db.events.find())

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
        event = db.events.find_one({'_id': ObjectId(event_id)})
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

    result = db.events.insert_one(event_data)
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

    result = db.events.update_one({'_id': ObjectId(event_id)}, {'$set': event_data})
    
    if result.modified_count:
        updated_event = db.events.find_one({'_id': ObjectId(event_id)})
        if updated_event:
            updated_event['_id'] = str(updated_event['_id'])
            return jsonify({'message': 'Event updated successfully', 'event': updated_event})
    
    return jsonify({'error': 'Event not found or no changes made'}), 404

@main.route('/api/events/<event_id>', methods=['DELETE'])
@login_required
def delete_event(event_id):
    result = db.events.delete_one({'_id': ObjectId(event_id)})
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
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
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
        result = db.documents.aggregate([
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

        results = list(db.documents.aggregate(pipeline))
        suggestions = [result['question'] for result in results]
        return jsonify(suggestions), 200
    except Exception as e:
        current_app.logger.error(f"Error in autocomplete: {str(e)}")
        return jsonify({"error": "An error occurred during autocomplete"}), 500