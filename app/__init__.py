import os
from flask import Flask
from flask_cors import CORS
from config import Config
from .auth import auth, oauth, login_manager, init_oauth
import logging

def create_app(config_class=Config):
    app = Flask(__name__,
                template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
                static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')))
    app.config.from_object(config_class)
    CORS(app, supports_credentials=True)

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

    from app import routes
    app.register_blueprint(routes.main)
    app.register_blueprint(auth)

    return app
