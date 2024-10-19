const socket = io();

// Function to initialize the user's name
function initializeUserName() {
  let userName = localStorage.getItem('userName');
  if (!userName) {
    // Prompt the user for their name
    userName = prompt('Enter your name:') || 'Anonymous';
    // Save the name to localStorage
    localStorage.setItem('userName', userName);
  }
  return userName;
}

// Initialize the user's name
const userName = initializeUserName();

// Initialize the map
const map = L.map('map').setView([44.4268, 26.1025], 13);

// Use local tiles
L.tileLayer('/tiles/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// Layer groups for users and markers
const usersLayer = L.layerGroup().addTo(map);
const markersLayer = L.layerGroup().addTo(map);
const dangerLayer = L.layerGroup().addTo(map);

// Objects to store markers
const userMarkers = {};
const ghostMarkers = {};
const dangerMarkers = {};

// Variable to store the user's current position
let currentPosition = null;

// Function to update user location
function updateLocation(position) {
  currentPosition = position; // Store the current position
  const { latitude, longitude } = position.coords;
  // Save location to localStorage
  localStorage.setItem('userLocation', JSON.stringify({ latitude, longitude }));
  socket.emit('sendLocation', { id: socket.id, lat: latitude, lng: longitude, name: userName });
}

// Function to get location via IP-based geolocation
function getLocationByIP() {
  fetch('https://ipapi.co/json/')
    .then(response => response.json())
    .then(data => {
      const latitude = parseFloat(data.latitude);
      const longitude = parseFloat(data.longitude);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        currentPosition = {
          coords: {
            latitude: latitude,
            longitude: longitude,
          },
        };
        // Save location to localStorage
        localStorage.setItem('userLocation', JSON.stringify({ latitude, longitude }));
        socket.emit('sendLocation', { id: socket.id, lat: latitude, lng: longitude, name: userName });
        map.setView([latitude, longitude], 15);
      } else {
        promptForLocation();
      }
    })
    .catch(error => {
      console.error('IP-based geolocation failed:', error);
      promptForLocation();
    });
}

// Prompt user for manual location input
function promptForLocation() {
  const lat = parseFloat(prompt('Enter your latitude:'));
  const lng = parseFloat(prompt('Enter your longitude:'));
  if (!isNaN(lat) && !isNaN(lng)) {
    currentPosition = {
      coords: {
        latitude: lat,
        longitude: lng,
      },
    };
    // Save location to localStorage
    localStorage.setItem('userLocation', JSON.stringify({ latitude: lat, longitude: lng }));
    socket.emit('sendLocation', { id: socket.id, lat: lat, lng: lng, name: userName });
    map.setView([lat, lng], 15);
  } else {
    alert('Invalid coordinates.');
  }
}

// Function to initialize location
function initializeLocation() {
  // Check if location is stored in localStorage
  const storedLocation = localStorage.getItem('userLocation');
  if (storedLocation) {
    const { latitude, longitude } = JSON.parse(storedLocation);
    currentPosition = {
      coords: {
        latitude: latitude,
        longitude: longitude,
      },
    };
    socket.emit('sendLocation', { id: socket.id, lat: latitude, lng: longitude, name: userName });
    map.setView([latitude, longitude], 15);
  } else if (navigator.geolocation) {
    // Try to get location via browser geolocation
    navigator.geolocation.getCurrentPosition(updateLocation, handleLocationError);
  } else {
    // Fallback to IP-based geolocation
    getLocationByIP();
  }
}

// Handle geolocation errors
function handleLocationError(error) {
  console.error('Error getting location:', error);
  if (error.code === error.PERMISSION_DENIED) {
    // If permission is denied, use IP-based geolocation
    getLocationByIP();
  } else {
    // For other errors, prompt for manual input
    promptForLocation();
  }
}

// Initialize location on page load
initializeLocation();

// Function to add or update a user marker
function addOrUpdateUserMarker(data) {
  const { id, lat, lng, name } = data;
  let userMarker = userMarkers[id];
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    const marker = L.circleMarker([lat, lng], {
      color: 'blue',
      radius: 8,
    }).addTo(usersLayer);
    // Bind a tooltip to show the name on hover
    marker.bindTooltip(name, { permanent: false, direction: 'top', offset: [0, -10] });
    userMarkers[id] = marker;
  }
}

// Handle receiving existing user locations
socket.on('existingUsers', (usersData) => {
  // usersData is an object where key is socket.id and value is user data
  Object.values(usersData).forEach((data) => {
    addOrUpdateUserMarker(data);
  });
});

// Handle receiving location updates
socket.on('updateLocation', (data) => {
  addOrUpdateUserMarker(data);
});

// Handle user disconnection
socket.on('userDisconnected', (id) => {
  if (userMarkers[id]) {
    usersLayer.removeLayer(userMarkers[id]);
    delete userMarkers[id];
  }
});

