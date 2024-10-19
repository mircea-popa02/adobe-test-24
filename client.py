# client.py
import socket
import threading
import time
import geocoder
from protocol import NetworkProtocol
from datetime import datetime

SERVER_IP = '192.168.100.52'
PORT = 65432

class Client:
    def __init__(self):
        self.name = socket.gethostname()
        self.running = True
        self.sock = None
        self.connect_to_server()

    def connect_to_server(self):
        """Connect to server with retry logic"""
        while self.running:
            try:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                print(f"[{datetime.now()}] [DEBUG] Attempting connection to {SERVER_IP}:{PORT}")
                self.sock.connect((SERVER_IP, PORT))
                print(f"[{datetime.now()}] [CONNECTED] Connected to server.")
                self.start_location_updates()
                break
            except ConnectionRefusedError:
                print(f"[{datetime.now()}] [RETRY] Server not available. Retrying in 5 seconds...")
                time.sleep(5)
            except Exception as e:
                print(f"[{datetime.now()}] [ERROR] Connection failed: {e}")
                time.sleep(5)

    def get_location(self):
        """Get current location using geocoder"""
        try:
            g = geocoder.ip('me')
            if g.ok and g.latlng:
                location = g.latlng
            else:
                raise ValueError("Geocoder failed to get location.")
            print(f"[{datetime.now()}] [DEBUG] Got location: {location}")
            return location
        except Exception as e:
            print(f"[{datetime.now()}] [ERROR] Location error: {e}")
            return (0.0, 0.0)

    def start_location_updates(self):
        """Start sending location updates in a separate thread"""
        def update_loop():
            while self.running:
                try:
                    # Get and send location
                    location = self.get_location()
                    data = {
                        'name': self.name,
                        'location': location
                    }
                    print(f"[{datetime.now()}] [DEBUG] Preparing to send data: {data}")

                    # Add this line to log the data being sent
                    print(f"[{datetime.now()}] [DEBUG] Sending data to server: {data}")

                    if NetworkProtocol.send_data(self.sock, data):
                        print(f"[{datetime.now()}] [SENT] Successfully sent location: {location}")
                    else:
                        print(f"[{datetime.now()}] [ERROR] Failed to send location")
                        time.sleep(5)
                        continue  # Retry without breaking the loop

                    time.sleep(10)  # Wait 10 seconds before next update

                except Exception as e:
                    print(f"[{datetime.now()}] [ERROR] Update failed: {e}")
                    time.sleep(5)
                    continue  # Continue the loop even after an error

    def update_loop():
        while self.running:
            try:
                # Get and send location
                location = self.get_location()
                data = {
                    'name': self.name,
                    'location': location
                }
                print(f"[{datetime.now()}] [DEBUG] Preparing to send data: {data}")

                # Add this line to log the data being sent
                print(f"[{datetime.now()}] [DEBUG] Sending data to server: {data}")

                if NetworkProtocol.send_data(self.sock, data):
                    print(f"[{datetime.now()}] [SENT] Successfully sent location: {location}")
                else:
                    print(f"[{datetime.now()}] [ERROR] Failed to send location")
                    time.sleep(5)
                    continue  # Retry without breaking the loop

                time.sleep(10)  # Wait 10 seconds before next update

            except Exception as e:
                print(f"[{datetime.now()}] [ERROR] Update failed: {e}")
                time.sleep(5)
                continue  # Continue the loop even after an error

    def stop(self):
        """Stop the client gracefully"""
        self.running = False
        try:
            if self.sock:
                self.sock.close()
        except:
            pass
        print(f"[{datetime.now()}] [DEBUG] Client stopped")

if __name__ == "__main__":
    client = Client()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n[{datetime.now()}] [STOPPING] Client shutting down...")
        client.stop()
