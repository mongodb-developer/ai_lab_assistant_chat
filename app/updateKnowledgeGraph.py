# update_knowledge_graph.py

import os
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

from app import create_app
from app.utils import get_collection, generate_embedding
from config import Config
import openai
from flask import current_app

def update_knowledge_graph_descriptions():
    """
    Update the knowledge_graph collection by adding descriptions to documents that don't have one.
    This script uses OpenAI's API to generate descriptions for concepts in the documents.
    """
    app = create_app()
    with app.app_context():
        try:
            knowledge_graph_collection = get_collection('knowledge_graph')
            if knowledge_graph_collection is None:
                current_app.logger.error("Failed to get knowledge_graph collection")
                return

            # Find documents without a description
            # documents_to_update = knowledge_graph_collection.find({"description": {"$exists": False}})
            documents_to_update = knowledge_graph_collection.find({})

            openai.api_key = Config.OPENAI_API_KEY

            for doc in documents_to_update:
                concept = doc.get('concept', '')
                if not concept:
                    continue

                try:
                    # Generate description using OpenAI
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": "You are a helpful assistant that provides concise descriptions of mongodb related concepts."},
                            {"role": "user", "content": f"Provide a brief description of the concept in the context of MongoDB, and specifically MongoDB Developer Days Content: {concept}"}
                        ],
                        max_tokens=100
                    )

                    description = response.choices[0].message['content'].strip()

                    # Update the document with the new description
                    knowledge_graph_collection.update_one(
                        {"_id": doc["_id"]},
                        {"$set": {"description": description}}
                    )

                    current_app.logger.info(f"Updated description for concept: {concept}")

                except Exception as e:
                    current_app.logger.error(f"Error updating description for concept {concept}: {str(e)}")

            current_app.logger.info("Finished updating knowledge graph descriptions")

        except Exception as e:
            current_app.logger.error(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    update_knowledge_graph_descriptions()