import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime
import logging
from bson import ObjectId

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection details
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB = os.getenv('MONGODB_DB')

def get_db_connection():
    try:
        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB]
        logger.info("Successfully connected to MongoDB")
        return db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        sys.exit(1)

def migrate_data(db, dry_run=False):
    documents = db.documents
    unanswered = db.unanswered_questions
    questions = db.questions

    total_docs = 0
    migrated_docs = 0

    # Migrate answered questions
    for doc in documents.find():
        total_docs += 1
        try:
            new_doc = {
                'question': doc['question'],
                'answer': doc['answer'],
                'title': doc.get('title', ''),
                'summary': doc.get('summary', ''),
                'references': doc.get('references', ''),
                'status': 'answered',
                'created_at': doc.get('created_at', datetime.utcnow()),
                'updated_at': doc.get('updated_at', datetime.utcnow()),
                'user_id': str(doc.get('user_id', '')),
                'user_name': doc.get('user_name', ''),
                'question_embedding': doc.get('question_embedding', []),
                'answer_embedding': doc.get('answer_embedding', []),
                'module': doc.get('module', '')
            }
            
            if not dry_run:
                result = questions.insert_one(new_doc)
                if result.inserted_id:
                    migrated_docs += 1
                    logger.info(f"Migrated answered question: {doc['_id']}")
                else:
                    logger.warning(f"Failed to migrate answered question: {doc['_id']}")
            else:
                migrated_docs += 1
                logger.info(f"Would migrate answered question: {doc['_id']}")
        
        except Exception as e:
            logger.error(f"Error migrating answered question {doc['_id']}: {str(e)}")

    # Migrate unanswered questions
    for doc in unanswered.find():
        total_docs += 1
        try:
            new_doc = {
                'question': doc['question'],
                'answer': doc.get('answer', ''),
                'title': doc.get('title', ''),
                'summary': doc.get('summary', ''),
                'references': doc.get('references', ''),
                'status': 'unanswered',
                'created_at': doc.get('timestamp', datetime.utcnow()),
                'updated_at': datetime.utcnow(),
                'user_id': str(doc.get('user_id', '')),
                'user_name': doc.get('user_name', ''),
                'module': doc.get('module', '')
            }
            
            if not dry_run:
                result = questions.insert_one(new_doc)
                if result.inserted_id:
                    migrated_docs += 1
                    logger.info(f"Migrated unanswered question: {doc['_id']}")
                else:
                    logger.warning(f"Failed to migrate unanswered question: {doc['_id']}")
            else:
                migrated_docs += 1
                logger.info(f"Would migrate unanswered question: {doc['_id']}")
        
        except Exception as e:
            logger.error(f"Error migrating unanswered question {doc['_id']}: {str(e)}")

    logger.info(f"Migration {'would be ' if dry_run else ''}completed. "
                f"Total documents: {total_docs}, Migrated documents: {migrated_docs}")

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--dry-run':
        dry_run = True
        logger.info("Performing a dry run. No changes will be made to the database.")
    else:
        dry_run = False
        logger.info("Performing actual migration. Changes will be made to the database.")

    db = get_db_connection()
    migrate_data(db, dry_run)

if __name__ == "__main__":
    main()