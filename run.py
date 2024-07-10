import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    ssl_context = None
    if os.getenv('FLASK_ENV') == 'development':
        ssl_context = (
            '/Users/michael.lynn/code/mongodb/ai/ai_lab_assistant_chat/certs/lab-assistant.localhost.com.pem',
            '/Users/michael.lynn/code/mongodb/ai/ai_lab_assistant_chat/certs/lab-assistant.localhost.com-key.pem'
        )

    app.run(
        host='0.0.0.0',
        port=443 if ssl_context else 8080,
        ssl_context=ssl_context
    )
