from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import threading
import time
import bluetooth

app = Flask(__name__)
socketio = SocketIO(app)

# Global variables
gps_location = {'latitude': 0.0, 'longitude': 0.0}
other_device_location = {'latitude': 0.0, 'longitude': 0.0}
service_uuid = "94f39d29-7d6d-437d-973b-fba39e49d4ee"  # Unique UUID for the service

def start_bluetooth_server():
    server_sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    port = bluetooth.PORT_ANY
    server_sock.bind(("", port))
    server_sock.listen(1)
    port = server_sock.getsockname()[1]

    # Advertise the Bluetooth service
    bluetooth.advertise_service(
        server_sock,
        "GPSLocationSharingService",
        service_id=service_uuid,
        service_classes=[service_uuid, bluetooth.SERIAL_PORT_CLASS],
        profiles=[bluetooth.SERIAL_PORT_PROFILE],
    )
    print(f"Bluetooth server started on port {port}")

    while True:
        try:
            client_sock, client_info = server_sock.accept()
            print(f"Accepted Bluetooth connection from {client_info}")
            threading.Thread(target=handle_client_connection, args=(client_sock, client_info), daemon=True).start()
        except Exception as e:
            print(f"Error accepting Bluetooth connection: {e}")
            break

def handle_client_connection(client_sock, client_info):
    global gps_location
    try:
        while True:
            # Send current GPS location to the connected client
            location_data = f"{gps_location['latitude']},{gps_location['longitude']}"
            client_sock.send(location_data.encode())
            time.sleep(5)  # Send location every 5 seconds
    except Exception as e:
        print(f"Bluetooth server error with {client_info}: {e}")
    finally:
        client_sock.close()
        print(f"Bluetooth connection with {client_info} closed")

def start_bluetooth_client():
    while True:
        try:
            # Scan for nearby devices
            print("Scanning for nearby Bluetooth devices...")
            nearby_devices = bluetooth.discover_devices(duration=8, lookup_names=True)
            print(f"Found {len(nearby_devices)} devices")
            for addr, name in nearby_devices:
                print(f"  {addr} - {name}")
                # Search for the service in this device
                services = bluetooth.find_service(address=addr, uuid=service_uuid)
                if services:
                    # Connect to the service
                    for svc in services:
                        host = svc["host"]
                        port = svc["port"]
                        name = svc["name"]
                        print(f"Found service '{name}' on {host}:{port}")
                        try:
                            client_sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
                            client_sock.connect((host, port))
                            print(f"Connected to {host}:{port}")
                            threading.Thread(target=receive_location_from_device, args=(client_sock, addr), daemon=True).start()
                            break  # Break after successful connection
                        except Exception as e:
                            print(f"Failed to connect to {host}:{port}: {e}")
                    else:
                        continue  # Continue to next device
                    break  # Break the device loop if connected
            time.sleep(10)  # Wait before scanning again
        except Exception as e:
            print(f"Bluetooth client error: {e}")
            time.sleep(10)  # Wait before trying again

def receive_location_from_device(client_sock, addr):
    global other_device_location
    try:
        while True:
            data = client_sock.recv(1024).decode()
            if data:
                try:
                    latitude_str, longitude_str = data.strip().split(',')
                    latitude = float(latitude_str)
                    longitude = float(longitude_str)
                    other_device_location = {'latitude': latitude, 'longitude': longitude}
                    # Emit the location to the web client
                    socketio.emit('receive_other_location', other_device_location)
                    print(f"Received location from {addr}: {other_device_location}")
                except ValueError:
                    print(f"Invalid data received from {addr}: {data}")
            else:
                break
    except Exception as e:
        print(f"Error receiving data from {addr}: {e}")
    finally:
        client_sock.close()
        print(f"Bluetooth connection with {addr} closed")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('send_location')
def handle_send_location(data):
    global gps_location
    gps_location = data
    # No need to broadcast via Socket.IO since we're handling via Bluetooth

if __name__ == '__main__':
    # Start the Bluetooth server and client in separate threads
    threading.Thread(target=start_bluetooth_server, daemon=True).start()
    threading.Thread(target=start_bluetooth_client, daemon=True).start()

    # Run the Flask app
    socketio.run(app, host='0.0.0.0', port=5000)
