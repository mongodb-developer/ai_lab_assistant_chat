# data_utils.py

from pymongo import MongoClient
from flask import current_app
from .socket_manager import socket_manager

# Configuration constants
APP_NAME_DEV_DAY = "devrel.workshop.devday"
SOURCE_COLLECTIONS = ["authors", "books", "issueDetails", "reviews", "users"]
LIMIT = 2000

def connect_to_mongodb(connection_string):
    """Establish a connection to MongoDB and return the client."""
    try:
        client = MongoClient(connection_string, appName=APP_NAME_DEV_DAY)
        client.admin.command('ping')  # Ping to check connection
        return client
    except Exception as e:
        current_app.logger.error(f"Error connecting to MongoDB: {str(e)}")
        socket_manager.emit('message', {'message': f"Error connecting to MongoDB: {str(e)}", 'error': True})
        return None

def import_collection(client, collection_name):
    """Import a collection from the source database to the target."""
    try:
        target_collection = client["library"][collection_name]
        target_collection.drop()
        socket_manager.emit('message', {'message': f'{collection_name}: Deleted existing documents'})

        # Fetch documents and import
        current_count = 0
        next_docs = get_documents(collection_name)
        while next_docs:
            target_collection.insert_many(next_docs)
            current_count += len(next_docs)
            socket_manager.emit('status', {'collection': collection_name, 'count': current_count})
            next_docs = get_documents(collection_name, next_docs[-1]['_id'])

        socket_manager.emit('message', {'message': f'{collection_name}: Import complete'})
    except Exception as e:
        current_app.logger.error(f"Error importing collection {collection_name}: {str(e)}")

def get_documents(collection, last_id=None):
    """Fetch documents from the source database with pagination."""
    # Assume source_client is already established globally
    source_collection = source_client["library"][collection]
    query = {'_id': {'$gt': last_id}} if last_id else {}
    return list(source_collection.find(query).sort('_id', 1).limit(LIMIT))
