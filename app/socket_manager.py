# app/socket_manager.py

from flask_socketio import SocketIO
import logging

class SocketConnectionManager:
    def __init__(self):
        self.socketio = None
        self.active_tasks = set()
        self.logger = logging.getLogger(__name__)

    def init_app(self, app):
        self.socketio = SocketIO(app, cors_allowed_origins="*")
        self.logger.info("SocketConnectionManager initialized")

    def start_task(self, task_name):
        self.active_tasks.add(task_name)
        self.logger.info(f"Started task: {task_name}")

    def end_task(self, task_name):
        if task_name in self.active_tasks:
            self.active_tasks.remove(task_name)
            self.logger.info(f"Ended task: {task_name}")

    def emit(self, event, data, **kwargs):
        if self.socketio:
            self.socketio.emit(event, data, **kwargs)
        else:
            self.logger.error("SocketIO not initialized")

    def on(self, event):
        if self.socketio:
            return self.socketio.on(event)
        else:
            self.logger.error("SocketIO not initialized")
            return lambda f: f

    def start_background_task(self, target, *args, **kwargs):
        if self.socketio:
            return self.socketio.start_background_task(target, *args, **kwargs)
        else:
            self.logger.error("SocketIO not initialized")

    def run(self, app, **kwargs):
        if self.socketio:
            self.socketio.run(app, **kwargs)
        else:
            self.logger.error("SocketIO not initialized")

socket_manager = SocketConnectionManager()

def init_socket_manager(app):
    socket_manager.init_app(app)
    return socket_manager