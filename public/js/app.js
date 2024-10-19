// public/js/app.js

// Connect to the Socket.io server
const socket = io();
let userName;

// --------------------
// Helper Functions
// --------------------

// Function to initialize the user's name
async function initializeUserName() {
  userName = localStorage.getItem("userName");
  if (!userName) {
    // Prompt the user for their name
    const inputName = await customPrompt("Enter your name:");
    userName =
      inputName && inputName.trim() !== "" ? inputName.trim() : "Anonymous";
    // Save the name to localStorage
    localStorage.setItem("userName", userName);
  }
  return userName;
}

initializeUserName().then((name) => {
  userName = name;
  initializeLocation();
});

// Function to get location via IP-based geolocation
function getLocationByIP() {
  fetch("https://ipapi.co/json/")
    .then((response) => response.json())
    .then((data) => {
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
        localStorage.setItem(
          "userLocation",
          JSON.stringify({ latitude, longitude })
        );
        // Emit location to server
        socket.emit("sendLocation", {
          id: socket.id,
          lat: latitude,
          lng: longitude,
          name: userName,
        });
        // Center map on new location
        map.setView([latitude, longitude], 15);
      } else {
        promptForLocation();
      }
    })
    .catch((error) => {
      console.error("IP-based geolocation failed:", error);
      promptForLocation();
    });
}

// Function to prompt user for manual location input
async function promptForLocation() {
  const latInput = await customPrompt("Enter your latitude:");
  const lngInput = await customPrompt("Enter your longitude:");

  const lat = parseFloat(latInput);
  const lng = parseFloat(lngInput);

  if (!isNaN(lat) && !isNaN(lng)) {
    currentPosition = {
      coords: {
        latitude: lat,
        longitude: lng,
      },
    };
    // Save location to localStorage
    localStorage.setItem(
      "userLocation",
      JSON.stringify({ latitude: lat, longitude: lng })
    );
    // Emit location to server
    socket.emit("sendLocation", {
      id: socket.id,
      lat: lat,
      lng: lng,
      name: userName,
    });
    // Center map on new location
    map.setView([lat, lng], 15);
  } else {
    await customAlert("Invalid coordinates.");
    showCustomNotification("Invalid coordinates. Please try again.");
  }
}

// Function to handle geolocation errors
function handleLocationError(error) {
  console.error("Error getting location:", error);
  if (error.code === error.PERMISSION_DENIED) {
    // If permission is denied, use IP-based geolocation
    getLocationByIP();
  } else {
    // For other errors, prompt for manual input
    promptForLocation();
  }
}

// Function to calculate time elapsed since timestamp
function timeElapsed(timestamp) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `${diffHours} hour(s) ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute(s) ago`;
  } else {
    return `${diffSeconds} second(s) ago`;
  }
}

// --------------------
// Initialize the Map
// --------------------

// Create the map and set initial view
const map = L.map("map").setView([44.4268, 26.1025], 13);

// Add local tile layer
L.tileLayer("/tiles/{z}/{x}/{y}.png", {
  maxZoom: 16,
}).addTo(map);

// Layer groups for users, ghost markers, danger markers, and user journeys
const usersLayer = L.layerGroup().addTo(map);
const markersLayer = L.layerGroup().addTo(map);
const dangerLayer = L.layerGroup().addTo(map);
const journeysLayer = L.layerGroup().addTo(map); // New layer for user journeys

// Objects to store markers and user journeys
const userMarkers = {};
const ghostMarkers = {};
const dangerMarkers = {};
const userJourneys = {}; // New object to store user journeys

// Variable to store the user's current position
let currentPosition = null;

// Variable to track if we are in "set location" mode
let isSettingLocation = false;

// --------------------
// Initialize Location
// --------------------

// Function to initialize location
function initializeLocation() {
  // Check if location is stored in localStorage
  const storedLocation = localStorage.getItem("userLocation");
  if (storedLocation) {
    const { latitude, longitude } = JSON.parse(storedLocation);
    currentPosition = {
      coords: {
        latitude: latitude,
        longitude: longitude,
      },
    };
    // Emit location to server
    socket.emit("sendLocation", {
      id: socket.id,
      lat: latitude,
      lng: longitude,
      name: userName,
    });
    // Center map on stored location
    map.setView([latitude, longitude], 15);
  } else if (navigator.geolocation) {
    // Try to get location via browser geolocation
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleLocationError
    );
  } else {
    // Fallback to IP-based geolocation
    getLocationByIP();
  }
}

