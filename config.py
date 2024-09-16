import os
from dotenv import load_dotenv
from datetime import timedelta
from pathlib import Path

basedir = Path(__file__).resolve().parent

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key'
    MONGODB_URI = os.environ.get('MONGODB_URI')
    MONGODB_DB = os.environ.get('MONGODB_DB')
    MONGODB_COLLECTION = os.environ.get('MONGODB_COLLECTION')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
<<<<<<< HEAD
    SERVER_NAME = os.environ.get('SERVER_NAME') or 'lab-assistant.localhost.com'
=======
    SERVER_NAME = os.environ.get('SERVER_NAME') or 'lab-ai-assistant.ue.r.appspot.com/'
>>>>>>> 76a800a (missing declarations for threshold - env issues - oauth fix)
    SESSION_COOKIE_NAME = 'google-login-session'
    PERMANENT_SESSION_LIFETIME = timedelta(days=5)
    SESSION_TYPE = 'filesystem'
    SESSION_COOKIE_SECURE = True  # Set to True in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    OAUTHLIB_RELAX_TOKEN_SCOPE = True
    OAUTHLIB_INSECURE_TRANSPORT = os.environ.get('OAUTHLIB_INSECURE_TRANSPORT', '1') == '1'
<<<<<<< HEAD
    OAUTHLIB_REDIRECT_URI = os.environ.get('OAUTHLIB_REDIRECT_URI', 'https://lab-assistant.localhost.com/login/authorized')
    SIMILARITY_THRESHOLD = float(os.environ.get('SIMILARITY_THRESHOLD', '0.8'))
    GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    SOURCE=os.environ.get('SOURCE')
    FLASK_SECRET_KEY=os.environ.get('FLASK_SECRET_KEY')
=======
    OAUTHLIB_REDIRECT_URI = os.environ.get('OAUTHLIB_REDIRECT_URI', 'https://lab-ai-assistant.ue.r.appspot.com//login/authorized')
    SIMILARITY_THRESHOLD = float(os.environ.get('SIMILARITY_THRESHOLD', '0.8'))
    GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')
    UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
    SOURCE = os.environ.get('SOURCE')
    OPENAI_API_KEY=os.environ.get('OPENAI_API_KEY')
    FLASK_SECRET_KEY=os.environ.get('FLASK_SECRET_KEY')
    GOOGLE_CLIENT_ID=os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET=os.environ.get('GOOGLE_CLIENT_SECRET')
    GOOGLE_MAPS_API_KEY=os.environ.get('GOOGLE_MAPS_API_KEY')
>>>>>>> 76a800a (missing declarations for threshold - env issues - oauth fix)
