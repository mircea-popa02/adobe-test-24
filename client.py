import socket
import threading
import pickle
import time
import random
from gps3 import gps3  # Add this import
import socket as py_socket  # For getting the hostname

SERVER_IP = '192.168.100.52'  # Replace with the leader's IP address
PORT = 65432

class Client:
    def __init__(self):
        self.name = py_socket.gethostname()
        self.location = self.get_initial_location()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.connect_to_server()

        # Start sending location periodically
        threading.Thread(target=self.send_location_periodically, daemon=True).start()

    def get_initial_location(self):
        gps_socket = gps3.GPSDSocket()
        data_stream = gps3.DataStream()
        gps_socket.connect()
        gps_socket.watch()
        for new_data in gps_socket:
            if new_data:
                data_stream.unpack(new_data)
                latitude = data_stream.TPV['lat']
                longitude = data_stream.TPV['lon']
                if latitude != 'n/a' and longitude != 'n/a':
                    return (latitude, longitude)
        # If GPS data is not available, return default or raise an error
        print("GPS data not available.")
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
                data = {'name': self.name, 'location': self.location}
                data = pickle.dumps(data)
                self.sock.sendall(data)
                print(f"[SENT] Location sent: {self.location}")
            except BrokenPipeError:
                print("[DISCONNECTED] Lost connection to the leader. Reconnecting...")
                self.sock.close()
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.connect_to_server()
            time.sleep(2)  # Send location every 2 seconds

    # Remove the movement simulation loop if using actual GPS data

if __name__ == "__main__":
    client = Client()
    # No need for movement simulation if using real GPS data
    while True:
        time.sleep(5)
