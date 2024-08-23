# knowledge_graph.py

import sys
import os
import json
import openai
from pymongo import MongoClient
from dotenv import load_dotenv
import json
import logging

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the parent directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.utils import get_collection, generate_embedding, with_db_connection
from app.config import Config

# Load environment variables
load_dotenv()

# Set up OpenAI API key
openai.api_key = os.getenv('OPENAI_API_KEY')

def extract_concepts_and_relations(text):
    """
    Use OpenAI's API to extract concepts and their relationships from given text.
    """
    prompt = f"""
    Extract key MongoDB concepts and their relationships from the following text:
    {text}
    
    Format the output as a list of JSON objects, each containing:
    - concept: The main concept
    - related_concepts: A list of related concepts
    - relationship: A brief description of how they are related

    Ensure the output is a valid JSON array.
    """
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts MongoDB concepts and their relationships."},
                {"role": "user", "content": prompt}
            ]
        )
        
        content = response['choices'][0]['message']['content'].strip()
        logger.debug(f"OpenAI API response: {content}")
        
        # Attempt to parse the content as JSON
        try:
            parsed_content = json.loads(content)
            if isinstance(parsed_content, list):
                return parsed_content
            else:
                logger.warning("API response is not a list. Wrapping in a list.")
                return [parsed_content]
        except json.JSONDecodeError:
            logger.warning("Failed to parse API response as JSON. Attempting to extract JSON-like content.")
            # Try to extract JSON-like content from the response
            import re
            json_like_content = re.search(r'\[.*\]', content, re.DOTALL)
            if json_like_content:
                return json.loads(json_like_content.group())
            else:
                logger.error("Could not extract valid JSON from the API response.")
                return []
    
    except Exception as e:
        logger.error(f"Error in API call or processing: {str(e)}")
        return []

def populate_knowledge_graph():
    """
    Analyze existing questions and answers to populate the knowledge graph.
    """
    client = MongoClient(Config.MONGODB_URI)
    db = client[Config.MONGODB_DB]
    documents_collection = db['documents']
    knowledge_graph_collection = db['knowledge_graph']
    
    total_documents = documents_collection.count_documents({})
    processed_documents = 0

    for doc in documents_collection.find():
        try:
            text = f"{doc.get('question', '')} {doc.get('answer', '')}"
            concepts = extract_concepts_and_relations(text)
            
            for concept in concepts:
                knowledge_graph_collection.update_one(
                    {'concept': concept['concept']},
                    {'$addToSet': {
                        'related_concepts': {
                            '$each': [{'concept': rc, 'relationship': concept['relationship']} for rc in concept.get('related_concepts', [])]
                        }
                    }},
                    upsert=True
                )
            
            processed_documents += 1
            if processed_documents % 10 == 0:  # Log progress every 10 documents
                logger.info(f"Processed {processed_documents}/{total_documents} documents")
        
        except Exception as e:
            logger.error(f"Error processing document {doc.get('_id')}: {str(e)}")
    
    logger.info(f"Knowledge graph population complete. Processed {processed_documents}/{total_documents} documents.")
    client.close()

if __name__ == "__main__":
    populate_knowledge_graph()