// Initialize location on page load
initializeLocation();

// Function to update user location
function updateLocation(position) {
  currentPosition = position; // Store the current position
  const { latitude, longitude } = position.coords;
  // Save location to localStorage
  localStorage.setItem("userLocation", JSON.stringify({ latitude, longitude }));
  // Emit location to server
  socket.emit("sendLocation", {
    id: socket.id,
    lat: latitude,
    lng: longitude,
    name: userName,
  });
  // Center map on new location
  map.setView([latitude, longitude], 15);
}

// --------------------
// Handle Map Clicks
// --------------------

// Handle map clicks to place ghost markers or set location
map.on("click", (e) => {
  if (isSettingLocation) {
    // User is setting their location
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    currentPosition = {
      coords: {
        latitude: lat,
        longitude: lng,
      },
    };

    // Save location to localStorage
    localStorage.setItem(
      "userLocation",
      JSON.stringify({ latitude: lat, longitude: lng })
    );

    // Emit location to server
    socket.emit("sendLocation", {
      id: socket.id,
      lat: lat,
      lng: lng,
      name: userName,
    });

    // Center map on new location
    map.setView([lat, lng], 15);
    showCustomNotification("You have changed your location!");

    // Exit "set location" mode
    isSettingLocation = false;
  } else {
    // Handle placing ghost markers
    const markerData = {
      id: generateUniqueId(),
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      name: userName,
      timestamp: Date.now(),
    };
    socket.emit("placeMarker", markerData);
  }
});

// --------------------
// Update Location Button
// --------------------

// Add event listener to the update location button
document
  .getElementById("update-location-btn")
  .addEventListener("click", () => {
    isSettingLocation = true;
    showCustomNotification("Click on the map to set your new location.");
  });

// --------------------
// User Marker Management
// --------------------

// Function to add or update a user marker
function addOrUpdateUserMarker(data) {
  const { id, lat, lng, name } = data;
  let userMarker = userMarkers[id];
  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
  } else {
    const marker = L.circleMarker([lat, lng], {
      color: "blue",
      radius: 8,
    }).addTo(usersLayer);
    // Bind a tooltip to show the name on hover
    marker.bindTooltip(name, {
      permanent: false,
      direction: "top",
      offset: [0, -10],
    });
    userMarkers[id] = marker;

    // Initialize journey for the user
    if (!userJourneys[id]) {
      userJourneys[id] = {
        polyline: L.polyline([], { color: getRandomColor() }).addTo(journeysLayer),
        path: [],
      };
    }
  }

  // Add the new location to the user's journey
  if (userJourneys[id]) {
    const newLatLng = [lat, lng];
    userJourneys[id].path.push(newLatLng);
    userJourneys[id].polyline.setLatLngs(userJourneys[id].path);
  }
}

// Handle receiving existing user locations
socket.on("existingUsers", (usersData) => {
  // usersData is an object where key is socket.id and value is user data
  Object.values(usersData).forEach((data) => {
    addOrUpdateUserMarker(data);
  });
});

// Handle receiving location updates
socket.on("updateLocation", (data) => {
  addOrUpdateUserMarker(data);
});

// Handle user disconnection
socket.on("userDisconnected", (id) => {
  if (userMarkers[id]) {
    usersLayer.removeLayer(userMarkers[id]);
    delete userMarkers[id];
  }
  // Remove user journey
  if (userJourneys[id]) {
    journeysLayer.removeLayer(userJourneys[id].polyline);
    delete userJourneys[id];
  }
});

// --------------------
// Ghost Marker Management
// --------------------

// Function to generate a unique ID for ghost markers
function generateUniqueId() {
  return 'ghost-' + Math.random().toString(36).substr(2, 9);
}

