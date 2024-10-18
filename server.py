# server.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO
import pickle
import struct
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

def receive_data(sock):
    """Receive data with detailed logging"""
    try:
        print("[DEBUG] Waiting to receive length...")
        # Get the length (4 bytes)
        length_data = sock.recv(4, socket.MSG_WAITALL)  # Use MSG_WAITALL to ensure we get all 4 bytes
        if not length_data:
            print("[DEBUG] Received empty length data")
            return None
        print(f"[DEBUG] Received length data: {length_data.hex()}")
            
        # Unpack the length
        length = struct.unpack('!I', length_data)[0]
        print(f"[DEBUG] Unpacked length: {length}")
        
        # Get the actual data
        print(f"[DEBUG] Waiting to receive {length} bytes of data...")
        data = sock.recv(length, socket.MSG_WAITALL)  # Use MSG_WAITALL to ensure we get all data
        if not data:
            print("[DEBUG] Received empty data")
            return None
        print(f"[DEBUG] Received {len(data)} bytes of data")
            
        # Try to deserialize
        result = pickle.loads(data)
        print(f"[DEBUG] Successfully deserialized data: {result}")
        return result
            
    except Exception as e:
        print(f"[ERROR] Error in receive_data: {e}")
        return None

def handle_client(conn, addr):
    """Handle individual client connection"""
    print(f"[NEW CONNECTION] {addr} connected.")
    conn.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    
    try:
        while True:
            print(f"[DEBUG] Starting receive loop for {addr}")
            # Receive data using our protocol
            data = receive_data(conn)
            
            if data is None:
                print(f"[DEBUG] Received None from {addr}, breaking connection")
                break
                
            print(f"[RECEIVED] Data from {addr}: {data}")
            
            # Update client information
            with clients_lock:
                try:
                    clients[addr] = {
                        'conn': conn,
                        'name': data['name'],
                        'location': data['location'],
                        'last_update': time.time()
                    }
                    print(f"[DEBUG] Updated client info for {addr}")
                    # Update web clients
                    socketio.emit('update_locations', get_locations())
                    print(f"[DEBUG] Emitted location update to web clients")
                except Exception as e:
                    print(f"[ERROR] Error updating client info: {e}")
                
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
        locations = {
            str(addr): {
                'name': client['name'],
                'location': client['location']
            }
            for addr, client in clients.items()
        }
        print(f"[DEBUG] Current locations: {locations}")
        return locations

def start_server():
    """Start TCP server"""
    print("[STARTING] Server is starting...")
    server = eventlet.listen((HOST, PORT))
    server.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    print(f"[LISTENING] Server is listening on port {PORT}")
    
    while True:
        try:
            conn, addr = server.accept()
            print(f"[DEBUG] New connection accepted from {addr}")
            eventlet.spawn(handle_client, conn, addr)
        except Exception as e:
            print(f"[ERROR] Failed to accept connection: {e}")

if __name__ == "__main__":
    import socket  # Add this import at the top
    eventlet.spawn_n(start_server)
    print(f"[WEB SERVER] Starting web server on port {WEB_PORT}...")
    socketio.run(app, host='0.0.0.0', port=WEB_PORT)