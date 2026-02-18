const socket = io("/location");
const username = prompt("Enter your name to join location sharing:") || "Anonymous";

const map = L.map("map");
let userMarker;
let firstUpdate = true;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const markers = {};

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      socket.emit("send-location", { latitude, longitude, name: username });

      if (!userMarker) {
        userMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindPopup(`<b>📍 You are here (${username})</b>`)
          .openPopup();
      } else {
        userMarker.setLatLng([latitude, longitude]);
      }

      if (firstUpdate) {
        map.setView([latitude, longitude], 16);
        firstUpdate = false;
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      alert("Please allow GPS permission.");
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
  );
} else {
  alert("Geolocation not supported.");
}

socket.on("receive-location", (data) => {
  const { id, latitude, longitude, name } = data;
  if (socket.id === id) return;

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
  } else {
    markers[id] = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(`👤 ${name || "User"}`)
      .openPopup();
  }
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});