// Function to add a ghost marker to the map
function addGhostMarker(data) {
  const ghostIcon = L.icon({
    iconUrl: "images/ghost.png", // Ensure you have this image in 'public/images/'
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const marker = L.marker([data.lat, data.lng], { icon: ghostIcon }).addTo(
    markersLayer
  );

  // Store the marker with its ID
  ghostMarkers[data.id] = marker;

  // Store the data object within the marker for easy access
  marker.options.data = data;

  // Bind a tooltip to show the ghost's name
  marker.bindTooltip(data.name, {
    permanent: false,
    direction: "top",
    offset: [0, -10],
  });

  // Create and bind the "Last Seen" tooltip
  const lastSeenTooltip = L.tooltip({
    direction: "bottom",
    offset: [0, 10],
    opacity: 0.8,
  }).setContent(`Last seen: ${timeElapsed(data.timestamp)}`);

  marker.bindTooltip(lastSeenTooltip, {
    permanent: false,
    interactive: false,
  });

  // Update the "Last Seen" tooltip on mouseover
  marker.on("mouseover", () => {
    const elapsedTime = timeElapsed(data.timestamp);
    lastSeenTooltip.setContent(`Last seen: ${elapsedTime}`);
    marker.openTooltip(lastSeenTooltip);
  });

  // Close the tooltip on mouseout
  marker.on("mouseout", () => {
    marker.closeTooltip(lastSeenTooltip);
  });

  // Add click event to delete the marker
  marker.on("click", async () => {
    const userConfirmed = await customConfirm(
      "Do you want to delete this ghost marker?"
    );
    if (userConfirmed) {
      socket.emit("deleteMarker", { id: data.id });
      showCustomNotification("You have removed a ghost!");
    }
  });
}

// Handle receiving existing ghost markers
socket.on("existingMarkers", (markers) => {
  markersLayer.clearLayers(); // Clear any existing markers
  markers.forEach((data) => {
    addGhostMarker(data);
  });
});

// Handle receiving new ghost markers
socket.on("newMarker", (data) => {
  addGhostMarker(data);
  showCustomNotification("A new ghost was discovered!");
});

// Handle removing ghost markers
socket.on("removeMarker", (data) => {
  // Remove the marker from the map
  if (ghostMarkers[data.id]) {
    markersLayer.removeLayer(ghostMarkers[data.id]);
    delete ghostMarkers[data.id];
  }
});

// --------------------
// Danger Alert Management
// --------------------

// Function to add a danger marker to the map
function addDangerMarker(data) {
  const dangerIcon = L.icon({
    iconUrl: "images/danger.png", // Ensure you have this image in 'public/images/'
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  const marker = L.marker([data.lat, data.lng], { icon: dangerIcon }).addTo(
    dangerLayer
  );

  // Store the marker with its ID
  dangerMarkers[data.id] = marker;

  // Add click event to show time elapsed and possibly delete
  marker.on("click", async () => {
    const userConfirmed = await customConfirm(
      "Do you want to delete this danger alert?"
    );
    if (userConfirmed) {
      socket.emit("deleteDangerMarker", { id: data.id });
      showCustomNotification("You have removed a danger alert!");
    }
  });

  // Bind a tooltip without content initially
  marker.bindTooltip("", {
    permanent: false,
    direction: "top",
    offset: [0, -10],
  });

  // Update tooltip content on mouseover
  marker.on("mouseover", () => {
    const elapsedTime = timeElapsed(data.timestamp);
    marker.getTooltip().setContent(`Last seen: ${elapsedTime}`);
    marker.openTooltip();
  });

  // Optionally, close the tooltip on mouseout
  marker.on("mouseout", () => {
    marker.closeTooltip();
  });

  // Add a pulsing circle at the danger location
  const dangerCircle = L.circle([data.lat, data.lng], {
    color: "red",
    fillColor: "#f03",
    fillOpacity: 0.5,
    radius: 70,
  }).addTo(dangerLayer);

  // Flash the circle by changing its opacity
  let opacity = 0.5;
  const flashInterval = setInterval(() => {
    opacity = opacity === 0.5 ? 0 : 0.5;
    dangerCircle.setStyle({ fillOpacity: opacity });
  }, 500);

  setTimeout(() => {
    clearInterval(flashInterval);
    dangerLayer.removeLayer(dangerCircle);
  }, 20000);
}

// Handle receiving existing danger markers
socket.on("existingDangerMarkers", (markers) => {
  markers.forEach((data) => {
    addDangerMarker(data);
  });
});

// Handle receiving a danger alert
socket.on("dangerAlert", (data) => {
  // Play the alert sound
  const alertSound = document.getElementById("alert-sound");
  if (alertSound) {
    alertSound.play();
  }

  // Display the alert message in the alert panel
  const alertPanel = document.getElementById("alert-panel");
  const alertMessage = document.createElement("div");
  alertMessage.className = "alert-message";
  alertMessage.setAttribute("title", timeElapsed(data.timestamp)); // Add this line
  alertMessage.innerHTML = `
    <div class="alert-container">
        ${data.message} at (${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}) 
        <span class="time-elapsed">Just now</span>
    </div>
    <button class="close-alert">Dismiss</button>
  `;
  alertPanel.appendChild(alertMessage);

  // Add event listener to the dismiss button
  alertMessage.querySelector(".close-alert").addEventListener("click", () => {
    alertPanel.removeChild(alertMessage);
  });

  // Optionally, remove the alert message after 20 seconds if not dismissed
  setTimeout(() => {
    if (alertPanel.contains(alertMessage)) {
      alertPanel.removeChild(alertMessage);
    }
  }, 20000);

  // Add danger icon marker at the danger location
  addDangerMarker(data);
});

// Handle removing danger markers
socket.on("removeDangerMarker", (data) => {
  // Remove the danger marker from the map
  if (dangerMarkers[data.id]) {
    dangerLayer.removeLayer(dangerMarkers[data.id]);
    delete dangerMarkers[data.id];
  }
});

// --------------------
// Alert Button Functionality
// --------------------

// Add event listener to the alert button
let canSendAlert = true;

document.getElementById("alert-btn").addEventListener("click", async () => {
  if (!canSendAlert) {
    await customAlert("Please wait before sending another alert.");
    return;
  }

  if (currentPosition) {
    const { latitude, longitude } = currentPosition.coords;
    const dangerMessage = "Danger reported by " + userName;
    socket.emit("dangerAlert", {
      message: dangerMessage,
      lat: latitude,
      lng: longitude,
      senderId: socket.id,
      timestamp: Date.now(),
    });
  } else {
    await customAlert("Unable to determine your location.");
    return;
  }

  canSendAlert = false;
  setTimeout(() => {
    canSendAlert = true;
  }, 20000);
});

// --------------------
// Chat Functionality
// --------------------

// References to chat elements
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Send a chat message
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (message !== "") {
    socket.emit("chatMessage", { name: userName, message: message });
    chatInput.value = "";
    chatInput.focus();
  }
});

// Receive chat messages
socket.on("chatMessage", (data) => {
  appendChatMessage(data);
});

// Receive existing chat messages
socket.on("existingChatMessages", (messages) => {
  messages.forEach((data) => {
    appendChatMessage(data);
  });
});

// Function to append a chat message to the chat panel
function appendChatMessage(data) {
  const { name, message } = data;
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.innerHTML = `<strong>${name}:</strong> ${message}`;
  chatMessages.appendChild(messageElement);
  // Scroll to the bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --------------------
// Custom Modal Functions
// --------------------

// Custom Confirm Modal
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-confirm-modal");
    const confirmMessage = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    confirmMessage.textContent = message;

    modal.style.display = "block";
    btnYes.focus(); // Set initial focus

    // Handler for Yes button
    const onYes = () => {
      cleanup();
      resolve(true);
    };

    // Handler for No button
    const onNo = () => {
      cleanup();
      resolve(false);
    };

    // Cleanup function to remove event listeners and hide modal
    const cleanup = () => {
      btnYes.removeEventListener("click", onYes);
      btnNo.removeEventListener("click", onNo);
      modal.style.display = "none";
    };

    btnYes.addEventListener("click", onYes);
    btnNo.addEventListener("click", onNo);
  });
}

