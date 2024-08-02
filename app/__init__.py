import os
from flask import Flask
from flask_login import login_required, current_user, user_logged_in
from flask_cors import CORS
from config import Config
from .auth import auth, oauth, login_manager, init_oauth
from .routes import main
import logging
from app.utils import update_user_login_info
from .utils import init_db  # Add this import
from .config import Config

def create_app(config_class=Config):
    app = Flask(__name__,
                template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
                static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')))

    app.config.from_object(config_class)
    
    CORS(app, resources={r"/*": {"origins": ["https://lab-assistant.localhost.com", "https://lab-ai-assistant.ue.r.appspot.com"]}}, supports_credentials=True)
    init_db(app)  # Add this line

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

    app.register_blueprint(main)
    app.register_blueprint(auth)

    app.config['UPLOAD_FOLDER'] = 'uploads'
    # Ensure the upload directory exists
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    @user_logged_in.connect_via(app)
    def _track_logins(sender, user, **extra):
        update_user_login_info(str(user.id))

    return app