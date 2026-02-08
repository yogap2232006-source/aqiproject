// ============================================================================
// GLOBAL STATE
// ============================================================================

let map;
let tileLayer;
let restrictedBounds;
window.markerStack = {};
let markerGroup;

// ============================================================================
// SENSOR DATA (SOURCE OF TRUTH)
// ============================================================================

window.sensors = {
    1: { id: 'KP-002', name: 'Ormes Road', lat: 13.0818, lng: 80.2460 },
    2: { id: 'KP-003', name: 'Flowers Road', lat: 13.0782, lng: 80.2468 },
    3: { id: 'KP-005', name: 'Halls Road', lat: 13.0746, lng: 80.2513 },
    4: { id: 'EG-001', name: 'Casa Major Road', lat: 13.0718, lng: 80.2548 },
    5: { id: 'KP-004', name: 'Pantheon Road', lat: 13.0728, lng: 80.2574 },
    6: { id: 'EG-004', name: 'Ethiraj Salai', lat: 13.0731, lng: 80.2622 },
    7: { id: 'EG-005', name: 'College Road', lat: 13.0766, lng: 80.2625 },
    8: { id: 'KP-001', name: 'Kilpauk Garden Road', lat: 13.0845, lng: 80.2390 },
    9: { id: 'EG-002', name: 'Kellys Road', lat: 13.0882, lng: 80.2470 },
    10: { id: 'EG-003', name: 'Commander-in-Chief Road', lat: 13.0910, lng: 80.2498 }
};

// ============================================================================
// MAP BOUNDS
// ============================================================================

function initBounds() {
    const sw = L.latLng(13.070, 80.235);
    const ne = L.latLng(13.095, 80.265);
    restrictedBounds = L.latLngBounds(sw, ne);
}

// ============================================================================
// MAP INIT
// ============================================================================

function initMap() {
    map = L.map('map', {
        zoomControl: false,
        maxBounds: restrictedBounds,
        maxBoundsViscosity: 1,
        minZoom: 14,
        maxZoom: 18
    }).setView([13.082, 80.250], 14);

    map.fitBounds(restrictedBounds);

    drawBoundary();
    loadTiles();
    initControls();
    initMapThemeSync();

    setTimeout(() => map.invalidateSize(), 200);
}

function drawBoundary() {
    L.rectangle(restrictedBounds, {
        color: '#333',
        weight: 2,
        fillOpacity: 0,
        dashArray: '6,4'
    })
        .addTo(map)
        .bindTooltip('AQI Monitoring Zone: Kilpauk & Egmore', {
            direction: 'center'
        });
}

// ============================================================================
// TILE LAYERS + THEME SYNC
// ============================================================================

function loadTiles() {
    const dark =
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const light =
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const isLight =
        document.documentElement.classList.contains('light-mode') ||
        localStorage.getItem('theme') === 'light';

    tileLayer = L.tileLayer(isLight ? light : dark, {
        attribution: '&copy; OpenStreetMap & CARTO',
        subdomains: 'abcd'
    }).addTo(map);

    tileLayer._dark = dark;
    tileLayer._light = light;
}

function initMapThemeSync() {
    window.addEventListener('themeChanged', (e) => {
        if (!tileLayer) return;
        tileLayer.setUrl(
            e.detail.theme === 'light'
                ? tileLayer._light
                : tileLayer._dark
        );
    });
}

function initControls() {
    L.control.zoom({ position: 'topright' }).addTo(map);
}

// ============================================================================
// SENSOR MARKERS + COUNT
// ============================================================================

function updateAllSensorsCount(count) {
    const el = document.getElementById('allSensorsFilter');
    if (!el) return;

    const dot = el.querySelector('.dot');
    el.innerHTML = '';
    if (dot) el.appendChild(dot);

    el.insertAdjacentText('beforeend', ` ALL SENSORS (${count})`);
}

function getAQIColor(aqi) {
    if (aqi <= 50) return '#00E396';
    if (aqi <= 100) return '#FEB019';
    if (aqi <= 150) return '#f05233';
    return '#ce1c1c';
}

