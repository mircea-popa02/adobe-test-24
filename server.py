# server.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO
from protocol import NetworkProtocol
import time

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
    print(f"[NEW CONNECTION] {addr} connected.")
    
    try:
        while True:
            # Receive data using our protocol
            data = NetworkProtocol.receive_data(conn)
            if not data:
                break
                
            print(f"[RECEIVED] Data from {addr}: {data}")
            
            # Update client information
            with clients_lock:
                clients[addr] = {
                    'conn': conn,
                    'name': data['name'],
                    'location': data['location'],
                    'last_update': time.time()
                }
                # Update web clients
                socketio.emit('update_locations', get_locations())
                
    except Exception as e:
        print(f"[ERROR] Exception for {addr}: {e}")
        
    finally:
        # Cleanup on disconnect
        with clients_lock:
            if addr in clients:
                del clients[addr]
                socketio.emit('update_locations', get_locations())
        conn.close()
        print(f"[DISCONNECT] {addr} connection closed.")

def get_locations():
    """Get current client locations"""
    with clients_lock:
        return {
            str(addr): {
                'name': client['name'],
                'location': client['location']
            }
            for addr, client in clients.items()
        }

def start_server():
    """Start TCP server"""
    print("[STARTING] Server is starting...")
    server = eventlet.listen((HOST, PORT))
    print(f"[LISTENING] Server is listening on port {PORT}")
    
    while True:
        try:
            conn, addr = server.accept()
            eventlet.spawn(handle_client, conn, addr)
        except Exception as e:
            print(f"[ERROR] Failed to accept connection: {e}")

if __name__ == "__main__":
    eventlet.spawn_n(start_server)
    print(f"[WEB SERVER] Starting web server on port {WEB_PORT}...")
    socketio.run(app, host='0.0.0.0', port=WEB_PORT)