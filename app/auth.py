from flask import Blueprint, url_for, session, redirect, request, current_app
from authlib.integrations.flask_client import OAuth
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user
from app.utils import get_db_connection
from config import Config
from bson import ObjectId
import time
from datetime import datetime
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
    def __init__(self, id, email, name, picture=None, is_admin=False, last_login=None):
        self.id = id
        self.email = email
        self.is_admin = is_admin
        self.name = name
        self.picture = picture
        self.last_login = last_login

    def get_id(self):
        return str(self.id)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

@login_manager.user_loader
def load_user(user_id):
    db = get_db_connection()
    user_data = db.users.find_one({'_id': ObjectId(user_id)})
    if user_data:
        name = user_data.get('name', 'Unknown User')
        picture = user_data.get('picture')
        last_login = user_data.get('last_login')
        return User(str(user_data['_id']), user_data['email'], name, picture, user_data.get('isAdmin', False), last_login)
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
        name = user_info['name']
        picture = user_info.get('picture')
        current_time = datetime.now()

        db = get_db_connection()
        user_data = db.users.find_one({'email': email})
        if user_data is None:
            user_data = {
                'email': email, 
                'name': name, 
                'isAdmin': False,
                'picture': picture,
                'last_login': current_time
            }
            result = db.users.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            current_app.logger.debug(f"New user created: {user_data}")
        else:
            current_app.logger.debug(f"Existing user found: {user_data}")
            db.users.update_one(
                {'_id': user_data['_id']}, 
                {'$set': {
                    'name': name, 
                    'picture': picture,
                    'last_login': current_time
                }}
            )
            user_data['last_login'] = current_time

        user = User(str(user_data['_id']), email, name, picture, user_data.get('isAdmin', False), current_time)
        login_user(user)
        current_app.logger.info(f"User logged in: {email}")
        
        # Mark the session as modified to ensure it's saved
        session.modified = True
        current_app.logger.debug(f"Session after login: {session}")
        
        return redirect(url_for('main.chat'))
    except Exception as e:
        current_app.logger.error(f"Error in authorized route: {str(e)}")
        return redirect(url_for('main.index'))
