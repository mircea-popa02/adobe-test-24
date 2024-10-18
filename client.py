# client.py
import socket
import threading
import time
import geocoder
import struct
import pickle

SERVER_IP = '192.168.100.52'  # Replace with your server's IP
PORT = 65432

def send_data(sock, data):
    """Send data with detailed logging"""
    try:
        # Serialize the data
        serialized = pickle.dumps(data)
        print(f"[DEBUG] Serialized data length: {len(serialized)}")
        
        # Pack the length as a 4-byte integer
        length = struct.pack('!I', len(serialized))
        print(f"[DEBUG] Packed length: {length.hex()}")
        
        # Send length followed by data
        sock.sendall(length + serialized)
        print(f"[DEBUG] Sent {len(serialized) + 4} bytes total")
        return True
    except Exception as e:
        print(f"[ERROR] Error sending data: {e}")
        return False

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
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                print(f"[DEBUG] Attempting connection to {SERVER_IP}:{PORT}")
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
            location = g.latlng if g.ok else (0.0, 0.0)
            print(f"[DEBUG] Got location: {location}")
            return location
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
                    print(f"[DEBUG] Preparing to send data: {data}")
                    
                    if send_data(self.sock, data):
                        print(f"[SENT] Successfully sent location: {location}")
                    else:
                        print("[ERROR] Failed to send location")
                        break
                        
                    time.sleep(10)  # Wait 10 seconds before next update
                    
                except Exception as e:
                    print(f"[ERROR] Update failed: {e}")
                    break
                    
            # If we break from the loop, try to reconnect
            print("[DEBUG] Update loop ended, closing socket")
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
        print("[DEBUG] Client stopped")

if __name__ == "__main__":
    client = Client()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[STOPPING] Client shutting down...")
        client.stop()