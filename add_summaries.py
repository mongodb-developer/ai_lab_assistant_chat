import os
import openai
import pymongo
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# MongoDB connection settings
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB = os.getenv('MONGODB_DB')

# OpenAI API key
openai.api_key = os.getenv('OPENAI_API_KEY')

# Connect to MongoDB
client = pymongo.MongoClient(MONGODB_URI)
db = client[MONGODB_DB]
documents_collection = db['documents']

# Function to generate a summary using OpenAI's GPT-3.5
def generate_summary(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease summarize the following text:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides summaries."},
            {"role": "user", "content": prompt}
        ]
    )
    summary = response['choices'][0]['message']['content'].strip()
    return summary

# Function to generate references using OpenAI's GPT-3.5
def generate_references(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a relevant reference for the following text from the MongoDB documentation:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides relevant references."},
            {"role": "user", "content": prompt}
        ]
    )
    references = response['choices'][0]['message']['content'].strip()
    if not references:
        references = "No specific references provided. Please refer to the MongoDB Documentation at https://www.mongodb.com/docs/"
    return references

# Function to generate a title using OpenAI's GPT-3.5
def generate_title(answer):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a concise and descriptive title for the following answer:\n\n{answer}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides concise and descriptive titles."},
            {"role": "user", "content": prompt}
        ]
    )
    title = response['choices'][0]['message']['content'].strip()
    return title

# Function to generate an answer using OpenAI's GPT-3.5
def generate_answer(title, summary):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nPlease provide a detailed answer based on the following title and summary:\n\nTitle: {title}\n\nSummary: {summary}"
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that provides detailed answers."},
            {"role": "user", "content": prompt}
        ]
    )
    answer = response['choices'][0]['message']['content'].strip()
    return answer

# Function to update documents with summary, references, title, and answer
def update_documents():
    documents = documents_collection.find({
        "$or": [
            {"summary": {"$exists": False}},
            {"summary": "Summary not provided"},
            {"references": {"$exists": False}},
            {"title": {"$exists": False}},
            {"answer": {"$exists": False}},
            {"answer": "No answer provided"},
            {"answer": "No main answer provided"},
            {"main_answer": "No main answer provided"}
        ]
    })
    for doc in documents:
        title = doc.get('title')
        summary = doc.get('summary')
        answer = doc.get('answer')
        
        if not title:
            title = generate_title(answer if answer else "")
        
        if not summary or summary == "Summary not provided":
            summary = generate_summary(answer if answer else "")
        
        if not references:
            references = generate_references(answer if answer else "")
        
        if not answer or answer == "No main answer provided":
            answer = generate_answer(title, summary)
        
        documents_collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "title": title,
                "summary": summary,
                "references": references,
                "answer": answer,
                "schema_version": 2
            }}
        )
        print(f"Updated document with ID: {doc['_id']}")

if __name__ == "__main__":
    update_documents()
    print("Documents updated successfully.")
