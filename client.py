import socket
import threading
import pickle
import time
import geocoder
import socket as py_socket  # For getting the hostname

SERVER_IP = '192.168.100.52'  # Replace with the leader's IP address
PORT = 65432

class Client:
    def __init__(self):
        self.name = py_socket.gethostname()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.connect_to_server()

        # Start sending location periodically
        threading.Thread(target=self.send_location_periodically, daemon=True).start()

    def get_location(self):
        try:
            g = geocoder.ip('me')
            if g.ok:
                return g.latlng  # Returns [latitude, longitude]
            else:
                print("[ERROR] Geocoder could not find location.")
                return (0.0, 0.0)
        except Exception as e:
            print(f"[ERROR] {e}")
            return (0.0, 0.0)

    def connect_to_server(self):
        while True:
            try:
                self.sock.connect((SERVER_IP, PORT))
                print("[CONNECTED] Connected to the leader.")
                break
            except ConnectionRefusedError:
                print("[RETRY] Leader not available. Retrying in 5 seconds...")
                time.sleep(5)

    def send_location_periodically(self):
        while True:
            try:
                location = self.get_location()
                data = {'name': self.name, 'location': location}
                data = pickle.dumps(data)
                data_length = len(data)
                data_length_packed = data_length.to_bytes(4, byteorder='big')
                self.sock.sendall(data_length_packed + data)
                print(f"[SENT] Location sent: {location}")
            except BrokenPipeError:
                print("[DISCONNECTED] Lost connection to the leader. Reconnecting...")
                self.sock.close()
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.connect_to_server()
            except Exception as e:
                print(f"[ERROR] {e}")
            time.sleep(10)  # Send location every 10 seconds

if __name__ == "__main__":
    client = Client()
    while True:
        time.sleep(5)