// Handle map clicks to place ghost markers
map.on('click', (e) => {
  const markerData = { lat: e.latlng.lat, lng: e.latlng.lng };
  socket.emit('placeMarker', markerData);
});

// Handle receiving existing ghost markers
socket.on('existingMarkers', (markers) => {
  markersLayer.clearLayers(); // Clear any existing markers
  markers.forEach((data) => {
    addGhostMarker(data);
  });
});

// Handle receiving new ghost markers
socket.on('newMarker', (data) => {
  addGhostMarker(data);
});

// Handle removing ghost markers
socket.on('removeMarker', (data) => {
  // Remove the marker from the map
  if (ghostMarkers[data.id]) {
    markersLayer.removeLayer(ghostMarkers[data.id]);
    delete ghostMarkers[data.id];
  }
});

// Function to add a ghost marker to the map
function addGhostMarker(data) {
  const ghostIcon = L.icon({
    iconUrl: 'images/ghost.png', // Ensure you have this image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
  const marker = L.marker([data.lat, data.lng], { icon: ghostIcon }).addTo(markersLayer);

  // Store the marker with its ID
  ghostMarkers[data.id] = marker;

  // Add click event to delete the marker
  marker.on('click', () => {
    if (confirm('Do you want to delete this ghost marker?')) {
      // Emit an event to delete the marker
      socket.emit('deleteMarker', { id: data.id });
    }
  });
}

// Add event listener to the alert button
let canSendAlert = true;

document.getElementById('alert-btn').addEventListener('click', () => {
  if (!canSendAlert) {
    alert('Please wait before sending another alert.');
    return;
  }

  if (currentPosition) {
    const { latitude, longitude } = currentPosition.coords;
    const dangerMessage = 'Danger reported!';
    socket.emit('dangerAlert', {
      message: dangerMessage,
      lat: latitude,
      lng: longitude,
      senderId: socket.id,
    });
  } else {
    alert('Unable to determine your location.');
    return;
  }

  canSendAlert = false;
  setTimeout(() => {
    canSendAlert = true;
  }, 10000); // 10-second cooldown
});

// Handle receiving existing danger markers
socket.on('existingDangerMarkers', (markers) => {
  markers.forEach((data) => {
    addDangerMarker(data);
  });
});

// Handle receiving a danger alert
socket.on('dangerAlert', (data) => {
  // Play the alert sound
  document.getElementById('alert-sound').play();

  // Display the alert message in the alert panel
  const alertPanel = document.getElementById('alert-panel');
  const alertMessage = document.createElement('div');
  alertMessage.className = 'alert-message';
  alertMessage.innerHTML = `
    ${data.message} at (${data.lat.toFixed(5)}, ${data.lng.toFixed(5)})
    <button class="close-alert">Dismiss</button>
  `;
  alertPanel.appendChild(alertMessage);

  // Add event listener to the dismiss button
  alertMessage.querySelector('.close-alert').addEventListener('click', () => {
    alertPanel.removeChild(alertMessage);
  });

  // Remove the alert message after 10 seconds if not dismissed
  setTimeout(() => {
    if (alertPanel.contains(alertMessage)) {
      alertPanel.removeChild(alertMessage);
    }
  }, 10000);

  // Add danger icon marker at the danger location
  addDangerMarker(data);

  // Create a pulsing circle at the danger location
  const dangerCircle = L.circle([data.lat, data.lng], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 50,
  }).addTo(dangerLayer);

  // Flash the circle by changing its opacity
  let opacity = 0.5;
  const flashInterval = setInterval(() => {
    opacity = opacity === 0.5 ? 0 : 0.5;
    dangerCircle.setStyle({ fillOpacity: opacity });
  }, 500);

  // Stop flashing after 5 seconds
  setTimeout(() => {
    clearInterval(flashInterval);
    dangerLayer.removeLayer(dangerCircle);
  }, 5000);
});

// Function to add a danger marker to the map
function addDangerMarker(data) {
  const dangerIcon = L.icon({
    iconUrl: 'images/danger.png', // Ensure you have this image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const marker = L.marker([data.lat, data.lng], { icon: dangerIcon }).addTo(dangerLayer);

  // Store the marker with its ID
  dangerMarkers[data.id] = marker;

  // Add click event to delete the marker
  marker.on('click', () => {
    if (confirm('Do you want to delete this danger marker?')) {
      // Emit an event to delete the danger marker
      socket.emit('deleteDangerMarker', { id: data.id });
    }
  });
}

// Handle removing danger markers
socket.on('removeDangerMarker', (data) => {
  // Remove the danger marker from the map
  if (dangerMarkers[data.id]) {
    dangerLayer.removeLayer(dangerMarkers[data.id]);
    delete dangerMarkers[data.id];
  }
});

// Add event listener to the update location button
document.getElementById('update-location-btn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(updateLocation, handleLocationError);
  } else {
    // Fallback to IP-based geolocation
    getLocationByIP();
  }
});

// Handle socket connection errors
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});
