from flask import Blueprint, url_for, session, redirect, request, current_app
from authlib.integrations.flask_client import OAuth
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user
from app.utils import get_db_connection
from config import Config
from bson import ObjectId
import time
import logging

auth = Blueprint('auth', __name__)
oauth = OAuth()

def init_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name='google',
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'},
        redirect_uri=Config.OAUTHLIB_REDIRECT_URI
    )

login_manager = LoginManager()

class User(UserMixin):
    def __init__(self, id, email, is_admin=False):
        self.id = id
        self.email = email
        self.is_admin = is_admin

    def get_id(self):
        return str(self.id)

@login_manager.user_loader
def load_user(user_id):
    db = get_db_connection()
    user_data = db.users.find_one({'_id': ObjectId(user_id)})
    if user_data:
        return User(str(user_data['_id']), user_data['email'], user_data.get('isAdmin', False))
    return None

@auth.route('/login')
def login():
    redirect_uri = url_for('auth.authorized', _external=True)
    session['nonce'] = str(time.time())
    return oauth.google.authorize_redirect(redirect_uri, nonce=session['nonce'])

@auth.route('/logout')
def logout():
    logout_user()
    current_app.logger.info("User logged out")
    return redirect(url_for('main.index'))

@auth.route('/login/authorized')
def authorized():
    try:
        token = oauth.google.authorize_access_token()
        current_app.logger.debug(f"Received token: {token}")
        
        nonce = session.pop('nonce', None)
        current_app.logger.debug(f"Nonce from session: {nonce}")
        
        user_info = oauth.google.parse_id_token(token, nonce=nonce)
        current_app.logger.debug(f"User info: {user_info}")
        
        email = user_info['email']

        db = get_db_connection()
        user_data = db.users.find_one({'email': email})
        if user_data is None:
            user_data = {'email': email, 'isAdmin': False}
            result = db.users.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            current_app.logger.debug(f"New user created: {user_data}")
        else:
            current_app.logger.debug(f"Existing user found: {user_data}")

        user = User(str(user_data['_id']), email, user_data.get('isAdmin', False))
        login_user(user)
        current_app.logger.info(f"User logged in: {email}")
        
        # Mark the session as modified to ensure it's saved
        session.modified = True
        current_app.logger.debug(f"Session after login: {session}")
        
        return redirect(url_for('main.index'))
    except Exception as e:
        current_app.logger.error(f"Error in authorized route: {str(e)}")
        return redirect(url_for('main.index'))
