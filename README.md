# AI Lab Assistant Chat

## Overview

The AI Lab Assistant Chat application is a web-based tool designed to help users and administrators interact with an AI-powered assistant. The application is built using Flask for the backend and Bootstrap for the frontend. It leverages MongoDB for data storage and OpenAI for generating embeddings and processing questions.

## Features

### User Features

- **Chat with AI Assistant**: Users can interact with an AI assistant to get answers to their questions.
- **Sample Questions**: Frequently asked questions are displayed as clickable samples for quick access.
- **Previous Conversations**: Users can view and delete their previous chat conversations.

### Admin Features

- **Add Questions and Answers**: Administrators can add new question and answer pairs to the system.
- **Mark Sample Questions**: Administrators can mark certain questions as samples, which will then be displayed to users as frequently asked questions.
- **Rich Text and Markdown Support**: Answers can be formatted using markdown for rich text presentation.

## Technical Details

### Backend

- **Framework**: Flask
- **Database**: MongoDB
- **AI Integration**: OpenAI for generating embeddings and processing questions

### Frontend

- **Framework**: Bootstrap
- **Rich Text Editor**: Quill.js for the admin interface

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/ai-lab-assistant-chat.git
   cd ai-lab-assistant-chat
   ```

2. Create a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```
3. Install dependencies:

```bash
pip install -r requirements.txt
```
## Set up environment variables:

4. Create a .env file in the root directory and add the following variables:
```
FLASK_APP=run.py
FLASK_ENV=development
MONGODB_URI=your_mongodb_uri
MONGODB_DB=your_database_name
MONGODB_COLLECTION=your_collection_name
OPENAI_API_KEY=your_openai_api_key
```
## Run the application:

```bash
flask run
```

## Project Structure
- app/: Contains the Flask application
- __init__.py: Initializes the Flask app
- routes.py: Defines the routes for the application
- utils.py: Contains utility functions for database interactions and AI processing
- templates/: HTML templates for the application
- index.html: Main user interface
- admin.html: Admin interface
- static/: Static files (CSS, JS)
- styles.css: Custom styles for the application
- chat.js: JavaScript for handling chat functionality
- config.py: Configuration file for environment variables
- run.py: Entry point for the Flask application

## Usage
### User Interface
- Home Page: Displays information about the application and a link to start a conversation.
- Chat Page: Allows users to chat with the AI assistant and view previous conversations.
- Sample Questions: Users can click on sample questions to quickly get answers.

### Admin Interface
- Add Question: Admins can add new questions and answers, and mark them as sample questions.
- Markdown Support: Admins can use markdown to format answers.

## Future Enhancements
- User Authentication: Enhance the user authentication system for better security.
- Analytics Dashboard: Add an admin dashboard to view analytics on user interactions and question trends.
- Improved UI/UX: Continuously improve the user interface and user experience based on feedback.

## Contributing

Fork the repository:

```bash
git clone https://github.com/yourusername/ai-lab-assistant-chat.git
cd ai-lab-assistant-chat
```

### Create a branch:

```bash
git checkout -b feature/your-feature-name
```

### Make your changes and commit:

```bash
git commit -m "Add your feature"
```

### Push to the branch:

```bash
git push origin feature/your-feature-name
```

### Create a pull request:

Go to the repository on GitHub and create a pull request.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.