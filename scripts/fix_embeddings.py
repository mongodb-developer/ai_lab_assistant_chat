import os
from pymongo import MongoClient
from config import Config
from dotenv import load_dotenv
from datetime import datetime
import openai

# Load environment variables
load_dotenv()

# Initialize MongoDB client
client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
documents_collection = db['documents']

# Initialize OpenAI API
openai.api_key = Config.OPENAI_API_KEY

def generate_embedding(text):
    response = openai.Embedding.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response['data'][0]['embedding']

def re_encode_questions():
    documents = documents_collection.find({"created_by": "ai"})
    for doc in documents:
        question = doc.get('question', '')
        if question:
            try:
                question_embedding = generate_embedding(question)
                documents_collection.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {
                        "question_embedding": question_embedding,
                        "updated_at": datetime.now()
                    }}
                )
                print(f"Updated document ID {doc['_id']} with new embedding.")
            except Exception as e:
                print(f"Error updating document ID {doc['_id']}: {e}")

if __name__ == "__main__":
    re_encode_questions()
