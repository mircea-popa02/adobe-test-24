# client.py
import socket
import threading
import time
import geocoder
from protocol import NetworkProtocol

SERVER_IP = '192.168.100.52'  # Replace with your server's IP
PORT = 65432

class Client:
    def __init__(self):
        self.name = socket.gethostname()
        self.running = True
        self.connect_to_server()

    def connect_to_server(self):
        """Connect to server with retry logic"""
        while self.running:
            try:
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.sock.connect((SERVER_IP, PORT))
                print("[CONNECTED] Connected to server.")
                self.start_location_updates()
                break
            except ConnectionRefusedError:
                print("[RETRY] Server not available. Retrying in 5 seconds...")
                time.sleep(5)
            except Exception as e:
                print(f"[ERROR] Connection failed: {e}")
                time.sleep(5)

    def get_location(self):
        """Get current location using geocoder"""
        try:
            g = geocoder.ip('me')
            return g.latlng if g.ok else (0.0, 0.0)
        except Exception as e:
            print(f"[ERROR] Location error: {e}")
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
                    
                    if NetworkProtocol.send_data(self.sock, data):
                        print(f"[SENT] Location: {location}")
                    else:
                        print("[ERROR] Failed to send location")
                        break
                        
                    time.sleep(10)  # Wait 10 seconds before next update
                    
                except Exception as e:
                    print(f"[ERROR] Update failed: {e}")
                    break
                    
            # If we break from the loop, try to reconnect
            self.sock.close()
            if self.running:
                print("[RECONNECTING] Lost connection to server...")
                self.connect_to_server()

        # Start update thread
        threading.Thread(target=update_loop, daemon=True).start()

    def stop(self):
        """Stop the client gracefully"""
        self.running = False
        try:
            self.sock.close()
        except:
            pass

if __name__ == "__main__":
    client = Client()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[STOPPING] Client shutting down...")
        client.stop()