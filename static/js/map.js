// ============================================================================
// GLOBAL STATE
// ============================================================================

let map;
let marker;
let tileLayer;
let restrictedBounds;

// ============================================================================
// DOM CACHE
// ============================================================================

const DOM = {
    map: () => document.getElementById('map'),
    searchInput: () => document.getElementById('searchInput'),
    sensorSlider: () => document.getElementById('sensorSlider'),
    sensorCount: () => document.getElementById('sensorCount'),
    overlayTitle: () => document.querySelector('.map-overlay h4')
};

// ============================================================================
// BOUNDS
// ============================================================================

function initBounds() {
    const sw = L.latLng(13.070, 80.235);
    const ne = L.latLng(13.095, 80.265);
    restrictedBounds = L.latLngBounds(sw, ne);
}

// ============================================================================
// MAP
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
    initMarker();

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
        .bindTooltip(
            'AQI Monitoring Zone: Kilpauk & Egmore',
            { direction: 'center' }
        );
}

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

function initControls() {
    L.control.zoom({ position: 'topright' }).addTo(map);
}

function initMarker() {
    // marker = L.marker([13.082, 80.250]).addTo(map);
}

// ============================================================================
// THEME
// ============================================================================

function initMapThemeSync(tileLayer) {
    window.addEventListener('themeChanged', (e) => {
        tileLayer.setUrl(
            e.detail.theme === 'light'
                ? tileLayer._light
                : tileLayer._dark
        );
    });
}

// ============================================================================
// SEARCH
// ============================================================================
function initSearch() {
    const input = DOM.searchInput();
    if (!input) return;

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.length > 2) {
            searchLocation(input.value);
        }
    });
}

async function searchLocation(query) {
    const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json&q=${encodeURIComponent(query + ', Kilpauk, Chennai')}` +
        `&bounded=1&viewbox=80.225,13.105,80.270,13.065`;

    try {
        DOM.map().style.opacity = '0.7';

        const res = await fetch(url);
        const data = await res.json();
        if (!data.length) return alert('Location not found.');

        const lat = +data[0].lat;
        const lon = +data[0].lon;

        if (!restrictedBounds.contains([lat, lon])) {
            return alert('Outside permitted area.');
        }

        map.flyTo([lat, lon], 15);
        marker.setLatLng([lat, lon]);

        const title = DOM.overlayTitle();
        if (title) title.textContent = `STREET VIEW: ${query.toUpperCase()}`;

    } catch (err) {
        console.error(err);
    } finally {
        DOM.map().style.opacity = '1';
    }
}


function initSensorWidget() {

    const btnMinus = document.getElementById('sensorMinus');
    const btnPlus = document.getElementById('sensorPlus');
    const countEl = document.getElementById('sensorCount');

    if (!btnMinus || !btnPlus || !countEl || !map) return;

    const MIN = 1;
    const MAX = 10;

    // Sensor dictionary (index-based keys)
    const sensors = {
        1: { id: 'KP-002', name: 'Ormes Road', lat: 13.0818, lng: 80.2460 },
        2: { id: 'KP-003', name: 'Flowers Road', lat: 13.0782, lng: 80.2468 },
        3: { id: 'KP-005', name: 'Halls Road', lat: 13.0746, lng: 80.2513 },
        4: { id: 'EG-001', name: 'Casa Major Road', lat: 13.0718, lng: 80.2548 },
        5: { id: 'KP-004', name: 'Pantheon Road', lat: 13.0728, lng: 80.2574 },
        6: { id: 'EG-004', name: 'Ethiraj Salai', lat: 13.0731, lng: 80.2622 },
        7: { id: 'EG-005', name: 'College Road (Egmore)', lat: 13.0766, lng: 80.2625 },
        8: { id: 'KP-001', name: 'Kilpauk Garden Road', lat: 13.0845, lng: 80.2390 },
        9: { id: 'EG-002', name: 'Kellys Road', lat: 13.0882, lng: 80.2470 },
        10: { id: 'EG-003', name: 'Commander-in-Chief Road', lat: 13.0910, lng: 80.2498 }
    };


    let count = MIN;
    countEl.textContent = count;
    const markerStack = {};
    const markerGroup = L.layerGroup().addTo(map);
    pushMarker(count);
    btnPlus.addEventListener('click', () => {
        if (count >= MAX) return;
        count++;
        countEl.textContent = count;
        pushMarker(count);
    });
    btnMinus.addEventListener('click', () => {
        if (count <= MIN) return;
        popMarker(count);
        count--;
        countEl.textContent = count;
    });

    /* =========================
       STACK OPERATIONS
    ========================== */

    function pushMarker(index) {
        // while this function is called, i need to increase the sensor count in the simulation script as well...
        if (markerStack[index]) return;

        const sensor = sensors[index];
        if (!sensor) return;

        const marker = L.marker([sensor.lat, sensor.lng])
            .bindPopup(`<b>${sensor.id}</b><br>${sensor.name}`);

        marker.addTo(markerGroup).openPopup();
        markerStack[index] = marker;

        console.log('PUSH →', sensor.id);
    }

    function popMarker(index) {
        const marker = markerStack[index];
        if (!marker) return;

        markerGroup.removeLayer(marker);
        delete markerStack[index];

        console.log('POP ← sensor', index);
    }
}

/* =========================
   TRAFFIC INTENSITY WIDGET
========================== */
function initTrafficWidget() { }



function initPeakHourWidget() { }

// ============================================================================
// INITIALIZATION (ALWAYS LAST)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.group('🚀 Dashboard Init');

    initBounds();
    initMap();
    initMapThemeSync();
    initSearch();
    initSensorWidget();
    initTrafficWidget();
    initPeakHourWidget();

    console.groupEnd();
});
