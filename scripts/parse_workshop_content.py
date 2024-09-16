import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
from pymongo import MongoClient
from webdriver_manager.chrome import ChromeDriverManager
from config import Config
from selenium.common.exceptions import WebDriverException
from urllib.parse import urljoin

client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
workshop_content = db['workshop_content']

base_url = 'https://mongodb-developer.github.io/aggregation-pipeline-lab'

def setup_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=chrome_options)

def get_page_content(driver, url):
    driver.get(url)
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )
    time.sleep(2)
    return driver.page_source

def extract_content(soup):
    content_div = soup.find('div', class_='theme-doc-markdown')
    if not content_div:
        return None

    title = content_div.find('h1')
    title_text = title.text if title else "Untitled"

    content_type = "reading"
    if '👐' in title_text:
        content_type = "exercise"
    elif '🦸' in title_text:
        content_type = "extra_credit"

    content = content_div.get_text(separator='\n', strip=True)

    return {
        'title': title_text,
        'type': content_type,
        'content': content
    }

def get_next_page_link(soup):
    next_link = soup.find('a', class_='pagination-nav__link--next')
    if next_link:
        return next_link['href']
    return None

def process_workshop():
    driver = setup_driver()
    
    workshop_doc = {
        'workshopId': 'AGG001',
        'title': 'MongoDB Aggregation Framework Workshop',
        'description': 'Learn and practice MongoDB Aggregation Framework',
        'modules': []
    }

    try:
        current_url = base_url + '/docs/intro'
        module_index = 0
        visited_urls = set()

        while current_url and current_url not in visited_urls:
            print(f"Processing page: {current_url}")
            try:
                driver.get(current_url)
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
            except WebDriverException as e:
                print(f"Error loading page {current_url}: {str(e)}")
                break

            visited_urls.add(current_url)
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            content_div = soup.find('div', class_='theme-doc-markdown')
            if content_div:
                title = content_div.find('h1').text if content_div.find('h1') else "Untitled"
                content = content_div.get_text(separator='\n', strip=True)

                module_index += 1
                module = {
                    'moduleId': f'M{module_index:03d}',
                    'title': title,
                    'content': content,
                    'url': current_url
                }
                workshop_doc['modules'].append(module)
                print(f"Extracted content: {title}")
            else:
                print(f"Could not extract content for {current_url}")

            next_link = soup.find('a', class_='pagination-nav__link--next')
            if next_link:
                next_href = next_link.get('href')
                if next_href:
                    current_url = urljoin(base_url, next_href)
                    print(f"Next URL: {current_url}")
                    if current_url in visited_urls:
                        print("Cycle detected. Stopping.")
                        break
                else:
                    current_url = None
            else:
                current_url = None

        # Insert into MongoDB
        workshop_content.insert_one(workshop_doc)
        print("Workshop content inserted successfully!")
        print(f"Total modules extracted: {len(workshop_doc['modules'])}")

    except Exception as e:
        print(f"An error occurred: {str(e)}")
    finally:
        driver.quit()

if __name__ == "__main__":
    process_workshop()