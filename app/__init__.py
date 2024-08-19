from flask import Flask
from flask_login import login_required, current_user, user_logged_in
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from .config import Config
from .auth import auth, oauth, login_manager, init_oauth
from .utils import init_db, update_user_login_info
from .socket_manager import init_socket_manager

import os
import logging

def create_app(config_class=Config):
    app = Flask(__name__,
                template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
                static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')))

    app.config.from_object(config_class)
    
    CORS(app, resources={r"/*": {"origins": ["https://lab-assistant.localhost.com", "https://lab-ai-assistant.ue.r.appspot.com"]}}, supports_credentials=True)
    init_db(app)  # Add this line
    csrf = CSRFProtect(app)

    app.config['WTF_CSRF_CHECK_DEFAULT'] = False
    app.config['WTF_CSRF_HEADERS'] = ['X-CSRFToken']

    # Configure logging
    logging.basicConfig(level=logging.DEBUG)
    app.logger.setLevel(logging.DEBUG)

    # Conditionally set SERVER_NAME based on environment
    if os.getenv('FLASK_ENV') == 'development':
        app.config['SERVER_NAME'] = 'lab-assistant.localhost.com'
    else:
        app.config['SERVER_NAME'] = 'lab-ai-assistant.ue.r.appspot.com'

    init_oauth(app)
    login_manager.init_app(app)
    login_manager.session_protection = "strong"
    login_manager.login_view = 'auth.login'

    from .routes import main

    socket_manager = init_socket_manager(app)  # Initialize the SocketConnectionManager

    app.register_blueprint(main)
    app.register_blueprint(auth)

    app.config['UPLOAD_FOLDER'] = 'uploads'
    # Ensure the upload directory exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    @user_logged_in.connect_via(app)
    def _track_logins(sender, user, **extra):
        update_user_login_info(str(user.id))
    csrf.init_app(app)

    return app