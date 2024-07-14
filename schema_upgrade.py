import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Retrieve MongoDB URI and database name from environment variables
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB")

# MongoDB client and collections
client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]
documents_collection = db["documents"]

def update_document(document):
    updated_document = {
        "title": document.get("question", "")[:50],  # Use the first 50 characters of the question as the title
        "summary": "Summary not provided",  # Placeholder summary
        "main_answer": document.get("answer", ""),
        "references": "No references provided",  # Placeholder references
        "schema_version": 2,
        "updated_at": datetime.now()
    }
    return updated_document

def main():
    try:
        documents = documents_collection.find({"schema_version": {"$exists": False}})  # Find documents without schema_version

        for document in documents:
            updated_fields = update_document(document)
            documents_collection.update_one(
                {"_id": document["_id"]},
                {"$set": updated_fields}
            )
            print(f"Document with ID {document['_id']} updated.")

    except Exception as e:
        print(f"Error updating documents: {str(e)}")

if __name__ == "__main__":
    main()
