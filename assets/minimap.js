// バンドページの小さな地図
(function () {
  var el = document.getElementById('minimap');
  if (!el || !window.L) return;
  var pts = JSON.parse(el.dataset.points || '[]');
  if (!pts.length) return;
  var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO', maxZoom: 18,
  }).addTo(map);
  var icon = L.divIcon({ className: '', html: '<div class="band-marker"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
  var latlngs = pts.map(function (p) {
    L.marker([p[0], p[1]], { icon: icon }).addTo(map).bindTooltip(p[2]);
    return [p[0], p[1]];
  });
  if (latlngs.length === 1) map.setView(latlngs[0], 5);
  else map.fitBounds(latlngs, { padding: [40, 40] });
})();