// Custom Prompt Modal
function customPrompt(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("custom-prompt-modal");
    const promptMessage = document.getElementById("prompt-message");
    const promptInput = document.getElementById("prompt-input");
    const btnSubmit = document.getElementById("prompt-submit");
    const btnCancel = document.getElementById("prompt-cancel");

    promptMessage.textContent = message;
    promptInput.value = ""; // Clear any existing input

    modal.style.display = "block";
    promptInput.focus(); // Set initial focus

    // Handler for Submit button
    const onSubmit = () => {
      const value = promptInput.value.trim();
      cleanup();
      resolve(value);
    };

    // Handler for Cancel button
    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    // Cleanup function to remove event listeners and hide modal
    const cleanup = () => {
      btnSubmit.removeEventListener("click", onSubmit);
      btnCancel.removeEventListener("click", onCancel);
      modal.style.display = "none";
    };

    btnSubmit.addEventListener("click", onSubmit);
    btnCancel.addEventListener("click", onCancel);

    // Allow pressing Enter to submit
    promptInput.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        onSubmit();
      }
    });
  });
}

// Custom Alert Modal
function customAlert(message) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.classList.add("modal");
    modal.innerHTML = `
        <div class="modal-content">
          <p>${message}</p>
          <div class="modal-buttons">
            <button id="alert-ok" class="modal-button">OK</button>
          </div>
        </div>
      `;
    document.body.appendChild(modal);
    const btnOk = modal.querySelector("#alert-ok");

    modal.style.display = "block";
    btnOk.focus();

    const onOk = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      btnOk.removeEventListener("click", onOk);
      document.body.removeChild(modal);
    };

    btnOk.addEventListener("click", onOk);
  });
}

