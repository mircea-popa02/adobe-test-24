import socket
import threading
import pickle
import time
import random

SERVER_IP = '192.168.100.57'  # Replace with the leader's IP address
PORT = 65432

class Client:
    def __init__(self):
        self.location = self.get_initial_location()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.connect_to_server()

        # Start sending location periodically
        threading.Thread(target=self.send_location_periodically, daemon=True).start()

    def get_initial_location(self):
        # Simulate initial location or get from user input
        # For Romania, latitude ranges roughly from 43.6187 to 48.2654
        # Longitude ranges roughly from 20.2619 to 29.6793
        latitude = random.uniform(43.6187, 48.2654)
        longitude = random.uniform(20.2619, 29.6793)
        return (latitude, longitude)

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
                data = pickle.dumps(self.location)
                self.sock.sendall(data)
            except BrokenPipeError:
                print("[DISCONNECTED] Lost connection to the leader. Reconnecting...")
                self.sock.close()
                self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.connect_to_server()
            time.sleep(2)  # Send location every 2 seconds

if __name__ == "__main__":
    client = Client()
    # Simulate movement (optional)
    while True:
        # Slightly change the location
        lat_change = random.uniform(-0.001, 0.001)
        lon_change = random.uniform(-0.001, 0.001)
        client.location = (client.location[0] + lat_change, client.location[1] + lon_change)
        time.sleep(5)
