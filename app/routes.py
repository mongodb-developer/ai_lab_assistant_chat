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
    generate_potential_answer,
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
feedback_collection = db['feedback']
SIMILARITY_THRESHOLD = float(Config.SIMILARITY_THRESHOLD)  # Ensure this is float

# Route: Index
# Description: Renders the main page of the application
# Parameters: None
# Returns: Rendered index.html template
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
@main.route('/api/chat', methods=['POST'])
@login_required
def chat_api():
    debug_info = {}
    data = request.json
    user_question = data.get('question', '')
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
        # title = user_question[:50]  # Use the first 50 characters of the question as the title
        title = user_question  # Use the first 50 characters of the question as the title
        
        # Start a new conversation if no active conversation exists
        conversation_id = start_new_conversation(user_id, title)
        
        store_message(user_id, user_question, 'User', conversation_id)

        # Generate the question embedding
        question_embedding, embed_debug = generate_embedding(user_question)
        if not question_embedding:
            raise ValueError("Failed to generate embedding")
        
        debug_info['embedding'] = embed_debug

        # Search for similar questions
        similar_questions, search_debug = search_similar_questions(question_embedding)
        debug_info['search'] = search_debug

        response_data = {}
        
        if similar_questions and similar_questions[0]['score'] > SIMILARITY_THRESHOLD:
            response_message = similar_questions[0]['answer']
            response_data = {
                'question_id': str(similar_questions[0]['_id']),  # Include this
                'question': similar_questions[0]['question'],
                'answer': response_message,
                'score': similar_questions[0]['score'],
                'title': similar_questions[0].get('title', ''),
                'summary': similar_questions[0].get('summary', ''),
                'references': similar_questions[0].get('references', ''),
                'usage_count': similar_questions[0].get('usage_count', 0) + 1,
                'debug_info': debug_info
            }
        else:
            # Add the unanswered question to the unanswered_questions collection
            response_message = 'This question has not been specifically answered for MongoDB Developer Days. However, here is some information I found that may assist you.'
            potential_answer_data = generate_potential_answer(user_question)

            response_data = {
                'error': response_message,
                'potential_answer': potential_answer_data.get('answer'),
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
        return jsonify({
            "error": str(e),
            "debug_info": {
                "request": {
                    "method": request.method,
                    "headers": dict(request.headers),
                    "json": request.json
                },
                "error": str(e),
                "traceback": traceback.format_exc()
            }
        }), 500

# Function: generate_potential_answer
# Description: Generates a potential answer for a given question using OpenAI's GPT model
# Parameters:
#   - question: str, the user's question
# Returns: dict containing title, summary, answer, and references
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

# Route: Get Questions
# Description: Retrieves all questions from the database
# Parameters: None
# Returns: JSON array of questions
@main.route('/api/questions', methods=['GET'])
@login_required
def get_questions():
    try:
        questions = list(documents_collection.find())
        for question in questions:
            question['_id'] = str(question['_id'])
        current_app.logger.info(f"Fetched {len(questions)} questions")
        return jsonify(questions), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching questions: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/api/questions', methods=['POST'])
@login_required
def add_question():
    debug_info = {}
    try:
        current_app.logger.info(f"Received request data: {request.data}")
        current_app.logger.info(f"Received JSON: {request.json}")
        
        data = request.json
        if not data:
            raise ValueError("No JSON data received in the request")

        if 'question' not in data or 'answer' not in data:
            raise ValueError(f"Missing 'question' or 'answer' in request payload. Received keys: {', '.join(data.keys())}")

        question = data['question']
        answer = data['answer']
        
        # ... rest of the function ...

    except ValueError as e:
        current_app.logger.error(f"Value error in add_question route: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        current_app.logger.error(f"Error in add_question route: {str(e)}")
        return jsonify({'error': 'An internal error occurred'}), 500

@main.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(current_app.root_path, 'static'), 'favicon.ico')


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
            documents_collection.insert_one({
                'question': unanswered_question['question'],
                'question_embedding': question_embedding,
                'answer': answer,
                'title': title,
                'summary': summary,
                'references': references,
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

@main.route('/about')
def about():
    try:
        # Adjust path if CHANGELOG.md is in the root directory
        changelog_path = os.path.join(current_app.root_path, '..', 'CHANGELOG.md')
        with open(changelog_path, 'r') as file:
            changelog_content = file.read()
        return render_template('about.html', changelog_content=changelog_content)
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

    if not question:
        return jsonify({'error': 'Question is required.'}), 400

    try:
        answer_data = generate_potential_answer(question)
        return jsonify(answer_data), 200
    except Exception as e:
        current_app.logger.error(f"Error generating answer: {str(e)}")
        return jsonify({'error': 'An error occurred while generating the answer.'}), 500
    
@main.route('/api/answer_feedback', methods=['POST'])
@login_required
def submit_answer_feedback():
    data = request.json
    question_id = data.get('question_id')
    original_question = data.get('original_question')
    proposed_answer = data.get('proposed_answer')
    is_positive = data.get('is_positive')

    if not all([question_id, original_question, proposed_answer, is_positive is not None]):
        return jsonify({'error': 'Invalid feedback data'}), 400

    try:
        db.answer_feedback.insert_one({
            'user_id': ObjectId(current_user.id),
            'original_question': original_question,
            'matched_question_id': ObjectId(question_id),
            'proposed_answer': proposed_answer,
            'is_positive': is_positive,
            'timestamp': datetime.utcnow()
        })
        return jsonify({'message': 'Answer feedback submitted successfully'}), 200
    except Exception as e:
        current_app.logger.error(f"Error submitting answer feedback: {str(e)}")
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
                    '_id': '$matched_question_id',
                    'total_feedback': {'$sum': 1},
                    'positive_feedback': {
                        '$sum': {'$cond': ['$is_positive', 1, 0]}
                    },
                    'original_questions': {'$addToSet': '$original_question'}
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
            {'$unwind': '$question_data'},
            {
                '$project': {
                    'matched_question': '$question_data.question',
                    'original_questions': 1,
                    'total_feedback': 1,
                    'positive_feedback': 1,
                    'effectiveness': {
                        '$multiply': [
                            {'$divide': ['$positive_feedback', '$total_feedback']},
                            100
                        ]
                    }
                }
            }
        ]
        
        stats = list(db.answer_feedback.aggregate(pipeline))
        
        # Convert ObjectId to string and join original questions
        for stat in stats:
            if '_id' in stat:
                stat['_id'] = str(stat['_id'])
            stat['original_questions'] = '; '.join(set(stat['original_questions']))

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
        unquestions_collection = db.unanswered_questions
        feedback_collection = db.feedback

        # Calculate statistics
        total_users = users_collection.count_documents({})
        total_questions = questions_collection.count_documents({})
        answered_questions = questions_collection.count_documents({"answer": {"$exists": True, "$ne": ""}})
        unanswered_questions = unquestions_collection.count_documents({})

        # Calculate average feedback rating
        feedback_pipeline = [
            {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
        ]
        feedback_result = list(feedback_collection.aggregate(feedback_pipeline))
        avg_rating = feedback_result[0]['avg_rating'] if feedback_result else None

        # Prepare statistics object
        statistics = {
            "total_users": total_users,
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "unanswered_questions": unanswered_questions,
            "average_rating": round(avg_rating, 2) if avg_rating is not None else "No ratings yet"
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