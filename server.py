import socket
import threading
import pickle
import time
from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import eventlet

eventlet.monkey_patch()

HOST = ''  # Listen on all interfaces
PORT = 65432  # Port for client connections
WEB_PORT = 5000  # Port for the web server

clients = {}
clients_lock = threading.Lock()

app = Flask(__name__)
socketio = SocketIO(app)

# Serve the web app
@app.route('/')
def index():
    return render_template('index.html')

# Serve static files (JavaScript, CSS)
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

# Serve map tiles
@app.route('/tiles/<path:filename>')
def tiles(filename):
    return send_from_directory('tiles', filename)

def handle_client(conn, addr):
    global clients
    try:
        print(f"[NEW CONNECTION] {addr} connected.")
        while True:
            data = conn.recv(1024)
            if not data:
                break

            location = pickle.loads(data)
            with clients_lock:
                clients[addr] = (conn, location)
                # Send updated locations to web clients
                socketio.emit('update_locations', get_locations())
    except ConnectionResetError:
        print(f"[DISCONNECT] {addr} disconnected abruptly.")
    finally:
        with clients_lock:
            if addr in clients:
                del clients[addr]
            conn.close()
            print(f"[DISCONNECT] {addr} disconnected.")

def get_locations():
    with clients_lock:
        return {str(addr): loc for addr, (_, loc) in clients.items()}

def start_server():
    print("[STARTING] Leader server is starting...")
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen()
    print(f"[LISTENING] Leader is listening on port {PORT}.")

    while True:
        conn, addr = server.accept()
        thread = threading.Thread(target=handle_client, args=(conn, addr))
        thread.start()
        print(f"[ACTIVE CONNECTIONS] {threading.active_count() - 2}")  # Minus Flask thread

def start_web_server():
    print(f"[WEB SERVER] Starting web server on port {WEB_PORT}...")
    socketio.run(app, host='0.0.0.0', port=WEB_PORT)

if __name__ == "__main__":
    threading.Thread(target=start_server, daemon=True).start()
    start_web_server()
