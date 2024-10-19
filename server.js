// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve map tiles from the 'tiles' directory
app.use('/tiles', express.static(path.join(__dirname, 'tiles')));

// Array to store all ghost markers
let ghostMarkers = [];

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send existing ghost markers to the new client
  socket.emit('existingMarkers', ghostMarkers);

  // Handle receiving location data
  socket.on('sendLocation', (data) => {
    io.emit('updateLocation', data);
  });

  // Handle placing markers (ghosts)
  socket.on('placeMarker', (data) => {
    // Add the new marker to the array
    ghostMarkers.push(data);
    // Broadcast the new marker to all clients
    io.emit('newMarker', data);
  });

  // Handle danger alerts
  socket.on('dangerAlert', (data) => {
    // Broadcast the danger alert to all clients except the sender
    socket.broadcast.emit('dangerAlert', data);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

// Start the server
const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
