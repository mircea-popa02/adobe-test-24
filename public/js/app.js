const socket = io();

// Initialize the map
const map = L.map('map').setView([0, 0], 15);

// Use local tiles
L.tileLayer('/tiles/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// Layer groups for users and markers
const usersLayer = L.layerGroup().addTo(map);
const markersLayer = L.layerGroup().addTo(map);

// Variable to store the user's current position
let currentPosition = null;

// Function to update user location
function updateLocation(position) {
  currentPosition = position; // Store the current position
  const { latitude, longitude } = position.coords;
  socket.emit('sendLocation', { id: socket.id, lat: latitude, lng: longitude });
}

// Get user's location
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(updateLocation, handleLocationError);
} else {
  alert('Geolocation is not supported by this browser.');
  promptForLocation();
}

// Handle geolocation errors
function handleLocationError(error) {
  console.error('Error getting location:', error);
  promptForLocation();
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
    socket.emit('sendLocation', { id: socket.id, lat: lat, lng: lng });
    map.setView([lat, lng], 15);
  } else {
    alert('Invalid coordinates.');
  }
}

// Handle receiving location updates
socket.on('updateLocation', (data) => {
  // Update or add user marker
  let userMarker = usersLayer.getLayer(data.id);
  if (userMarker) {
    userMarker.setLatLng([data.lat, data.lng]);
  } else {
    const marker = L.circleMarker([data.lat, data.lng], {
      color: 'blue',
      radius: 8,
    });
    marker._leaflet_id = data.id; // Assign the socket ID as the marker ID
    marker.addTo(usersLayer);
  }
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

// Function to add a ghost marker to the map
function addGhostMarker(data) {
  const ghostIcon = L.icon({
    iconUrl: 'images/ghost.png', // Ensure you have this image
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
  L.marker([data.lat, data.lng], { icon: ghostIcon }).addTo(markersLayer);
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
    // Prompt user to enter location manually
    const lat = parseFloat(prompt('Enter latitude of the danger location:'));
    const lng = parseFloat(prompt('Enter longitude of the danger location:'));
    if (!isNaN(lat) && !isNaN(lng)) {
      const dangerMessage = 'Danger reported!';
      socket.emit('dangerAlert', {
        message: dangerMessage,
        lat: lat,
        lng: lng,
        senderId: socket.id,
      });
    } else {
      alert('Invalid coordinates. Danger alert not sent.');
      return;
    }
  }

  canSendAlert = false;
  setTimeout(() => {
    canSendAlert = true;
  }, 10000); // 10-second cooldown
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

  // Create a pulsing circle at the danger location
  const dangerCircle = L.circle([data.lat, data.lng], {
    color: 'red',
    fillColor: '#f03',
    fillOpacity: 0.5,
    radius: 50,
  }).addTo(map);

  // Flash the circle by changing its opacity
  let opacity = 0.5;
  const flashInterval = setInterval(() => {
    opacity = opacity === 0.5 ? 0 : 0.5;
    dangerCircle.setStyle({ fillOpacity: opacity });
  }, 500);

  // Stop flashing after 5 seconds
  setTimeout(() => {
    clearInterval(flashInterval);
    map.removeLayer(dangerCircle);
  }, 5000);
});

// Handle location error
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});
