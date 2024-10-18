from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
import folium
import bluetooth
import threading

app = Flask(__name__)
socketio = SocketIO(app)

# Global variables
bluetooth_server_socket = None
bluetooth_address = None
gps_location = {'latitude': 0.0, 'longitude': 0.0}
available_devices = []  # List to hold available Bluetooth devices

def scan_bluetooth_devices():
    global available_devices
    print("Scanning for Bluetooth devices...")
    nearby_devices = bluetooth.discover_devices(duration=8, lookup_names=True, flush_cache=True, lookup_class=False)
    available_devices = [(addr, name) for addr, name in nearby_devices]
    print("Available devices:")
    for addr, name in available_devices:
        print(f"{name} - {addr}")

def start_bluetooth_server():
    global bluetooth_server_socket
    bluetooth_server_socket = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    bluetooth_server_socket.bind(("", bluetooth.PORT_ANY))
    bluetooth_server_socket.listen(1)
    print("Waiting for Bluetooth connection...")

    client_socket, address = bluetooth_server_socket.accept()
    print(f"Accepted connection from {address}")

    try:
        while True:
            data = client_socket.recv(1024).decode()
            if not data:
                break
            print(f"Received location: {data}")
    except OSError:
        pass

    print("Disconnected")
    client_socket.close()
    bluetooth_server_socket.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scan')
def scan():
    scan_bluetooth_devices()
    return jsonify(available_devices)

@socketio.on('send_location')
def handle_location(data):
    global gps_location
    gps_location = data
    emit('receive_location', gps_location, broadcast=True)
    send_bluetooth_location(data)

def send_bluetooth_location(location):
    global bluetooth_address
    if bluetooth_address:  # Ensure the Bluetooth address is set
        try:
            client_socket = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
            client_socket.connect((bluetooth_address, 1))
            client_socket.send(f"{location['latitude']},{location['longitude']}")
            client_socket.close()
        except bluetooth.btcommon.BluetoothError as e:
            print(f"Bluetooth error: {e}")

if __name__ == '__main__':
    # Start the Bluetooth scanning process
    scan_bluetooth_devices()
    
    # Start the Bluetooth server in a thread
    threading.Thread(target=start_bluetooth_server, daemon=True).start()
    
    # Run the Flask app
    socketio.run(app)