function pushMarker(index) {
    if (window.markerStack[index]) return;

    const sensor = window.sensors[index];
    if (!sensor) return;

    // Get AQI from sensorState if available, otherwise use default
    const sensorData = window.sensorState?.[sensor.id] || window.sensorState?.[sensor.name];
    const aqi = sensorData?.aqi ?? (25 + (index * 15));
    const color = getAQIColor(aqi);

    const marker = L.circleMarker(
        [sensor.lat, sensor.lng],
        {
            radius: 9,
            fillColor: color,
            fillOpacity: 0.9,
            color: '#111',
            weight: 1
        }
    ).bindPopup(`
        <b>${sensor.id}</b><br>
        ${sensor.name}<br>
        AQI: ${aqi}
    `);

    // ✅ ADD CLICK HANDLER TO MARKER
    marker.on('click', async function() {
        console.log('🗺️ Marker clicked:', sensor.id);
        
        // Call the selectSensor function from app.js
        if (typeof window.selectSensor === 'function') {
            await window.selectSensor(sensor.id, index);
        }
        
        // Highlight marker
        highlightMarker(index);
    });

    markerGroup.addLayer(marker);
    window.markerStack[index] = marker;
}

function highlightMarker(index) {
    // Remove highlight from all markers
    Object.keys(window.markerStack).forEach(idx => {
        const marker = window.markerStack[idx];
        if (marker) {
            marker.setStyle({
                weight: 1,
                radius: 9
            });
        }
    });
    
    // Highlight selected marker
    const selectedMarker = window.markerStack[index];
    if (selectedMarker) {
        selectedMarker.setStyle({
            weight: 3,
            radius: 12
        });
    }
}

window.addEventListener('sensorCountChanged', (e) => {
    syncMarkersToCount(e.detail);
});

// Listen for sensor data updates to refresh marker colors
window.addEventListener('sensorDataUpdated', () => {
    updateMarkerColors();
});

function syncMarkersToCount(newCount) {
    if (!markerGroup) {
        markerGroup = L.layerGroup().addTo(map);
    }

    const current = Object.keys(window.markerStack).length;

    // ADD markers
    if (newCount > current) {
        for (let i = current + 1; i <= newCount; i++) {
            pushMarker(i);
        }
    }

    // REMOVE markers
    if (newCount < current) {
        for (let i = current; i > newCount; i--) {
            const marker = window.markerStack[i];
            if (marker) {
                markerGroup.removeLayer(marker);
                delete window.markerStack[i];
            }
        }
    }

    updateAllSensorsCount(newCount);
}

function updateMarkerColors() {
    if (!window.markerStack || !window.sensors) return;

    Object.keys(window.markerStack).forEach(index => {
        const sensor = window.sensors[index];
        if (!sensor) return;

        const marker = window.markerStack[index];
        const sensorData = window.sensorState?.[sensor.id] || window.sensorState?.[sensor.name];
        const aqi = sensorData?.aqi ?? (25 + (parseInt(index) * 15));
        const color = getAQIColor(aqi);

        // Update marker color
        marker.setStyle({
            fillColor: color
        });

        // Update popup content
        marker.setPopupContent(`
            <b>${sensor.id}</b><br>
            ${sensor.name}<br>
            AQI: ${aqi}
        `);
    });
}

// ============================================================================
// EXPOSE selectSensor FOR EXTERNAL USE
// ============================================================================

// Make selectSensor available globally for marker clicks
window.selectSensor = async function(sensorId, sensorIndex) {
    console.log('📍 Map: Selecting sensor', sensorId);
    
    // Update selected sensor in app.js
    window.selectedSensorId = sensorId;
    
    // Highlight marker
    highlightMarker(sensorIndex);
    
    // Trigger sensor selection in app.js if the function exists
    if (window.updateSidebarForSensor) {
        await window.updateSidebarForSensor(sensorId);
    }
    
    if (window.updateAnalyticsForSensor) {
        await window.updateAnalyticsForSensor(sensorId);
    }
};

// ============================================================================
// INIT
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initBounds();
    initMap();

    // Initial sync from app.js count
    setTimeout(() => {
        syncMarkersToCount(window.activeSensorCount || 1);
    }, 100);
});