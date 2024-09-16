import os
import sys
from app.socket_manager import socket_manager
import cProfile
import pstats
import io

from app import create_app

# Expose the Flask app instance for Gunicorn
app = create_app()

def profile_app():
    profiler = cProfile.Profile()
    profiler.enable()

    try:
        from app import create_app
        print("Successfully imported create_app")
    except ImportError as e:
        print(f"Failed to import create_app: {e}")
        print("Traceback:")
        import traceback
        traceback.print_exc()
        return

    try:
        app_profiled = create_app()
        print("Successfully created app")
    except Exception as e:
        print(f"Failed to create app: {e}")
        print("Traceback:")
        import traceback
        traceback.print_exc()
        return

    profiler.disable()
    
    # Print the profiling results
    s = io.StringIO()
    sortby = 'cumulative'
    ps = pstats.Stats(profiler, stream=s).sort_stats(sortby)
    ps.print_stats(20)  # Print top 20 time-consuming functions
    print(s.getvalue())

    return app_profiled

if __name__ == '__main__':
    # Only run profiling and development server when executing run.py directly
    profiled_app = profile_app()

    if __name__ == '__main__':
    profiled_app = profile_app()

    if profiled_app:
        ssl_context = None
        if os.getenv('FLASK_ENV') == 'development':
            ssl_context = (
                '/path/to/your/cert.pem',
                '/path/to/your/key.pem'
            )

        socket_manager.run(
            profiled_app,
            host='0.0.0.0',
            port=443 if ssl_context else 8080,
            ssl_context=ssl_context,
            debug=True
        )
