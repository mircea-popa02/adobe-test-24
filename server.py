# server.py

import eventlet
eventlet.monkey_patch()  # Must be called before any other imports

import socket
import pickle
import time
from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit

HOST = ''  # Listen on all interfaces
PORT = 65432  # Port for client connections
WEB_PORT = 5000  # Port for the web server

clients = {}
clients_lock = eventlet.semaphore.Semaphore()

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

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
            # Read the length of the incoming message (4 bytes)
            raw_msglen = recvall(conn, 4)
            if not raw_msglen:
                print(f"[DISCONNECT] {addr} disconnected.")
                break
            # Unpack the length
            msglen = int.from_bytes(raw_msglen, byteorder='big')
            # Read the actual data
            data = recvall(conn, msglen)
            if not data:
                print(f"[DISCONNECT] {addr} disconnected.")
                break
            # Deserialize the data
            location_data = pickle.loads(data)
            print(f"[RECEIVED] Data from {addr}: {location_data}")
            name = location_data['name']
            location = location_data['location']
            with clients_lock:
                clients[addr] = {'conn': conn, 'name': name, 'location': location}
                # Send updated locations to web clients
                socketio.emit('update_locations', get_locations())
    except Exception as e:
        print(f"[ERROR] {addr} disconnected abruptly: {e}")
    finally:
        with clients_lock:
            if addr in clients:
                del clients[addr]
                socketio.emit('update_locations', get_locations())
            conn.close()
            print(f"[DISCONNECT] {addr} connection closed.")


def get_locations():
    with clients_lock:
        return {
            str(addr): {'name': client['name'], 'location': client['location']}
            for addr, client in clients.items()
        }
        
def recvall(conn, n):
    """Helper function to receive n bytes or return None if EOF is hit"""
    data = bytearray()
    while len(data) < n:
        packet = conn.recv(n - len(data))
        if not packet:
            return None
        data.extend(packet)
    return data


def start_server():
    print("[STARTING] Leader server is starting...")
    server = eventlet.listen((HOST, PORT))
    print(f"[LISTENING] Leader is listening on port {PORT}.")

    while True:
        conn, addr = server.accept()
        # Use eventlet's spawn to handle client connections
        eventlet.spawn_n(handle_client, conn, addr)

if __name__ == "__main__":
    # Start the TCP server in a background thread
    eventlet.spawn_n(start_server)
    print(f"[WEB SERVER] Starting web server on port {WEB_PORT}...")
    socketio.run(app, host='0.0.0.0', port=WEB_PORT)
