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
            var loc = data[addr];
            var marker = L.marker([loc[0], loc[1]]).addTo(map);
            marker.bindPopup(addr);
            markers[addr] = marker;
        }
    });
});
