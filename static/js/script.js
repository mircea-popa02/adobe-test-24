document.addEventListener('DOMContentLoaded', function () {
    // Initialize the map
    var map = L.map('map').setView([45.9432, 24.9668], 7); // Centered on Romania

    // Offline tile layer
    var offlineLayer = L.tileLayer('/tiles/{z}/{x}/{y}.png', {
        maxZoom: 15,
        minZoom: 5,
        attribution: 'Map data © OpenStreetMap contributors'
    }).addTo(map);

    var markers = {};

    // Connect to Socket.IO
    var socket = io();

    socket.on('update_locations', function (data) {
        // Remove existing markers
        for (var key in markers) {
            map.removeLayer(markers[key]);
        }
        markers = {};
    
        // Add new markers
        for (var addr in data) {
            var clientData = data[addr];
            var loc = clientData.location;
            var name = clientData.name;
            if (loc[0] !== 0.0 && loc[1] !== 0.0) {
                var marker = L.marker([loc[0], loc[1]]).addTo(map);
                marker.bindPopup(name || addr);
                markers[addr] = marker;
            }
        }
    });
    
});
