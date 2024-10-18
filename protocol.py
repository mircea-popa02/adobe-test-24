
# protocol.py - shared between client and server

import pickle
import struct

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
            # Pack the length as a 4-byte integer
            length = struct.pack('!I', len(serialized))
            # Send length followed by data
            sock.sendall(length + serialized)
            return True
        except Exception as e:
            print(f"Error sending data: {e}")
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
                
            # Deserialize and return
            return pickle.loads(data)
            
        except Exception as e:
            print(f"Error receiving data: {e}")
            return None