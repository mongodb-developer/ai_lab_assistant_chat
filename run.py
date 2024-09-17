import os
from gevent.pywsgi import WSGIServer
from app import create_app

app = create_app()

if __name__ == '__main__':
    ssl_context = None
    if os.getenv('FLASK_ENV') == 'development':
        cert_path = '/Users/michael.lynn/code/mongodb/ai/ai_lab_assistant_chat/certs/lab-assistant.localhost.com.pem'
        key_path = '/Users/michael.lynn/code/mongodb/ai/ai_lab_assistant_chat/certs/lab-assistant.localhost.com-key.pem'

        if os.path.exists(cert_path) and os.path.exists(key_path):
            ssl_context = (cert_path, key_path)
            app.logger.info("SSL certificate files found, running in SSL mode.")
        else:
            app.logger.warning("SSL certificate files not found. Falling back to non-SSL mode.")
    else:
        app.logger.info("Production mode detected. Starting non-SSL server.")

    port = 443 if ssl_context else 8080

    try:
        if ssl_context:
            server = WSGIServer(('0.0.0.0', port), app, keyfile=ssl_context[1], certfile=ssl_context[0])
            app.logger.info(f"Starting server in SSL mode on https://0.0.0.0:{port}")
        else:
            server = WSGIServer(('0.0.0.0', port), app)
            app.logger.info(f"Starting server in non-SSL mode on http://0.0.0.0:{port}")

        if os.getenv('FLASK_ENV') == 'development':
            app.logger.info("Running in debug mode")
            app.debug = True

        server.serve_forever()

    except Exception as e:
        app.logger.error(f"Failed to start server: {e}")