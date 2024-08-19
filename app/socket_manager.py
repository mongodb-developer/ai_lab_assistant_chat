# app/socket_manager.py

from flask_socketio import SocketIO
import logging
from threading import Timer
import threading

class SocketConnectionManager:
    def __init__(self):
        self.socketio = None
        self.active_tasks = set()
        self.logger = logging.getLogger(__name__)
        self.disconnect_timer = None
        self.should_stop = threading.Event()

    def init_app(self, app):
        self.socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
        self.logger.info("SocketConnectionManager initialized")

    def connect(self):
        if not self.socketio:
            self.logger.error("SocketIO not initialized")
            return
        if self.disconnect_timer:
            self.disconnect_timer.cancel()
        self.should_stop.clear()
        self.logger.info("SocketIO connection established")

    def disconnect(self):
        if self.disconnect_timer:
            self.disconnect_timer.cancel()
        self.disconnect_timer = Timer(5.0, self._disconnect)  # 5-second delay
        self.disconnect_timer.start()

    def _disconnect(self):
        if not self.active_tasks:
            self.should_stop.set()
            self.logger.info("SocketIO disconnected due to inactivity")

    def start_task(self, task_name):
        self.active_tasks.add(task_name)
        self.logger.info(f"Started task: {task_name}")
        if self.disconnect_timer:
            self.disconnect_timer.cancel()

    def end_task(self, task_name):
        if task_name in self.active_tasks:
            self.active_tasks.remove(task_name)
            self.logger.info(f"Ended task: {task_name}")
        if not self.active_tasks:
            self.disconnect()

    def emit(self, event, data, **kwargs):
        if self.socketio and not self.should_stop.is_set():
            self.socketio.emit(event, data, **kwargs)
        else:
            self.logger.error("SocketIO not initialized or has been stopped")

    def on(self, event):
        if self.socketio:
            return self.socketio.on(event)
        else:
            self.logger.error("SocketIO not initialized")
            return lambda f: f

    def start_background_task(self, target, *args, **kwargs):
        if self.socketio and not self.should_stop.is_set():
            return self.socketio.start_background_task(target, *args, **kwargs)
        else:
            self.logger.error("SocketIO not initialized or has been stopped")

    def run(self, app, **kwargs):
        if self.socketio:
            self.socketio.run(app, **kwargs)
        else:
            self.logger.error("SocketIO not initialized")

socket_manager = SocketConnectionManager()

def init_socket_manager(app):
    socket_manager.init_app(app)
    return socket_manager