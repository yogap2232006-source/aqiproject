// ============================================================================
// AQI WIDGET - INTEGRATED WITH TERMINAL SIDEBAR
// Place this in: static/js/aqi_widget_terminal.js
// ============================================================================

class TerminalAQIWidget {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.markers = [];
        this.trafficIntensity = 30;
        this.timeOfDay = 'peak';
        this.updateInterval = null;
        
        // STATIC SENSOR POSITIONS
        this.allSensors = {
            [
                { id: 'KP-001', name: 'Kilpauk Main Road', lat: 13.0827, lng: 80.2385 },
                { id: 'KP-002', name: 'Kilpauk Garden', lat: 13.0850, lng: 80.2400 },
                { id: 'KP-003', name: 'Poonamallee High Rd', lat: 13.0800, lng: 80.2350 },
                { id: 'KP-004', name: 'Kodambakkam Bridge', lat: 13.0780, lng: 80.2370 },
                { id: 'KP-005', name: 'Kilpauk Medical College', lat: 13.0870, lng: 80.2420 },
                { id: 'PW-001', name: 'Purasawalkam Station', lat: 13.0668, lng: 80.2550 },
                { id: 'PW-002', name: 'Kaladipet', lat: 13.0700, lng: 80.2580 },
                { id: 'PW-003', name: 'Otteri Nullah', lat: 13.0640, lng: 80.2520 },
                { id: 'PW-004', name: 'Periyar EVR Road', lat: 13.0620, lng: 80.2570 },
                { id: 'PW-005', name: 'Chintadripet Bridge', lat: 13.0680, lng: 80.2600 },
            ]
        };
        
