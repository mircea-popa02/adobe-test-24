# server.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO
import time

from protocol import NetworkProtocol
from datetime import datetime

HOST = ''
PORT = 65432
WEB_PORT = 5000

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

# Store client info
clients = {}
clients_lock = eventlet.semaphore.Semaphore()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/tiles/<path:filename>')
def tiles(filename):
    return send_from_directory('tiles', filename)

def handle_client(conn, addr):
    """Handle individual client connection"""
    print(f"[{datetime.now()}] [NEW CONNECTION] {addr} connected.")

    try:
        while True:
            print(f"[{datetime.now()}] [DEBUG] Starting receive loop for {addr}")
            # Receive data using our protocol
            data = NetworkProtocol.receive_data(conn)

            if data is None:
                print(f"[{datetime.now()}] [DEBUG] Received None from {addr}, breaking connection")
                break

            print(f"[{datetime.now()}] [RECEIVED] Data from {addr}: {data}")

            # Add this line to log the received data in detail
            print(f"[{datetime.now()}] [DEBUG] Data received from client {addr}: {data}")

            # Update client information
            with clients_lock:
                try:
                    clients[addr] = {
                        'conn': conn,
                        'name': data['name'],
                        'location': data['location'],
                        'last_update': time.time()
                    }
                    print(f"[{datetime.now()}] [DEBUG] Updated client info for {addr}")
                    # Update web clients
                    socketio.emit('update_locations', get_locations())
                    print(f"[{datetime.now()}] [DEBUG] Emitted location update to web clients")
                except Exception as e:
                    print(f"[{datetime.now()}] [ERROR] Error updating client info: {e}")

    except Exception as e:
        print(f"[{datetime.now()}] [ERROR] Exception for {addr}: {e}")

    finally:
        # Cleanup on disconnect
        with clients_lock:
            if addr in clients:
                del clients[addr]
                socketio.emit('update_locations', get_locations())
        conn.close()
        print(f"[{datetime.now()}] [DISCONNECT] {addr} connection closed.")

def get_locations():
    """Get current client locations"""
    with clients_lock:
        locations = {
            str(addr): {
                'name': client['name'],
                'location': client['location']
            }
            for addr, client in clients.items()
        }
        print(f"[{datetime.now()}] [DEBUG] Current locations being sent to web clients: {locations}")
        return locations

def start_server():
    """Start TCP server"""
    print(f"[{datetime.now()}] [STARTING] Server is starting...")
    server = eventlet.listen((HOST, PORT))
    print(f"[{datetime.now()}] [LISTENING] Server is listening on port {PORT}")

    while True:
        try:
            conn, addr = server.accept()
            print(f"[{datetime.now()}] [DEBUG] New connection accepted from {addr}")
            eventlet.spawn(handle_client, conn, addr)
        except Exception as e:
            print(f"[{datetime.now()}] [ERROR] Failed to accept connection: {e}")

if __name__ == "__main__":
    eventlet.spawn_n(start_server)
    print(f"[{datetime.now()}] [WEB SERVER] Starting web server on port {WEB_PORT}...")
    socketio.run(app, host='0.0.0.0', port=WEB_PORT)