// --------------------
// Notification Functionality
// --------------------

// Function to show custom notifications
function showCustomNotification(message) {
  const alertPanel = document.getElementById("alert-panel");
  const notification = document.createElement("div");
  notification.className = "alert-message-neutral";
  notification.setAttribute("title", timeElapsed(Date.now())); // Current time as elapsed time
  notification.innerHTML = `
    <div class="alert-container">
      ${message}
    </div>
    <button class="close-alert">Dismiss</button>
    `;
  alertPanel.appendChild(notification);

  // Add event listener to the dismiss button
  notification.querySelector(".close-alert").addEventListener("click", () => {
    alertPanel.removeChild(notification);
  });

  // Optionally, remove the notification after 5 seconds if not dismissed
  setTimeout(() => {
    if (alertPanel.contains(notification)) {
      alertPanel.removeChild(notification);
    }
  }, 3000);
}

// --------------------
// Periodic Updates (Optional)
// --------------------

// Function to periodically update all "Last Seen" tooltips
function updateAllLastSeenTooltips() {
  // Update ghost markers
  Object.values(ghostMarkers).forEach((marker) => {
    const data = marker.options.data;
    if (data && data.timestamp) {
      const elapsedTime = timeElapsed(data.timestamp);
      marker.getTooltip().setContent(`Last seen: ${elapsedTime}`);
    }
  });

  // Update danger markers
  Object.values(dangerMarkers).forEach((marker) => {
    const data = marker.options.data;
    if (data && data.timestamp) {
      const elapsedTime = timeElapsed(data.timestamp);
      marker.getTooltip().setContent(`Last seen: ${elapsedTime}`);
    }
  });

  // Update user journeys tooltips if any
  // (Optional: Implement if you have tooltips for journeys)
}

// Set an interval to update tooltips every minute
setInterval(updateAllLastSeenTooltips, 60000); // 60000 ms = 1 minute

// --------------------
// Accessibility and Cleanup
// --------------------

// Close modals when clicking outside of them
window.onclick = function (event) {
  const confirmModal = document.getElementById("custom-confirm-modal");
  const promptModal = document.getElementById("custom-prompt-modal");

  if (event.target === confirmModal) {
    confirmModal.style.display = "none";
  }

  if (event.target === promptModal) {
    promptModal.style.display = "none";
  }
};

// --------------------
// User Journey Management
// --------------------

// Function to generate a random color for user journeys
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Function to initialize existing user journeys
function initializeUserJourneys(usersData) {
  Object.values(usersData).forEach((data) => {
    if (!userJourneys[data.id]) {
      userJourneys[data.id] = {
        polyline: L.polyline([], { color: getRandomColor() }).addTo(journeysLayer),
        path: [],
      };
    }
    const newLatLng = [data.lat, data.lng];
    userJourneys[data.id].path.push(newLatLng);
    userJourneys[data.id].polyline.setLatLngs(userJourneys[data.id].path);
  });
}

// Modify existingUsers handler to initialize journeys
socket.on("existingUsers", (usersData) => {
  // Clear existing user markers and journeys
  usersLayer.clearLayers();
  journeysLayer.clearLayers();
  Object.keys(userMarkers).forEach((id) => {
    delete userMarkers[id];
  });
  Object.keys(userJourneys).forEach((id) => {
    delete userJourneys[id];
  });

  // Add user markers and initialize their journeys
  Object.values(usersData).forEach((data) => {
    addOrUpdateUserMarker(data);
  });
});

// Handle receiving location updates to update journeys
socket.on("updateLocation", (data) => {
  addOrUpdateUserMarker(data);
});

// Function to handle user disconnection and remove their journey
socket.on("userDisconnected", (id) => {
  if (userMarkers[id]) {
    usersLayer.removeLayer(userMarkers[id]);
    delete userMarkers[id];
  }
  if (userJourneys[id]) {
    journeysLayer.removeLayer(userJourneys[id].polyline);
    delete userJourneys[id];
  }
});