        this.visibleCount = {
            kilpauk: 5,
            purusaiwakkam: 5
        };
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initTerminalControls();
        this.renderVisibleSensors();
        this.logToTerminal('AQI Widget initialized', 'SYSTEM');
        this.logToTerminal(`Monitoring ${this.visibleCount.kilpauk + this.visibleCount.purusaiwakkam} sensors`, 'INFO');
        this.startAutoUpdate();
    }
    
    initMap() {
        this.map = L.map(this.mapElementId, {
            zoomControl: false
        }).setView([13.0745, 80.2470], 13);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 19
        }).addTo(this.map);
        
        this.drawAreaBoundaries();
        this.addCustomZoomControls();
    }
    
    drawAreaBoundaries() {
        // Kilpauk
        const kilpaukBounds = [
            [13.0900, 80.2320], [13.0900, 80.2450],
            [13.0754, 80.2450], [13.0754, 80.2320]
        ];
        
        L.polygon(kilpaukBounds, {
            color: '#5D866C',
            weight: 2,
            fillColor: '#5D866C',
            fillOpacity: 0.1,
            dashArray: '5, 10'
        }).addTo(this.map);
        
        L.marker([13.0827, 80.2385], {
            icon: L.divIcon({
                className: 'area-label',
                html: '<div class="area-label-text">KILPAUK</div>',
                iconSize: [80, 20]
            })
        }).addTo(this.map);
        
        // Purusaiwakkam
        const purusaiwakkamBounds = [
            [13.0741, 80.2485], [13.0741, 80.2615],
            [13.0595, 80.2615], [13.0595, 80.2485]
        ];
        
        L.polygon(purusaiwakkamBounds, {
            color: '#5D866C',
            weight: 2,
            fillColor: '#5D866C',
            fillOpacity: 0.1,
            dashArray: '5, 10'
        }).addTo(this.map);
        
        L.marker([13.0668, 80.2550], {
            icon: L.divIcon({
                className: 'area-label',
                html: '<div class="area-label-text">PURUSAIWAKKAM</div>',
                iconSize: [120, 20]
            })
        }).addTo(this.map);
    }
    
    addCustomZoomControls() {
        const zoomInBtn = document.querySelector('.map-controls .map-btn:first-child');
        const zoomOutBtn = document.querySelector('.map-controls .map-btn:last-child');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.map.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.map.zoomOut());
    }
    
    // ========================================
    // TERMINAL INTEGRATION
    // ========================================
    
    initTerminalControls() {
        // Replace terminal content with AQI controls
        const terminalBody = document.getElementById('terminalContent');
        
        const controlHTML = `
            <div class="aqi-terminal-controls">
                <!-- Sensor Controls -->
                <div class="terminal-control-group">
                    <div class="terminal-control-label">
                        <span>Kilpauk Sensors</span>
                        <span class="terminal-value" id="kilpaukCountValue">5/10</span>
                    </div>
                    <input type="range" id="kilpaukCount" min="0" max="10" value="5" class="terminal-slider">
                </div>
                
                <div class="terminal-control-group">
                    <div class="terminal-control-label">
                        <span>Purusaiwakkam Sensors</span>
                        <span class="terminal-value" id="purusaiwakkamCountValue">5/10</span>
                    </div>
                    <input type="range" id="purusaiwakkamCount" min="0" max="10" value="5" class="terminal-slider">
                </div>
                
                <!-- Traffic Control -->
                <div class="terminal-control-group">
                    <div class="terminal-control-label">
                        <span>🚗 Traffic Intensity</span>
                        <span class="terminal-value" id="trafficValue">30%</span>
                    </div>
                    <input type="range" id="trafficIntensity" min="0" max="100" value="30" class="terminal-slider">
                </div>
                
                <!-- Time Buttons -->
                <div class="terminal-control-group">
                    <div class="terminal-control-label">
                        <span>⏰ Time of Day</span>
                    </div>
                    <div class="terminal-time-buttons">
                        <button class="terminal-time-btn" data-time="day">☀️ Day</button>
                        <button class="terminal-time-btn active" data-time="peak">🚦 Peak</button>
                        <button class="terminal-time-btn" data-time="night">🌙 Night</button>
                    </div>
                </div>
                
                <!-- Summary Cards -->
                <div class="terminal-summary">
                    <div class="terminal-summary-card">
                        <div class="summary-area">KILPAUK</div>
                        <div class="summary-aqi" id="kilpaukAQI">--</div>
                        <div class="summary-status" id="kilpaukStatus">Loading...</div>
                    </div>
                    <div class="terminal-summary-card">
                        <div class="summary-area">PURUSAIWAKKAM</div>
                        <div class="summary-aqi" id="purusaiwakkamAQI">--</div>
                        <div class="summary-status" id="purusaiwakkamStatus">Loading...</div>
                    </div>
                </div>
                
                <!-- Log Area -->
                <div class="terminal-log" id="terminalLog">
                    <div class="terminal-line">
                        <span class="terminal-prompt">[SYSTEM]</span>
                        <span class="terminal-text">AQI Widget Ready</span>
                    </div>
                </div>
            </div>
        `;
        
        terminalBody.innerHTML = controlHTML;
        this.attachTerminalListeners();
    }
    
    attachTerminalListeners() {
        // Kilpauk slider
        const kilpaukSlider = document.getElementById('kilpaukCount');
        kilpaukSlider?.addEventListener('input', (e) => {
            this.visibleCount.kilpauk = parseInt(e.target.value);
            document.getElementById('kilpaukCountValue').textContent = 
                `${this.visibleCount.kilpauk}/10`;
            this.renderVisibleSensors();
            this.logToTerminal(`Kilpauk sensors: ${this.visibleCount.kilpauk}`, 'INFO');
        });
        
        // Purusaiwakkam slider
        const purusaiwakkamSlider = document.getElementById('purusaiwakkamCount');
        purusaiwakkamSlider?.addEventListener('input', (e) => {
            this.visibleCount.purusaiwakkam = parseInt(e.target.value);
            document.getElementById('purusaiwakkamCountValue').textContent = 
                `${this.visibleCount.purusaiwakkam}/10`;
            this.renderVisibleSensors();
            this.logToTerminal(`Purusaiwakkam sensors: ${this.visibleCount.purusaiwakkam}`, 'INFO');
        });
        
        // Traffic slider
        const trafficSlider = document.getElementById('trafficIntensity');
        trafficSlider?.addEventListener('input', (e) => {
            this.trafficIntensity = parseInt(e.target.value);
            document.getElementById('trafficValue').textContent = this.trafficIntensity + '%';
            this.renderVisibleSensors();
            this.logToTerminal(`Traffic intensity: ${this.trafficIntensity}%`, 'DATA');
        });
        
        // Time buttons
        document.querySelectorAll('.terminal-time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.terminal-time-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.timeOfDay = btn.dataset.time;
                this.renderVisibleSensors();
                this.logToTerminal(`Time set to: ${this.timeOfDay}`, 'SUCCESS');
            });
        });
        
        // Use existing terminal buttons
        document.getElementById('startSimBtn')?.addEventListener('click', () => {
            this.startAutoUpdate();
            this.logToTerminal('Auto-update started', 'SUCCESS');
        });
        
        document.getElementById('stopSimBtn')?.addEventListener('click', () => {
            this.stopAutoUpdate();
            this.logToTerminal('Auto-update stopped', 'WARN');
        });
        
        document.getElementById('resetSimBtn')?.addEventListener('click', () => {
            this.reset();
        });
    }
    
    logToTerminal(message, level = 'INFO') {
        const terminalLog = document.getElementById('terminalLog');
        if (!terminalLog) return;
        
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `
            <span class="terminal-prompt">[${level}]</span>
            <span class="terminal-text">${message}</span>
        `;
        
        terminalLog.appendChild(line);
        
        // Keep only last 10 logs
        while (terminalLog.children.length > 10) {
            terminalLog.removeChild(terminalLog.firstChild);
        }
        
        // Auto-scroll to bottom
        terminalLog.scrollTop = terminalLog.scrollHeight;
    }
    
    // ========================================
    // SENSOR RENDERING (same as before)
    // ========================================
    
    renderVisibleSensors() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        
        for (let i = 0; i < this.visibleCount.kilpauk; i++) {
            const sensor = this.allSensors.kilpauk[i];
            const data = this.generateSensorData(sensor, 'kilpauk');
            const marker = this.createMarker(data);
            this.markers.push(marker);
        }
        
        for (let i = 0; i < this.visibleCount.purusaiwakkam; i++) {
            const sensor = this.allSensors.purusaiwakkam[i];
            const data = this.generateSensorData(sensor, 'purusaiwakkam');
            const marker = this.createMarker(data);
            this.markers.push(marker);
        }
        
        this.updateSummary();
    }
    
    generateSensorData(sensor, area) {
        let basePM25 = Math.random() * 20 + 15;
        let baseNO2 = Math.random() * 20 + 10;
        let baseCO = Math.random() * 0.9 + 0.3;
        
        const timeMultipliers = { 'day': 1.0, 'peak': 1.8, 'night': 0.6 };
        const timeMult = timeMultipliers[this.timeOfDay];
        
        const isAffected = Math.random() < 0.3;
        const trafficMult = isAffected ? (1.0 + this.trafficIntensity / 100) : 1.0;
        
        const pm25 = basePM25 * timeMult * trafficMult;
        const no2 = baseNO2 * timeMult * trafficMult * 1.2;
        const co = baseCO * timeMult * trafficMult;
        
        const { aqi, category, color } = this.calculateAQI(pm25);
        
        return {
            id: sensor.id,
            name: sensor.name,
            lat: sensor.lat,
            lng: sensor.lng,
            area: area,
            pm25: Math.round(pm25 * 10) / 10,
            no2: Math.round(no2 * 10) / 10,
            co: Math.round(co * 100) / 100,
            aqi: aqi,
            category: category,
            color: color,
            trafficAffected: isAffected
        };
    }
    
    calculateAQI(pm25) {
        if (pm25 <= 12.0) {
            return { aqi: Math.round((50 / 12.0) * pm25), category: "Good", color: "#5D866C" };
        } else if (pm25 <= 35.4) {
            return { aqi: Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (pm25 - 12.1)), category: "Moderate", color: "#D4A574" };
        } else if (pm25 <= 55.4) {
            return { aqi: Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (pm25 - 35.5)), category: "Unhealthy", color: "#E67E22" };
        } else if (pm25 <= 150.4) {
            return { aqi: Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (pm25 - 55.5)), category: "Very Unhealthy", color: "#B85C5C" };
        } else {
            return { aqi: Math.min(500, Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (pm25 - 150.5))), category: "Hazardous", color: "#9B59B6" };
        }
    }
    
    createMarker(data) {
        const icon = L.divIcon({
            className: 'sensor-marker',
            html: `
                <div class="marker-inner ${data.trafficAffected ? 'traffic-affected' : ''}" 
                     style="background-color: ${data.color};">
                    <i class="fa-solid fa-tower-cell"></i>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        
        const popupContent = `
            <div class="sensor-popup">
                <div class="popup-header">
                    <strong>${data.id}</strong>
                    ${data.trafficAffected ? '<span class="traffic-badge">🚗 Traffic</span>' : ''}
                </div>
                <div class="popup-subheader">${data.name}</div>
                <div class="popup-body">
                    <div class="pollutant-row">
                        <span class="pollutant-label">PM2.5</span>
                        <span class="pollutant-val">${data.pm25} µg/m³</span>
                    </div>
                    <div class="pollutant-row">
                        <span class="pollutant-label">NO₂</span>
                        <span class="pollutant-val">${data.no2} ppb</span>
                    </div>
                    <div class="pollutant-row">
                        <span class="pollutant-label">CO</span>
                        <span class="pollutant-val">${data.co} ppm</span>
                    </div>
                    <div class="aqi-row">
                        <span class="aqi-label">AQI</span>
                        <span class="aqi-val" style="color: ${data.color}">${data.aqi}</span>
                    </div>
                    <div class="category-row">
                        <span class="category-badge" style="background: ${data.color}">${data.category}</span>
                    </div>
                </div>
            </div>
        `;
        
        return L.marker([data.lat, data.lng], { icon })
            .bindPopup(popupContent)
            .addTo(this.map);
    }
    
    updateSummary() {
        const kilpaukData = [];
        const purusaiwakkamData = [];
        
        for (let i = 0; i < this.visibleCount.kilpauk; i++) {
            kilpaukData.push(this.generateSensorData(this.allSensors.kilpauk[i], 'kilpauk'));
        }
        
        for (let i = 0; i < this.visibleCount.purusaiwakkam; i++) {
            purusaiwakkamData.push(this.generateSensorData(this.allSensors.purusaiwakkam[i], 'purusaiwakkam'));
        }
        
        if (kilpaukData.length > 0) {
            const avgAQI = Math.round(kilpaukData.reduce((sum, s) => sum + s.aqi, 0) / kilpaukData.length);
            const { category, color } = this.calculateAQI(avgAQI / 2);
            
            const aqiEl = document.getElementById('kilpaukAQI');
            const statusEl = document.getElementById('kilpaukStatus');
            if (aqiEl) {
                aqiEl.textContent = avgAQI;
                aqiEl.style.color = color;
            }
            if (statusEl) {
                statusEl.textContent = category;
                statusEl.style.color = color;
            }
        }
        
        if (purusaiwakkamData.length > 0) {
            const avgAQI = Math.round(purusaiwakkamData.reduce((sum, s) => sum + s.aqi, 0) / purusaiwakkamData.length);
            const { category, color } = this.calculateAQI(avgAQI / 2);
            
            const aqiEl = document.getElementById('purusaiwakkamAQI');
            const statusEl = document.getElementById('purusaiwakkamStatus');
            if (aqiEl) {
                aqiEl.textContent = avgAQI;
                aqiEl.style.color = color;
            }
            if (statusEl) {
                statusEl.textContent = category;
                statusEl.style.color = color;
            }
        }
    }
    
    startAutoUpdate() {
        if (this.updateInterval) return;
        this.updateInterval = setInterval(() => {
            this.renderVisibleSensors();
            this.logToTerminal('Sensor data updated', 'DATA');
        }, 3000);
    }
    
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    reset() {
        this.visibleCount.kilpauk = 5;
        this.visibleCount.purusaiwakkam = 5;
        this.trafficIntensity = 30;
        this.timeOfDay = 'peak';
        
        document.getElementById('kilpaukCount').value = 5;
        document.getElementById('purusaiwakkamCount').value = 5;
        document.getElementById('trafficIntensity').value = 30;
        document.getElementById('kilpaukCountValue').textContent = '5/10';
        document.getElementById('purusaiwakkamCountValue').textContent = '5/10';
        document.getElementById('trafficValue').textContent = '30%';
        
        document.querySelectorAll('.terminal-time-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.time === 'peak');
        });
        
        this.renderVisibleSensors();
        this.logToTerminal('Widget reset to defaults', 'SYSTEM');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const widget = new TerminalAQIWidget('map');
    window.aqiWidget = widget;
    
    // Open terminal sidebar automatically
    const sidebar = document.getElementById('terminalSidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
    }
    
    // Close button
    document.getElementById('closeSidebar')?.addEventListener('click', () => {
        sidebar?.classList.add('hidden');
    });
    
    // Widget toggle button
    document.getElementById('widgetToggle')?.addEventListener('click', () => {
        sidebar?.classList.toggle('hidden');
    });
});