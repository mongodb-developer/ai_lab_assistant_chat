import pandas as pd

# Define the questions and answers
qna_list = [
    {
        "question": "How do I set up a MongoDB cluster in MongoDB Atlas?",
        "answer": """To set up a MongoDB cluster in MongoDB Atlas, follow these steps:
1. Sign in to your MongoDB Atlas account.
2. Click "Build a Cluster".
3. Choose your cloud provider and region.
4. Select your cluster tier and settings.
5. Click "Create Cluster".  
For more details, refer to the [Intro Lab documentation](https://mongodb-developer.github.io/intro-lab/docs/intro).""",
        "title": "Setting up MongoDB cluster in Atlas",
        "references": "https://mongodb-developer.github.io/intro-lab/docs/intro",
        "summary": "Steps to set up a MongoDB cluster in MongoDB Atlas."
    },
    # Add other questions and answers here...
]

# Convert the list to a DataFrame
df = pd.DataFrame(qna_list)

# Save the DataFrame to a CSV file with proper escaping and quoting
csv_file_path = './qna_list.csv'
df.to_csv(csv_file_path, index=False, quoting=1)

csv_file_path
