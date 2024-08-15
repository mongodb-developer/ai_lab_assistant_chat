import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient
import requests
from config import Config
import pytz

# Load environment variables
load_dotenv()

# Connect to MongoDB
client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
events_collection = db['events']

# List of addresses (as defined above)
ADDRESSES = [
    ("123 Main St", "", "New York", "NY", "10001", "US"),
    ("456 Market St", "Suite 200", "San Francisco", "CA", "94103", "US"),
    ("789 Peachtree St NE", "", "Atlanta", "GA", "30308", "US"),
    ("321 Michigan Ave", "", "Chicago", "IL", "60604", "US"),
    ("555 Boylston St", "", "Boston", "MA", "02116", "US"),
    ("1 Infinite Loop", "", "Cupertino", "CA", "95014", "US"),
    ("350 5th Ave", "", "New York", "NY", "10118", "US"),
    ("400 Broad St", "", "Seattle", "WA", "98109", "US"),
    ("6 Rue d'Armaillé", "", "Paris", "", "75017", "FR"),
    ("20 W 34th St", "", "New York", "NY", "10001", "US"),
    ("1 Harbourfront Ave", "", "Singapore", "", "098970", "SG"),
    ("Alexanderplatz 5", "", "Berlin", "", "10178", "DE"),
    ("2-1-1 Nihonbashi", "Chuo-ku", "Tokyo", "", "103-0027", "JP"),
    ("1 Parliament St", "", "London", "", "SW1A 0AA", "GB"),
    ("100 Queen St W", "", "Toronto", "ON", "M5H 2N2", "CA"),
    ("Rua Oscar Freire 123", "", "São Paulo", "SP", "01426-001", "BR"),
    ("Calle de Alcalá 1", "", "Madrid", "", "28014", "ES"),
    ("Piazza del Colosseo 1", "", "Rome", "", "00184", "IT"),
    ("Museumstraat 1", "", "Amsterdam", "", "1071 XX", "NL"),
    ("Nanjing Road 123", "", "Shanghai", "", "200001", "CN"),
    ("1 Martin Place", "", "Sydney", "NSW", "2000", "AU"),
    ("Kärntner Straße 1", "", "Vienna", "", "1010", "AT"),
    ("1 Sheikh Mohammed bin Rashid Blvd", "", "Dubai", "", "", "AE"),
    ("Ulitsa Tverskaya 1", "", "Moscow", "", "125009", "RU"),
    ("Friedrichstraße 1", "", "Berlin", "", "10117", "DE"),
    ("Paseo de la Reforma 1", "", "Mexico City", "", "06500", "MX"),
    ("Aker Brygge 1", "", "Oslo", "", "0250", "NO"),
    ("Kungsgatan 1", "", "Stockholm", "", "111 43", "SE"),
    ("Bahnhofstrasse 1", "", "Zurich", "", "8001", "CH"),
    ("Flinders St", "", "Melbourne", "VIC", "3000", "AU"),
]

def geocode_address(address1, address2, city, state, postal_code, country_code):
    api_key = Config.GOOGLE_MAPS_API_KEY
    full_address = f"{address1}, {address2}, {city}, {state} {postal_code}, {country_code}"
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={full_address}&key={api_key}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['status'] == 'OK':
            location = data['results'][0]['geometry']['location']
            return {
                "type": "Point",
                "coordinates": [location['lng'], location['lat']]
            }
    return None

def generate_events():
    for address in ADDRESSES:
        address1, address2, city, state, postal_code, country_code = address
        
        # Generate event details
        event_date = datetime.now(pytz.utc) + timedelta(days=random.randint(30, 180))
        title = f"Developer Day {city}"
        
        # Geocode the address
        location = geocode_address(address1, address2, city, state, postal_code, country_code)
        
        # Create event document
        event = {
            "title": title,
            "date_time": event_date.isoformat(),  # Convert to ISO format string
            "time_zone": "UTC",
            "address1": address1,
            "address2": address2,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "country_code": country_code,
            "location": location,
            "registration_url": f"https://example.com/register/{city.lower().replace(' ', '-')}",
            "lead_instructor": f"Instructor {random.choice(['A', 'B', 'C', 'D', 'E'])}",
            "sessions": [
                {"name": "Data Modeling", "instructor": f"Instructor {random.choice(['1', '2', '3', '4', '5'])}"},
                {"name": "Intro Lab", "instructor": f"Instructor {random.choice(['1', '2', '3', '4', '5'])}"},
                {"name": "Aggregations", "instructor": f"Instructor {random.choice(['1', '2', '3', '4', '5'])}"},
                {"name": "Atlas Search", "instructor": f"Instructor {random.choice(['1', '2', '3', '4', '5'])}"},
                {"name": "VectorSearch", "instructor": f"Instructor {random.choice(['1', '2', '3', '4', '5'])}"}
            ]
        }
        
        # Insert event into the collection
        events_collection.insert_one(event)
        print(f"Created event: {title}")

if __name__ == "__main__":
    generate_events()
    print("Event generation complete.")