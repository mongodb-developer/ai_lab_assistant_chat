from flask import Flask, make_response
from flask_login import login_required, current_user, user_logged_in
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from flask_socketio import SocketIO  # Add this import
from .config import Config
from .auth import auth, oauth, login_manager, init_oauth
from .utils import init_db, update_user_login_info
from .socket_manager import init_socket_manager

import os
import logging

def create_app(config_class=Config):
    print("Starting create_app function")
    app = Flask(__name__,
                template_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates')),
                static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../static')))

    app.config.from_object(config_class)
    print("Loaded config")
    
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    init_db(app)
    csrf = CSRFProtect(app)

    app.config['WTF_CSRF_CHECK_DEFAULT'] = False
    app.config['WTF_CSRF_HEADERS'] = ['X-CSRFToken']

    logging.basicConfig(level=logging.DEBUG)
    app.logger.setLevel(logging.DEBUG)

    if os.getenv('FLASK_ENV') == 'development':
        app.config['SERVER_NAME'] = 'lab-assistant.localhost.com'
    else:
        app.config['SERVER_NAME'] = 'lab-ai-assistant.ue.r.appspot.com'

    init_oauth(app)
    login_manager.init_app(app)
    login_manager.session_protection = "strong"
    login_manager.login_view = 'auth.login'

    from .routes import main

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')  # Change 'eventlet' to 'gevent'
    app.socketio = socketio

    socket_manager = init_socket_manager(app, socketio)
    app.socket_manager = socket_manager

    app.register_blueprint(main)
    app.register_blueprint(auth)

    app.config['UPLOAD_FOLDER'] = 'uploads'
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    @user_logged_in.connect_via(app)
    def _track_logins(sender, user, **extra):
        update_user_login_info(str(user.id))

    csrf.init_app(app)
    
    @app.after_request
    def add_csp_headers(response):
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://code.jquery.com; "
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://cdn-icons-png.flaticon.com; "
            "connect-src 'self' wss: ws:;"
        )
        response.headers['Content-Security-Policy'] = csp
        return response

    print("Finished create_app function")
    return app