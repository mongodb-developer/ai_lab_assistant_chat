# Simple example of importing questions from a csv

import openai
import pymongo
import os
import pandas as pd
from datetime import datetime
from utils import add_question_answer

# Ensure the config module is accessible
import sys
sys.path.append('../config')

# Configure your OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# MongoDB connection settings
MONGODB_URI = os.getenv("MONGODB_URI")
client = pymongo.MongoClient(MONGODB_URI)
db = client.get_default_database()
collection = db['documents']

# Function to generate embeddings using OpenAI
def generate_embeddings(text):
    response = openai.Embedding.create(input=text, model="text-embedding-ada-002")
    return response['data'][0]['embedding']

# Function to add question and answer to the database
def add_qna_to_db(question, answer, title, references, summary):
    question_embedding = generate_embeddings(question)
    answer_embedding = generate_embeddings(answer)
    
    document = {
        "question": question,
        "answer": answer,
        "question_embedding": [{"$numberDouble": str(e)} for e in question_embedding],
        "answer_embedding": [{"$numberDouble": str(e)} for e in answer_embedding],
        "title": title,
        "references": references,
        "summary": summary,
        "main_answer": answer,
        "schema_version": 2,
        "updated_at": {"$date": {"$numberLong": str(int(datetime.now().timestamp() * 1000))}}
    }
    
    # Use the existing add_question_answer method
    add_question_answer(document, answer)

# Read the Q&A list from the CSV file
csv_file_path = './qna_list.csv'  # Update the path as needed
df = pd.read_csv(csv_file_path, quoting=1)

# Loop through the DataFrame and add each Q&A to the database
for index, row in df.iterrows():
    add_qna_to_db(
        question=row["question"],
        answer=row["answer"],
        title=row["title"],
        references=row["references"],
        summary=row["summary"]
    )

print("Questions and answers have been successfully added to the database.")
