const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve map tiles from the 'tiles' directory
app.use('/tiles', express.static(path.join(__dirname, 'tiles')));

// Arrays to store all ghost and danger markers
let ghostMarkers = [];
let dangerMarkers = [];

// Variables to assign unique IDs to markers
let nextGhostMarkerId = 1;
let nextDangerMarkerId = 1;

// Object to store connected users and their locations
let users = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send existing ghost and danger markers to the new client
  socket.emit('existingMarkers', ghostMarkers);
  socket.emit('existingDangerMarkers', dangerMarkers);

  // Send existing users to the new client
  socket.emit('existingUsers', users);

  // Handle receiving location data
  socket.on('sendLocation', (data) => {
    // Update the user's location in the users object
    users[socket.id] = {
      id: socket.id,
      lat: data.lat,
      lng: data.lng,
      name: data.name || 'Anonymous',
    };
    // Broadcast the updated location to all clients
    io.emit('updateLocation', users[socket.id]);
  });

  // Handle placing ghost markers
  socket.on('placeMarker', (data) => {
    // Assign an ID to the marker
    data.id = nextGhostMarkerId++;
    // Add the new marker to the array
    ghostMarkers.push(data);
    // Broadcast the new marker to all clients
    io.emit('newMarker', data);
  });

  // Handle deleting ghost markers
  socket.on('deleteMarker', (data) => {
    // Remove the marker from the array
    ghostMarkers = ghostMarkers.filter(marker => marker.id !== data.id);
    // Broadcast the marker deletion to all clients
    io.emit('removeMarker', data);
  });

  // Handle danger alerts
  socket.on('dangerAlert', (data) => {
    // Assign an ID to the danger marker
    data.id = nextDangerMarkerId++;
    // Store the danger marker
    dangerMarkers.push(data);
    // Broadcast the danger alert to all clients (including sender)
    io.emit('dangerAlert', data);
  });

  // Handle deleting danger markers
  socket.on('deleteDangerMarker', (data) => {
    // Remove the danger marker from the array
    dangerMarkers = dangerMarkers.filter(marker => marker.id !== data.id);
    // Broadcast the marker deletion to all clients
    io.emit('removeDangerMarker', data);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    // Remove the user from the users object
    delete users[socket.id];
    // Broadcast to clients to remove the user's marker
    io.emit('userDisconnected', socket.id);
  });
});

// Start the server
const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
