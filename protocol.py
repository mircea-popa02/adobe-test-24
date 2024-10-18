# protocol.py

import pickle
import struct
import socket
from datetime import datetime  # Ensure this import is present

class NetworkProtocol:
    """Simple protocol for sending/receiving Python objects over network"""

    @staticmethod
    def send_data(sock, data):
        """
        Send data over a socket with length prefix
        Args:
            sock: Connected socket object
            data: Any pickle-able Python object
        """
        try:
            # Serialize the data
            serialized = pickle.dumps(data)
            # Pack the length as a 4-byte big-endian integer
            length = struct.pack('!I', len(serialized))
            # Send length followed by data
            sock.sendall(length + serialized)
            print(f"[{datetime.now()}] [DEBUG] Sent data of length {len(serialized)}")
            return True
        except Exception as e:
            print(f"[{datetime.now()}] [ERROR] Error sending data: {e}")
            return False

    @staticmethod
    def receive_data(sock):
        """
        Receive data from a socket
        Args:
            sock: Connected socket object
        Returns:
            Received Python object or None if error
        """
        try:
            # Set a timeout for the socket to prevent blocking indefinitely
            sock.settimeout(10.0)  # 10-second timeout
            # Get the length (4 bytes)
            length_data = sock.recv(4)
            if not length_data:
                return None

            # Unpack the length
            length = struct.unpack('!I', length_data)[0]

            # Get the actual data
            data = b''
            remaining = length
            while remaining > 0:
                chunk = sock.recv(min(remaining, 4096))
                if not chunk:
                    return None
                data += chunk
                remaining -= len(chunk)

            # Reset the timeout
            sock.settimeout(None)

            # Deserialize and return
            result = pickle.loads(data)
            print(f"[{datetime.now()}] [DEBUG] Received and deserialized data: {result}")
            return result

        except socket.timeout:
            print(f"[{datetime.now()}] [ERROR] Socket receive timed out")
            return None
        except Exception as e:
            print(f"[{datetime.now()}] [ERROR] Error receiving data: {e}")
            return None
