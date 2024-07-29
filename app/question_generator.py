from app.utils import (
    generate_embedding,
    search_similar_questions,
    add_question_answer,
    generate_title,
    generate_summary,
    generate_references,
    get_db_connection
)
from flask import Blueprint, request, jsonify, render_template, current_app, session, send_from_directory
from config import Config
import openai
import logging
import requests
from urllib.parse import urljoin
from bs4 import BeautifulSoup
import traceback  # Ensure traceback is imported

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize OpenAI API
openai.api_key = Config.OPENAI_API_KEY

def generate_question_answer(content):
    context = "Context: MongoDB Developer Days, MongoDB Atlas, MongoDB Aggregation Pipelines, and MongoDB Atlas Search"
    prompt = f"{context}\n\nBased on the following content, generate a series of questions and answers that workshop attendees may encounter:\n\n{content}"
    
    current_app.logger.debug(f"Generating questions and answers for content length: {len(content)}")
    current_app.logger.debug(f"First 500 characters of content: {content[:500]}")
    
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an assistant that generates questions and answers based on provided content."},
            {"role": "user", "content": prompt}
        ]
    )
    
    result = response['choices'][0]['message']['content'].strip()
    current_app.logger.debug(f"Generated result length: {len(result)}")
    current_app.logger.debug(f"First 500 characters of result: {result[:500]}")
    
    return result

def process_content(content):
    try:
        current_app.logger.debug(f"Processing content, length: {len(content)}")
        qa_text = generate_question_answer(content)
        current_app.logger.debug(f"Generated QA text length: {len(qa_text)}")
        qa_pairs = qa_text.split("\n\n")
        current_app.logger.debug(f"Number of potential QA pairs: {len(qa_pairs)}")
        
        processed_pairs = []
        for qa_pair in qa_pairs:
            current_app.logger.debug(f"Processing QA pair: {qa_pair[:100]}...")
            if "?" in qa_pair and "-" in qa_pair:
                parts = qa_pair.split("?", 1)
                if len(parts) == 2:
                    question = parts[0].strip() + "?"
                    answer = parts[1].split("-", 1)[-1].strip()
                    processed_pairs.append((question, answer))
                    current_app.logger.debug(f"Processed QA pair: Q: {question[:50]}... A: {answer[:50]}...")
                else:
                    current_app.logger.warning(f"Invalid QA pair format (unexpected parts): {qa_pair[:100]}...")
            else:
                current_app.logger.warning(f"Invalid QA pair format (missing markers): {qa_pair[:100]}...")
        
        current_app.logger.debug(f"Processed {len(processed_pairs)} valid QA pairs")
        return processed_pairs
    except Exception as e:
        current_app.logger.error(f"Error processing content: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        raise

def save_to_mongodb(question, answer, similarity_threshold):
    try:
        current_app.logger.debug(f"Saving question to MongoDB: {question[:50]}...")
        
        question_embedding, _ = generate_embedding(question)
        current_app.logger.debug(f"Generated question embedding, length: {len(question_embedding)}")
        
        similar_question = search_similar_questions(question_embedding, question, similarity_threshold=similarity_threshold)
        
        if similar_question is None:
            current_app.logger.warning("Failed to search for similar questions. Proceeding with insertion.")
        elif similar_question:
            current_app.logger.debug(f"Similar question found. Skipping insertion.")
            return False
        
        title = generate_title(answer)
        summary = generate_summary(answer)
        references = generate_references(answer)
        
        db = get_db_connection()
        if db is None:
            current_app.logger.error("Failed to get database connection")
            return False

        result = add_question_answer(db, question, answer, title, summary, references)
        current_app.logger.debug(f"Question saved to MongoDB with ID: {result}")
        return True
    except Exception as e:
        current_app.logger.error(f"Error saving to MongoDB: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return False

# You can keep these functions if they're specific to question generation and not present in utils.py
def extract_text_from_file(file_path):
    current_app.logger.debug(f"Extracting text from TXT: {file_path}")
    with open(file_path, 'r') as file:
        return file.read()

def fetch_content_from_url(url, depth=0, max_depth=2, visited=None):
    if visited is None:
        visited = set()
    
    if depth > max_depth or url in visited:
        return ""

    visited.add(url)
    
    try:
        current_app.logger.debug(f"Fetching content from URL: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        content_type = response.headers.get('Content-Type', '').lower()
        
        if 'text/html' in content_type:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            for script in soup(["script", "style"]):
                script.decompose()
            
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            # Recursive call for links
            if depth < max_depth:
                for link in soup.find_all('a', href=True):
                    next_url = urljoin(url, link['href'])
                    if next_url.startswith('http') and next_url not in visited:
                        text += "\n\n" + fetch_content_from_url(next_url, depth + 1, max_depth, visited)
            
        elif 'application/pdf' in content_type:
            text = "PDF content detected. PDF parsing is not implemented in this function."
        else:
            text = response.text

        current_app.logger.info(f"Successfully fetched content from URL: {url}")
        return text

    except requests.RequestException as e:
        current_app.logger.error(f"Error fetching content from URL {url}: {str(e)}")
        return f"Error fetching content from URL: {str(e)}"