from pymongo import MongoClient
from datetime import datetime, timedelta
import random
from config import Config  # Assuming you have your MongoDB URI in a Config file

# Connect to MongoDB
client = MongoClient(Config.MONGODB_URI)
db = client[Config.MONGODB_DB]
users_collection = db['users']

# Set date range
start_date = datetime(2024, 7, 10)
end_date = datetime(2024, 7, 21)

# Function to generate a random date
def random_date(start, end):
    return start + timedelta(
        seconds=random.randint(0, int((end - start).total_seconds()))
    )

# Update all documents in the users collection
result = users_collection.update_many(
    {},
    [
        {
            "$set": {
                "created_at": {
                    "$function": {
                        "body": "function() { return new Date(Math.floor(Math.random() * (new Date('2024-07-21') - new Date('2024-07-10')) + new Date('2024-07-10'))); }",
                        "args": [],
                        "lang": "js"
                    }
                }
            }
        }
    ]
)

print(f"Modified {result.modified_count} documents")

# Verify the update
sample_users = list(users_collection.find({}, {"_id": 1, "created_at": 1}).limit(5))
for user in sample_users:
    print(f"User ID: {user['_id']}, Created At: {user['created_at']}")

client.close()