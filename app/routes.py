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
    get_conversation_context,
    generate_potential_answer_v2,
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
    conversation_id = data.get('conversation_id')
    
    try:
        user_id = current_user.get_id()
        user_name = current_user.name

        # Get or create a conversation
        if not conversation_id:
            conversation_id = start_new_conversation(user_id, user_question[:50])
        
        # Store the user's message
        store_message(user_id, user_question, 'User', conversation_id)

        # Get conversation context
        context, last_assistant_message = get_conversation_context(conversation_id)

        # Generate the question embedding
        question_embedding, embed_debug = generate_embedding(user_question)
        debug_info['embedding'] = embed_debug

        # Search for similar questions in the documents collection
        similar_questions, search_debug = search_similar_questions(question_embedding)
        debug_info['search'] = search_debug

        if similar_questions and similar_questions[0]['score'] > SIMILARITY_THRESHOLD:
            # Use the existing answer from the documents collection
            best_match = similar_questions[0]
            response_message = best_match['answer']
            response_data = {
                'question_id': str(best_match['_id']),
                'question': best_match['question'],
                'answer': response_message,
                'score': best_match['score'],
                'title': best_match.get('title', ''),
                'summary': best_match.get('summary', ''),
                'references': best_match.get('references', ''),
                'usage_count': best_match.get('usage_count', 0) + 1,
                'debug_info': debug_info
            }
        else:
            # Generate a potential answer using the context
            question_with_context = f"Context: {context}\n\nQuestion: {user_question}"
            potential_answer_data = generate_potential_answer_v2(question_with_context, last_assistant_message)
            
            response_message = potential_answer_data['answer']
            response_data = {
                'answer': response_message,
                'title': potential_answer_data.get('title', ''),
                'summary': potential_answer_data.get('summary', ''),
                'references': potential_answer_data.get('references', ''),
                'debug_info': debug_info
            }
            # Add the question to the unanswered_questions collection
            add_unanswered_question(user_id, user_name, user_question, response_data)
        
        # Store the assistant's response
        store_message(user_id, response_message, 'Assistant', conversation_id)

        response_data['conversation_id'] = str(conversation_id)
        return jsonify(response_data), 200

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
    
    # Convert string dates to ISO format, handle None values
    formatted_result = []
    for item in result:
        if item['_id'] is not None:
            try:
                date = datetime.strptime(item['_id'], '%Y-%m-%d').isoformat()
                formatted_result.append({
                    '_id': date,
                    'count': item['count']
                })
            except ValueError:
                print(f"Invalid date format: {item['_id']}")
        else:
            print("Encountered a None _id value")
    
    print("User growth data:", formatted_result)  # Add this line for debugging
    return jsonify(formatted_result)