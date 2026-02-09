// ============================================================================
// GLOBAL STATE & CONFIGURATION
// ============================================================================

let notifications = [];
let analyticsChart = null;
window.sensorState = {};
window.activeSensorCount = 1;
window.selectedSensorId = null;
window.selectedSensorData = null;

// Store the notification interval ID so we can stop it
let notificationMonitoringInterval = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<"'>]/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function getAQIColor(aqi) {
    if (aqi <= 50) return '#00E396';
    if (aqi <= 100) return '#FEB019';
    if (aqi <= 150) return '#f05233';
    return '#ce1c1c';
}

function getAQICategory(aqi) {
    if (aqi <= 50) return { text: 'Good', class: 'success' };
    if (aqi <= 100) return { text: 'Moderate', class: 'warning' };
    if (aqi <= 150) return { text: 'Unhealthy', class: 'danger' };
    return { text: 'Hazardous', class: 'danger' };
}

function getHumidityColor(humidity) {
    // Low humidity (dry): Blue
    if (humidity <= 30) return '#1E3A8A';
    // Low-moderate humidity: Cyan
    if (humidity <= 50) return '#0891B2';
    // Moderate humidity: Green
    if (humidity <= 65) return '#00E396';
    // High humidity: Yellow/Orange
    if (humidity <= 80) return '#FEB019';
    // Very high humidity: Red (indicates potential issues)
    return '#f05233';
}

async function getCSRFToken() {
    const name = 'csrftoken';
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.startsWith(name + '=')) {
            return decodeURIComponent(c.substring(name.length + 1));
        }
    }
    return '';
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    e.currentTarget.classList.add('dragover');
}

function unhighlight(e) {
    e.currentTarget.classList.remove('dragover');
}

// ============================================================================
// SENSOR SELECTION & DATA LOADING
// ============================================================================

async function selectSensor(sensorId, sensorIndex) {
    window.selectedSensorId = sensorId;
    console.log('📍 Selected sensor:', sensorId);
    
    // Highlight selected card
    document.querySelectorAll('.sensor-card-wrapper').forEach(wrapper => {
        if (wrapper.dataset.sensorId === sensorId) {
            wrapper.classList.add('selected');
        } else {
            wrapper.classList.remove('selected');
        }
    });
    
    // Update street view immediately with current sensor state
    updateMapStreetView();
    
    // Load comprehensive sensor data
    await loadSensorData(sensorId);
    
    // Update all UI components
    updateAllWidgets();
    
    // Highlight the corresponding map marker
    if (typeof window.highlightMarker === 'function') {
        window.highlightMarker(sensorIndex);
    }
}

async function loadSensorData(sensorId) {
    try {
        const response = await fetch(`/api/sensors/${sensorId}/readings/?hours=24&limit=100`);
        const data = await response.json();
        
        if (data.readings && data.readings.length > 0) {
            window.selectedSensorData = {
                sensorId: sensorId,
                sensorName: data.sensor_name,
                readings: data.readings,
                stats: data.stats
            };
            
            console.log('✅ Loaded sensor data:', sensorId, window.selectedSensorData);
        } else {
            console.warn('No readings found for sensor:', sensorId);
            window.selectedSensorData = null;
        }
        
    } catch (error) {
        console.error('Error loading sensor data:', error);
        window.selectedSensorData = null;
    }
}

// Make selectSensor globally available
window.selectSensor = selectSensor;

// ============================================================================
// UPDATE ALL WIDGETS
// ============================================================================

function updateAllWidgets() {
    if (!window.selectedSensorData) {
        console.warn('No sensor data available for update');
        return;
    }
    
    updateAnalyticsChart();
    updatePeakPollutionHours();
    updateMonthlyAQI();
    updateHeatmap();
    updateMapStreetView();
    
    console.log('✅ All widgets updated');
}

// ============================================================================
// MAP STREET VIEW CARD - SIMPLIFIED VERSION
// ============================================================================

function updateMapStreetView() {
    const streetViewCard = document.querySelector('.street-view-card');
    if (!streetViewCard) return;
    
    console.log('🗺️ Updating street view, selectedSensorId:', window.selectedSensorId);
    
    // If no sensor selected, show default message
    if (!window.selectedSensorId) {
        streetViewCard.innerHTML = `
            <div class="street-view-compact">
                <div class="street-icon">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
                <div class="street-details">
                    <h4>Select a Sensor</h4>
                    <p>Click on a map marker</p>
                </div>
            </div>
        `;
        
        // Reset heatmap to show all sensors average
        updateHeatmapFromLiveData();
        return;
    }
    
    // Get sensor info
    let sensorInfo = null;
    for (let key in window.sensors) {
        if (window.sensors[key].id === window.selectedSensorId) {
            sensorInfo = window.sensors[key];
            break;
        }
    }
    
    if (!sensorInfo) {
        console.error('Sensor info not found for', window.selectedSensorId);
        return;
    }
    
    // Get AQI from sensor state
    const liveData = window.sensorState[window.selectedSensorId] || window.sensorState[sensorInfo.name];
    const aqi = liveData?.aqi ?? 0;
    const color = getAQIColor(aqi);
    const category = getAQICategory(aqi);
    
    // Update the street view card with simplified content
    streetViewCard.innerHTML = `
        <div class="street-view-compact">
            <div class="street-icon" style="background: ${color}20; color: ${color}">
                <i class="fas fa-broadcast-tower"></i>
            </div>
            <div class="street-details">
                <h4>${sensorInfo.name}</h4>
                <div class="aqi-compact">
                    <span class="aqi-value" style="color: ${color}">${Math.round(aqi)}</span>
                    <span class="aqi-label">AQI - ${category.text}</span>
                </div>
            </div>
        </div>
    `;
    
    // Update heatmap with live data
    updateHeatmapFromLiveData();
    
    console.log('✅ Street view updated with sensor:', window.selectedSensorId, sensorInfo.name);
}

// Make this function globally accessible
window.updateMapStreetView = updateMapStreetView;

// ============================================================================
// ANALYTICS CHART
// ============================================================================

function updateAnalyticsChart() {
    if (!analyticsChart || !window.selectedSensorData) return;
    
    const data = window.selectedSensorData;
    const readings = [...data.readings].reverse();
    
    const timestamps = readings.map(r => new Date(r.timestamp));
    const aqiData = readings.map(r => r.air_quality || 0);
    const tempData = readings.map(r => r.temperature || 0);
    const humidityData = readings.map(r => r.humidity || 0);
    
    const labels = timestamps.map(t => 
        t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
    
    const avgAQI = aqiData.reduce((a, b) => a + b, 0) / aqiData.length;
    const color = getAQIColor(avgAQI);
    
    analyticsChart.data.labels = labels;
    analyticsChart.data.datasets = [
        {
            label: `${data.sensorId} - AQI`,
            data: aqiData,
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 3,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
        },
        {
            label: 'Temperature (°C)',
            data: tempData,
            borderColor: '#00A8E8',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: false,
            yAxisID: 'y1',
            hidden: true
        },
        {
            label: 'Humidity (%)',
            data: humidityData,
            borderColor: '#00E396',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: false,
            yAxisID: 'y1',
            hidden: true
        }
    ];
    
    analyticsChart.options.scales.y1 = {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
            drawOnChartArea: false,
        },
        ticks: {
            color: '#aaa'
        }
    };
    
    analyticsChart.update();
    
    console.log('✅ Analytics chart updated');
}

// ============================================================================
// PEAK POLLUTION HOURS
// ============================================================================

function updatePeakPollutionHours() {
    const container = document.querySelector('.peak-bars');
    if (!container || !window.selectedSensorData) return;
    
    const readings = window.selectedSensorData.readings;
    
    const hourlyData = {};
    readings.forEach(r => {
        const hour = new Date(r.timestamp).getHours();
        if (!hourlyData[hour]) {
            hourlyData[hour] = [];
        }
        hourlyData[hour].push(r.air_quality);
    });
    
    const hourlyAvg = {};
    Object.keys(hourlyData).forEach(hour => {
        const values = hourlyData[hour];
        hourlyAvg[hour] = values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    const sortedHours = Object.entries(hourlyAvg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    container.innerHTML = sortedHours.map(([hour, aqi]) => {
        const percent = Math.min(100, Math.round((aqi / 150) * 100));
        let cls = 'success';
        if (aqi > 50) cls = 'warning';
        if (aqi > 100) cls = 'danger';
        
        const hourFormatted = `${String(hour).padStart(2, '0')}:00`;
        
        return `
            <div class="peak-row">
                <span class="time-label">${hourFormatted}</span>
                <div class="bar-container">
                    <div class="bar-fill ${cls}" style="width:${percent}%"></div>
                </div>
                <span class="value-label ${cls}">${Math.round(aqi)} AQI</span>
            </div>
        `;
    }).join('');
    
    console.log('✅ Peak pollution hours updated');
}

// ============================================================================
// MONTHLY AQI
// ============================================================================

function updateMonthlyAQI() {
    const chart = document.querySelector('.monthly-chart');
    if (!chart || !window.selectedSensorData) return;
    
    const readings = window.selectedSensorData.readings;
    const avgAQI = readings.reduce((sum, r) => sum + r.air_quality, 0) / readings.length;
    
    const months = ['SEP', 'OCT', 'NOV', 'DEC', 'JAN'];
    
    chart.innerHTML = months.map((m, i) => {
        let value;
        if (i === months.length - 1) {
            value = avgAQI;
        } else {
            const variation = (Math.random() - 0.5) * 20;
            value = avgAQI + variation;
        }
        
        const height = Math.min(100, Math.max(10, value));
        const color = getAQIColor(value);
        
        return `
            <div class="month-bar ${i === months.length - 1 ? 'active' : ''}">
                <div class="bar" style="height:${height}px; background-color: ${color};"></div>
                <span>${m}</span>
                <div class="month-value">${Math.round(value)}</div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Monthly AQI updated');
}

// ============================================================================
// HEATMAP - ENHANCED VERSION WITH LIVE DATA SUPPORT
// ============================================================================

function updateHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid || !window.selectedSensorData) return;
    
    const readings = window.selectedSensorData.readings;
    
    const hourlyPattern = new Array(7).fill(null).map(() => new Array(24).fill(0));
    const hourlyCounts = new Array(7).fill(null).map(() => new Array(24).fill(0));
    
    readings.forEach(r => {
        const date = new Date(r.timestamp);
        const day = date.getDay();
        const hour = date.getHours();
        
        hourlyPattern[day][hour] += r.air_quality;
        hourlyCounts[day][hour]++;
    });
    
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            if (hourlyCounts[d][h] > 0) {
                hourlyPattern[d][h] /= hourlyCounts[d][h];
            } else {
                hourlyPattern[d][h] = readings.reduce((sum, r) => sum + r.air_quality, 0) / readings.length;
            }
        }
    }
    
    grid.innerHTML = '';
    
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'heat-cell';
            
            const aqi = hourlyPattern[d][h];
            const intensity = Math.min(1, aqi / 150);
            const color = getAQIColor(aqi);
            
            cell.style.backgroundColor = color;
            cell.style.opacity = Math.max(0.3, intensity);
            
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            cell.title = `${days[d]} ${h}:00 - AQI: ${Math.round(aqi)}`;
            
            grid.appendChild(cell);
        }
    }
    
    console.log('✅ Heatmap updated');
}

function updateHeatmapFromLiveData() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;
    
    console.log('🔥 Updating heatmap from live data');
    
    // If we have historical data for selected sensor, use that
    if (window.selectedSensorData && window.selectedSensorData.readings) {
        updateHeatmap();
        return;
    }
    
    // Otherwise, create a simulated pattern based on current live data
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    // Get average AQI from all active sensors
    let avgAQI = 50; // default
    let totalAQI = 0;
    let count = 0;
    
    Object.keys(window.sensorState).forEach(key => {
        const sensor = window.sensorState[key];
        if (sensor.aqi !== undefined) {
            totalAQI += sensor.aqi;
            count++;
        }
    });
    
    if (count > 0) {
        avgAQI = totalAQI / count;
    }
    
    // Create a pattern based on typical daily AQI variations
    grid.innerHTML = '';
    
    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'heat-cell';
            
            // Simulate AQI pattern (higher during rush hours)
            let aqi = avgAQI;
            
            // Morning rush (7-9 AM)
            if (h >= 7 && h <= 9) {
                aqi *= 1.2;
            }
            // Evening rush (5-7 PM)
            else if (h >= 17 && h <= 19) {
                aqi *= 1.25;
            }
            // Night time (lower)
            else if (h >= 22 || h <= 5) {
                aqi *= 0.7;
            }
            
            // Add some variation based on day
            aqi += (Math.sin(d * 0.5) * 10);
            
            // Highlight current time
            if (d === currentDay && h === currentHour) {
                aqi = avgAQI; // Use exact current average
                cell.classList.add('current-time');
            }
            
            const intensity = Math.min(1, aqi / 150);
            const color = getAQIColor(aqi);
            
            cell.style.backgroundColor = color;
            cell.style.opacity = Math.max(0.3, intensity);
            
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            cell.title = `${days[d]} ${h}:00 - AQI: ${Math.round(aqi)}`;
            
            grid.appendChild(cell);
        }
    }
    
    console.log('✅ Heatmap updated from live data (avg AQI:', Math.round(avgAQI), ')');
}

// ============================================================================
// SENSOR CARD RENDERING
// ============================================================================

function buildSensorCardHTML(sensor) {
    const color = sensor.aqi === '—' ? '#999' : getAQIColor(sensor.aqi);
    const category = sensor.aqi === '—' ? 'Waiting for data' : getAQICategory(sensor.aqi).text;

    return `
        <div class="sensor-card-inner">
            <div class="sensor-card front">
                <div class="sensor-card-header">
                    <div class="sensor-icon-badge">
                        <i class="fas fa-broadcast-tower"></i>
                    </div>
                    <div class="sensor-identity">
                        <h4>${sensor.id}</h4>
                        <p><i class="fas fa-map-marker-alt"></i> ${sensor.name}</p>
                    </div>
                    <div class="sensor-status-badge ${sensor.status || 'loading'}">
                        <i class="fas fa-circle"></i>
                    </div>
                </div>
                
                <div class="aqi-display">
                    <div class="aqi-label">
                        <i class="fas fa-wind"></i> Air Quality Index
                    </div>
                    <div class="aqi-value-wrapper">
                        <div class="aqi-value" style="color: ${color};">
                            ${sensor.aqi}
                        </div>
                        <div class="aqi-category" style="color: ${color};">
                            ${category}
                        </div>
                    </div>
                </div>
                
                <button class="flip-btn details-btn" onclick="event.stopPropagation();">
                    <i class="fas fa-info-circle"></i> View Details
                </button>
                <button class="flip-btn prediction-btn" onclick="event.stopPropagation();">
                    <i class="fas fa-chart-line"></i> View Predictions
                </button>
            </div>

            <div class="sensor-card back">
                <div class="sensor-card-header">
                    <div class="sensor-icon-badge">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="sensor-identity">
                        <h4>Pollutant Levels</h4>
                        <p><i class="fas fa-flask"></i> Live Readings</p>
                    </div>
                </div>
                
                <div class="details-grid">
                    <div class="detail-row">
                        <div class="detail-icon no2">
                            <i class="fas fa-smog"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Nitrogen Dioxide</span>
                            <span class="detail-value">
                                ${sensor.no2} <span class="detail-unit">ppb</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-icon co">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Carbon Monoxide</span>
                            <span class="detail-value">
                                ${sensor.co} <span class="detail-unit">ppm</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-icon smoke">
                            <i class="fas fa-cloud"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Smoke Particles</span>
                            <span class="detail-value">
                                ${sensor.smoke} <span class="detail-unit">µg/m³</span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <button class="flip-btn back-btn" onclick="event.stopPropagation();">
                    <i class="fas fa-arrow-left"></i> Back to Overview
                </button>
            </div>
        </div>
    `;
}

function renderSensorCards(count) {
    const grid = document.querySelector('.sensor-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const mapSensors = window.sensors || {};

    for (let i = 1; i <= count; i++) {
        const mapSensor = mapSensors[i];
        if (!mapSensor) {
            console.warn(`No sensor definition for index ${i}`);
            continue;
        }

        const card = document.createElement('div');
        card.className = 'sensor-card-wrapper';
        card.dataset.sensorId = mapSensor.id;
        card.dataset.sensorIndex = i;

        card.innerHTML = buildSensorCardHTML({
            id: mapSensor.id,
            name: mapSensor.name,
            aqi: '—',
            no2: '—',
            co: '—',
            smoke: '—',
            status: 'loading'
        });

        grid.appendChild(card);
    }

    bindFlipButtons();
}

function updateSensorCardsFromDB() {
    const wrappers = document.querySelectorAll('.sensor-card-wrapper');
    
    console.log('🔄 Updating sensor cards from DB, sensorState:', window.sensorState);

    wrappers.forEach(wrapper => {
        const sensorId = wrapper.dataset.sensorId;
        const sensorIndex = wrapper.dataset.sensorIndex;
        const mapSensor = window.sensors[sensorIndex];

        if (!mapSensor) return;

        const liveData = window.sensorState[sensorId] || window.sensorState[mapSensor.name];
        
        console.log(`Updating card ${sensorId}:`, liveData);

        const sensor = {
            id: mapSensor.id,
            name: mapSensor.name,
            aqi: liveData?.aqi ?? '—',
            no2: liveData?.no2 ?? '—',
            co: liveData?.co ?? '—',
            smoke: liveData?.smoke ?? '—',
            status: liveData ? 'online' : 'loading'
        };

        wrapper.innerHTML = buildSensorCardHTML(sensor);
    });

    bindFlipButtons();
    
    // Dispatch event for map markers to update
    window.dispatchEvent(new CustomEvent('sensorDataUpdated'));
    
    console.log('✅ Sensor cards updated');
}

function bindFlipButtons() {
    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            btn.closest('.sensor-card-wrapper').classList.add('flipped');
        };
    });

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            btn.closest('.sensor-card-wrapper').classList.remove('flipped');
        };
    });

    document.querySelectorAll('.prediction-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();

            const wrapper = btn.closest('.sensor-card-wrapper');
            const sensorId = wrapper.dataset.sensorId;
            const sensorIndex = wrapper.dataset.sensorIndex;

            await selectSensor(sensorId, sensorIndex);
            showSensorAnalytics(sensorId, sensorIndex);
        };
    });

    document.querySelectorAll('.sensor-card-wrapper').forEach(wrapper => {
        wrapper.onclick = async (e) => {
            if (e.target.closest('.flip-btn')) return;

            const sensorId = wrapper.dataset.sensorId;
            const sensorIndex = wrapper.dataset.sensorIndex;

            await selectSensor(sensorId, sensorIndex);
        };
    });
}

// ============================================================================
// SENSOR ANALYTICS MODAL
// ============================================================================

async function showSensorAnalytics(sensorId, sensorIndex) {
    console.log('📊 Opening analytics for sensor:', sensorId);

    const mapSensor = window.sensors[sensorIndex];
    const liveData = window.sensorState[sensorId] || window.sensorState[mapSensor?.name];

    if (!mapSensor) {
        console.error('Sensor not found:', sensorId);
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'analytics-modal';
    modal.innerHTML = `
        <div class="analytics-modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="analytics-modal-content">
            <div class="analytics-header">
                <div>
                    <h2>${sensorId}</h2>
                    <p>${mapSensor.name}</p>
                </div>
                <button class="close-analytics" onclick="this.closest('.analytics-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="analytics-body">
                <div class="analytics-current">
                    <h3>Current Readings</h3>
                    <div class="analytics-stats">
                        <div class="analytics-stat">
                            <span class="stat-label">AQI</span>
                            <span class="stat-value" style="color: ${getAQIColor(liveData?.aqi ?? 50)}">
                                ${liveData?.aqi ?? '--'}
                            </span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">NO₂</span>
                            <span class="stat-value">${liveData?.no2 ?? '--'} ppb</span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">CO</span>
                            <span class="stat-value">${liveData?.co ?? '--'} ppm</span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">Smoke</span>
                            <span class="stat-value">${liveData?.smoke ?? '--'} µg/m³</span>
                        </div>
                    </div>
                </div>
                
                <div class="analytics-chart-section">
                    <h3>24-Hour AQI Forecast</h3>
                    <div class="forecast-loading">Loading forecast...</div>
                    <div class="analytics-chart-placeholder" style="display: none;">
                        <canvas id="forecastChart-${sensorId}"></canvas>
                    </div>
                </div>
                
                <div class="analytics-logs">
                    <h3>Recent Activity</h3>
                    <div class="log-list" id="logs-${sensorId}">
                        <div class="log-entry">
                            <span class="log-time">Loading...</span>
                            <span class="log-message">Fetching sensor logs...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    await loadSensorForecast(sensorId);
    await loadSensorLogs(sensorId);
}

async function loadSensorForecast(sensorId) {
    try {
        const response = await fetch(`/api/sensors/${sensorId}/forecast/`);
        const data = await response.json();
        
        if (data.error) {
            document.querySelector('.forecast-loading').textContent = 
                'Insufficient data for forecast';
            return;
        }
        
        document.querySelector('.forecast-loading').style.display = 'none';
        document.querySelector('.analytics-chart-placeholder').style.display = 'block';
        
        const ctx = document.getElementById(`forecastChart-${sensorId}`);
        if (!ctx) return;
        
        const labels = data.forecast.map(f => f.hour);
        const forecastData = data.forecast.map(f => f.predicted_aqi);
        const confidence = data.forecast.map(f => f.confidence);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Predicted AQI',
                    data: forecastData,
                    borderColor: getAQIColor(data.current_aqi),
                    backgroundColor: getAQIColor(data.current_aqi) + '20',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#fff'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                return `Confidence: ${(confidence[index] * 100).toFixed(0)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#aaa'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#aaa',
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 12
                        }
                    }
                }
            }
        });
        
        console.log('✅ Forecast chart loaded for', sensorId);
        
    } catch (error) {
        console.error('Error loading forecast:', error);
        document.querySelector('.forecast-loading').textContent = 
            'Error loading forecast';
    }
}

async function loadSensorLogs(sensorId) {
    try {
        const response = await fetch(`/api/sensors/${sensorId}/readings/?limit=10`);
        const data = await response.json();
        
        const logContainer = document.getElementById(`logs-${sensorId}`);
        if (!logContainer) return;
        
        if (!data.readings || data.readings.length === 0) {
            logContainer.innerHTML = `
                <div class="log-entry">
                    <span class="log-message">No recent activity</span>
                </div>
            `;
            return;
        }
        
        logContainer.innerHTML = data.readings.map(reading => {
            const time = new Date(reading.timestamp).toLocaleTimeString();
            const status = reading.aqi_category || 'Unknown';
            return `
                <div class="log-entry">
                    <span class="log-time">${time}</span>
                    <span class="log-message">AQI: ${Math.round(reading.air_quality)} - ${status}</span>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading sensor logs:', error);
    }
}

// ============================================================================
// SENSOR COUNT CONTROL
// ============================================================================

function initSensorCounterButtons() {
    const btnMinus = document.getElementById('sensorMinus');
    const btnPlus = document.getElementById('sensorPlus');
    const countEl = document.getElementById('sensorCount');

    if (!btnMinus || !btnPlus || !countEl) return;

    const MIN = 1;
    const MAX = 10;

    if (typeof window.activeSensorCount !== 'number') {
        window.activeSensorCount = MIN;
    }

    countEl.textContent = window.activeSensorCount;
    renderSensorCards(window.activeSensorCount);

    async function sync() {
        countEl.textContent = window.activeSensorCount;
        renderSensorCards(window.activeSensorCount);

        try {
            const response = await fetch('/api/set_sensor_count/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': await getCSRFToken()
                },
                body: JSON.stringify({
                    count: window.activeSensorCount
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('✅ Backend sensor count updated:', data.sensor_count);
            }
        } catch (error) {
            console.error('❌ Error updating backend sensor count:', error);
        }

        window.dispatchEvent(
            new CustomEvent('sensorCountChanged', {
                detail: window.activeSensorCount
            })
        );
    }

    btnPlus.onclick = () => {
        if (window.activeSensorCount >= MAX) return;
        window.activeSensorCount++;
        sync();
    };

    btnMinus.onclick = () => {
        if (window.activeSensorCount <= MIN) return;
        window.activeSensorCount--;
        sync();
    };
}

// ============================================================================
// TERMINAL SIDEBAR
// ============================================================================

function initTerminalSidebar() {
    const widgetBtn = document.getElementById("widgetToggle");
    const terminalSidebar = document.getElementById("terminalSidebar");
    const closeBtn = document.getElementById("closeSidebar");
    const startSimBtn = document.getElementById("startSimBtn");
    const stopSimBtn = document.getElementById("stopSimBtn");
    const resetSimBtn = document.getElementById("resetSimBtn");
    const terminalContent = document.getElementById("terminalContent");

    if (!widgetBtn || !terminalSidebar || !terminalContent) {
        console.warn("Terminal sidebar elements missing");
        return;
    }

    let logPollingInterval = null;
    let isPolling = false;

    widgetBtn.addEventListener("click", () => {
        terminalSidebar.classList.remove("hidden");
        terminalSidebar.classList.toggle("open");

        if (terminalSidebar.classList.contains("open")) {
            checkSimulationStatus();
        }
    });

    closeBtn?.addEventListener("click", () => {
        terminalSidebar.classList.remove("open");
    });

    function addTerminalLog(type, message, timestamp = null) {
        const time = timestamp || new Date().toLocaleTimeString();
        const logLine = document.createElement("div");
        logLine.className = `terminal-line log-${type.toLowerCase()}`;
        logLine.innerHTML = `
            <span class="terminal-timestamp">[${time}]</span>
            <span class="terminal-prompt">[${type}]</span>
            <span class="terminal-text">${message}</span>
        `;
        terminalContent.appendChild(logLine);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    function clearTerminal() {
        terminalContent.innerHTML = `
            <div class="terminal-line">
                <span class="terminal-prompt">[SYSTEM]</span>
                <span class="terminal-text">Environment Simulator Ready</span>
            </div>
            <div class="terminal-line">
                <span class="terminal-prompt">[INFO]</span>
                <span class="terminal-text">Awaiting command...</span>
            </div>
        `;
    }

    async function fetchLogs() {
        try {
            const response = await fetch("/api/logs/");
            if (!response.ok) throw new Error("Failed to fetch logs");

            const data = await response.json();
            terminalContent.innerHTML = "";

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    addTerminalLog(log.level, log.message, log.timestamp);
                });
            } else {
                clearTerminal();
            }
        } catch (err) {
            console.error("Log fetch error:", err);
            addTerminalLog("ERROR", "Failed to fetch logs from server");
        }
    }

    function startLogPolling() {
        if (isPolling) return;
        isPolling = true;
        fetchLogs();
        logPollingInterval = setInterval(fetchLogs, 2000);
    }

    function stopLogPolling() {
        isPolling = false;
        if (logPollingInterval) {
            clearInterval(logPollingInterval);
            logPollingInterval = null;
        }
    }

    async function checkSimulationStatus() {
        try {
            const response = await fetch("/api/simulation_status/");
            const data = await response.json();

            if (data.running) {
                startSimBtn.disabled = true;
                stopSimBtn.disabled = false;
                startLogPolling();
                startNotificationMonitoring();
            } else {
                startSimBtn.disabled = false;
                stopSimBtn.disabled = true;
                stopLogPolling();
                stopNotificationMonitoring();
            }
        } catch (err) {
            console.error("Status check error:", err);
        }
    }

    async function startSimulation() {
        try {
            startSimBtn.disabled = true;
            addTerminalLog("SYSTEM", "Initializing simulation...");

            const sensorCount = parseInt(
                document.getElementById("sensorCount").textContent
            );

            const response = await fetch("/api/simulation/start/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sensor_count: sensorCount
                })
            });

            const data = await response.json();

            if (data.success) {
                addTerminalLog("SUCCESS", data.message);
                stopSimBtn.disabled = false;
                startLogPolling();
                startNotificationMonitoring();
            } else {
                addTerminalLog("ERROR", data.message);
                startSimBtn.disabled = false;
            }
        } catch (err) {
            console.error("Start simulation error:", err);
            addTerminalLog("ERROR", "Failed to start simulation");
            startSimBtn.disabled = false;
        }
    }

    async function stopSimulation() {
        try {
            stopSimBtn.disabled = true;
            addTerminalLog("SYSTEM", "Stopping simulation...");

            const response = await fetch("/api/simulation/stop/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (data.success) {
                addTerminalLog("SUCCESS", data.message);
                startSimBtn.disabled = false;
                stopLogPolling();
                stopNotificationMonitoring();
            } else {
                addTerminalLog("ERROR", data.message);
                stopSimBtn.disabled = false;
            }
        } catch (err) {
            console.error("Stop simulation error:", err);
            addTerminalLog("ERROR", "Failed to stop simulation");
            stopSimBtn.disabled = false;
        }
    }

    async function resetSimulation() {
        try {
            stopLogPolling();
            stopNotificationMonitoring();
            addTerminalLog("SYSTEM", "Resetting simulation...");

            const response = await fetch("/api/simulation/reset/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (data.success) {
                setTimeout(() => {
                    clearTerminal();
                    addTerminalLog("SUCCESS", "Simulation reset complete");
                }, 500);

                startSimBtn.disabled = false;
                stopSimBtn.disabled = true;
            } else {
                addTerminalLog("ERROR", data.message);
            }
        } catch (err) {
            console.error("Reset simulation error:", err);
            addTerminalLog("ERROR", "Failed to reset simulation");
        }
    }

    startSimBtn?.addEventListener("click", startSimulation);
    stopSimBtn?.addEventListener("click", stopSimulation);
    resetSimBtn?.addEventListener("click", resetSimulation);

    checkSimulationStatus();
}

// ============================================================================
// MOBILE SIDEBAR
// ============================================================================

function initMobileSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-visible');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-visible');
            overlay.classList.remove('active');
        });
    }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const settingsToggle = document.getElementById('settingsThemeToggle');
    const htmlElement = document.documentElement;
    const icon = themeToggle ? themeToggle.querySelector('i') : null;

    function applyTheme(isLight) {
        const theme = isLight ? 'light' : 'dark';

        if (isLight) {
            htmlElement.classList.add('light-mode');
            if (icon) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        } else {
            htmlElement.classList.remove('light-mode');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }

        localStorage.setItem('theme', theme);

        if (settingsToggle) {
            settingsToggle.checked = !isLight;
        }

        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    const savedTheme = localStorage.getItem('theme');
    let isLightInit = savedTheme === 'light';

    applyTheme(isLightInit);

    setTimeout(() => {
        if (!htmlElement.classList.contains('theme-transition')) {
            htmlElement.classList.add('theme-transition');
        }
    }, 100);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (!htmlElement.classList.contains('theme-transition')) {
                htmlElement.classList.add('theme-transition');
            }
            const isLightNow = htmlElement.classList.contains('light-mode');
            applyTheme(!isLightNow);
        });
    }

    if (settingsToggle) {
        settingsToggle.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            applyTheme(!isDark);
        });
    }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchSimulatedSensorData() {
    try {
        const res = await fetch('/api/sensor-data/');
        const json = await res.json();

        if (!json.data) return;

        window.sensorState = {};
        const count = window.activeSensorCount;

        json.data.slice(0, count).forEach((s, index) => {
            const mapSensor = window.sensors[index + 1];
            if (!mapSensor) return;

            window.sensorState[mapSensor.id] = {
                id: mapSensor.id,
                name: mapSensor.name,
                lat: s.latitude,
                lng: s.longitude,
                aqi: s.aqi,
                no2: s.no2,
                co: s.co,
                smoke: s.smoke,
                humidity: s.humidity || 50 // Add humidity data for street highlighting
            };
        });

        console.log('📊 Fetched sensor data:', window.sensorState);

        updateSensorCardsFromDB();
        
        // Update street polylines with new humidity data
        if (typeof window.updateStreetPolylineColors === 'function') {
            window.updateStreetPolylineColors();
        }
        
        // Update street view if a sensor is selected
        if (window.selectedSensorId) {
            updateMapStreetView();
        } else {
            // Update heatmap with current live data even if no sensor selected
            updateHeatmapFromLiveData();
        }

    } catch (error) {
        console.error('Error fetching simulated sensor data:', error);
    }
}

// ============================================================================
// ANALYTICS CHART INITIALIZATION
// ============================================================================

function initAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    const chartData = {
        labels: [],
        datasets: [{
            label: 'Select a sensor to view data',
            data: [],
            borderColor: '#00E396',
            backgroundColor: 'rgba(0, 227, 150, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#00E396',
            tension: 0.4,
            fill: true
        }]
    };

    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#aaa'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#aaa'
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
        }
    };

    try {
        if (analyticsChart) {
            analyticsChart.destroy();
        }
        analyticsChart = new Chart(ctx, config);
    } catch (err) {
        console.error('Error creating analytics chart:', err);
    }

    initChartControls();
    window.addEventListener('themeChanged', updateChartTheme);
}

function initChartControls() {
    window.updateChartType = function (type) {
        const curveBtn = document.getElementById('curveBtn');
        const barBtn = document.getElementById('barBtn');

        if (type === 'line') {
            if (curveBtn) curveBtn.classList.add('active');
            if (barBtn) barBtn.classList.remove('active');
            if (analyticsChart) analyticsChart.config.type = 'line';
        } else {
            if (barBtn) barBtn.classList.add('active');
            if (curveBtn) curveBtn.classList.remove('active');
            if (analyticsChart) analyticsChart.config.type = 'bar';
        }

        if (analyticsChart) analyticsChart.update();
    };

    const sensorFilter = document.getElementById('sensorFilter');
    if (sensorFilter) {
        sensorFilter.addEventListener('change', async (e) => {
            const sensorId = e.target.value;

            if (sensorId === 'all') {
                analyticsChart.data.datasets[0].data = [];
                analyticsChart.data.datasets[0].label = 'Select a sensor to view data';
                analyticsChart.update();
                return;
            }

            const sensorIndex = Object.keys(window.sensors).find(
                key => window.sensors[key].id === sensorId
            );

            if (sensorIndex) {
                await selectSensor(sensorId, sensorIndex);
            }
        });
    }
}

function updateChartTheme(e) {
    if (!analyticsChart) return;

    const isLight = e.detail.theme === 'light';
    const textColor = isLight ? '#333' : '#fff';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    analyticsChart.options.plugins.legend.labels.color = textColor;
    analyticsChart.options.scales.x.ticks.color = textColor;
    analyticsChart.options.scales.y.ticks.color = textColor;
    analyticsChart.options.scales.y.grid.color = gridColor;
    analyticsChart.update();
}

// ============================================================================
// CALENDAR WIDGET - FEBRUARY 2026
// ============================================================================

function initCalendar() {
    const calendarGrid = document.querySelector('.calendar-grid');
    if (!calendarGrid) return;
    
    // February 2026 calendar
    const now = new Date(); // February 8, 2026
    const year = now.getFullYear(); // 2026
    const month = now.getMonth(); // 1 (February is month index 1)
    const today = now.getDate(); // 8
    
    // Get first day of month (0 = Sunday, 6 = Saturday)
    // February 1, 2026 is a Sunday (index 0)
    const firstDay = new Date(year, month, 1).getDay();
    
    // Get number of days in month
    // February 2026 has 28 days (not a leap year)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Get days in previous month (January 2026 has 31 days)
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Clear existing content
    calendarGrid.innerHTML = '';
    
    // Add day labels
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayLabels.forEach(label => {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'day-label';
        labelDiv.textContent = label;
        calendarGrid.appendChild(labelDiv);
    });
    
    // Add previous month's trailing days (if any)
    // February 1, 2026 starts on Sunday, so no trailing days needed
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day inactive';
        dayDiv.textContent = daysInPrevMonth - i;
        calendarGrid.appendChild(dayDiv);
    }
    
    // Add current month's days (February 1-28, 2026)
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        
        if (day === today) {
            // February 8, 2026 is TODAY
            dayDiv.classList.add('active-current');
        } else if (day < today) {
            // Days 1-7 are in the past
            dayDiv.classList.add('active');
        }
        
        dayDiv.textContent = day;
        
        // Add click handler
        dayDiv.addEventListener('click', function() {
            // Remove active-current from all days
            document.querySelectorAll('.day:not(.inactive)').forEach(d => {
                d.classList.remove('active-current');
            });
            // Add to clicked day
            this.classList.add('active-current');
        });
        
        calendarGrid.appendChild(dayDiv);
    }
    
    // Add next month's leading days to complete the grid
    // We need to fill up to 6 rows × 7 columns = 42 total cells
    const totalCells = calendarGrid.children.length - 7; // Subtract day labels
    const remainingCells = 42 - totalCells - 7; // 6 rows * 7 days - used cells - labels
    
    // March 2026 days (1, 2, 3, etc.)
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day inactive';
        dayDiv.textContent = day;
        calendarGrid.appendChild(dayDiv);
    }
    
    console.log('✅ Calendar initialized - February 2026');
    console.log(`   Today: February ${today}, 2026 (${dayLabels[now.getDay()]})`);
}

// ============================================================================
// BLOG POST MANAGEMENT - IMPROVED WITH IMAGES
// ============================================================================

function initBlogForm() {
    const addTitleBtn = document.getElementById('addTitleBtn');
    const blogForm = document.getElementById('blogForm');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sendBtn = document.getElementById('sendBtn');
    const dropZone = document.getElementById('dropZone');
    const postImageInput = document.getElementById('postImage');
    const postTitle = document.getElementById('postTitle');
    const titleCount = document.getElementById('titleCount');
    const postDesc = document.getElementById('postDesc');
    const descCount = document.getElementById('descCount');

    if (addTitleBtn && blogForm) {
        addTitleBtn.addEventListener('click', () => {
            blogForm.style.display = blogForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (closeFormBtn && blogForm) {
        closeFormBtn.addEventListener('click', () => {
            blogForm.style.display = 'none';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (postTitle) postTitle.value = '';
            if (postDesc) postDesc.value = '';
            if (postImageInput) postImageInput.value = '';
            if (document.getElementById('postAuthor')) {
                document.getElementById('postAuthor').value = '';
            }
            if (blogForm) blogForm.style.display = 'none';
        });
    }

    if (postTitle && titleCount) {
        postTitle.addEventListener('input', function () {
            titleCount.textContent = `${this.value.length}/90`;
        });
    }

    if (postDesc && descCount) {
        postDesc.addEventListener('input', function () {
            descCount.textContent = `${this.value.length}/2000`;
        });
    }

    if (dropZone && postImageInput) {
        dropZone.addEventListener('click', () => postImageInput.click());

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                postImageInput.files = files;
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', handlePostSubmit);
    }

    if (document.getElementById('blogGrid')) {
        fetchPosts();
    }
}

async function handlePostSubmit() {
    const sendBtn = document.getElementById('sendBtn');
    const postTitle = document.getElementById('postTitle');
    const postAuthor = document.getElementById('postAuthor');
    const postDesc = document.getElementById('postDesc');
    const postImageInput = document.getElementById('postImage');
    const blogForm = document.getElementById('blogForm');

    const title = postTitle ? postTitle.value.trim() : '';
    const content = postDesc ? postDesc.value.trim() : '';

    if (!title || !content) {
        alert('Please provide a title and content.');
        return;
    }

    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();

    const fd = new FormData();
    fd.append('title', title);
    fd.append('slug', slug);
    fd.append('content', content);
    fd.append('excerpt', content.slice(0, 250));
    fd.append('status', 'published');

    if (postImageInput && postImageInput.files && postImageInput.files[0]) {
        fd.append('image', postImageInput.files[0]);
    }

    try {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        const res = await fetch('/api/posts/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': await getCSRFToken(),
            },
            body: fd
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Server error' }));
            alert('Error creating post: ' + (err.slug ? err.slug[0] : err.detail || JSON.stringify(err)));
            return;
        }

        if (postTitle) postTitle.value = '';
        if (postAuthor) postAuthor.value = '';
        if (postDesc) postDesc.value = '';
        if (postImageInput) postImageInput.value = '';
        if (blogForm) blogForm.style.display = 'none';

        await fetchPosts();
        alert('✓ Post submitted successfully!');

    } catch (err) {
        alert('Network error: ' + err.message);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Submit Post';
    }
}

async function fetchPosts() {
    try {
        const res = await fetch('/api/posts/');
        const posts = await res.json();
        renderPosts(posts);
    } catch (err) {
        console.error('Error loading posts:', err);
    }
}

function renderPosts(posts) {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!posts || posts.length === 0) {
        grid.innerHTML = '<div class="empty-state">No posts yet</div>';
        return;
    }

    posts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'blog-card';
        
        let imageHtml = '';
        if (p.image) {
            imageHtml = `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" class="blog-image">`;
        }
        
        card.innerHTML = `
            ${imageHtml}
            <a href="/blog/${p.slug}/" class="blog-title-link">
                <h3>${escapeHtml(p.title)}</h3>
            </a>
            <p>${escapeHtml(p.excerpt || '')}</p>
        `;
        grid.appendChild(card);
    });
}

// ============================================================================
// NOTIFICATION SYSTEM (IMPROVED)
// ============================================================================

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const clearNotifs = document.getElementById('clearNotifs');

    if (!notificationBtn || !notificationDropdown) return;

    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && 
            e.target !== notificationBtn && 
            !notificationBtn.contains(e.target)) {
            notificationDropdown.classList.add('hidden');
        }
    });

    if (clearNotifs) {
        clearNotifs.addEventListener('click', () => {
            notifications = [];
            renderNotifications();
            updateNotificationBadge();
        });
    }
    
    // Initial render
    renderNotifications();
    
    // Note: startNotificationMonitoring() is now called from terminal sidebar
    // when simulation starts
}

function renderNotifications() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;

    if (notifications.length === 0) {
        notifList.innerHTML = '<div class="empty-state">No new alerts</div>';
        return;
    }

    notifList.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.type}">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>
                <div style="font-weight: 600;">${n.title}</div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">${n.message}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">${n.time}</div>
            </div>
        </div>
    `).join('');
}

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    
    if (notifications.length > 0) {
        badge.classList.remove('hidden');
        badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
    } else {
        badge.classList.add('hidden');
    }
}

function addNotification(title, message, type = 'danger') {
    const notification = {
        id: Date.now(),
        title: title,
        message: message,
        type: type,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    
    // Add to beginning of array (newest first)
    notifications.unshift(notification);
    
    // Keep only last 10 notifications
    if (notifications.length > 10) {
        notifications = notifications.slice(0, 10);
    }
    
    renderNotifications();
    updateNotificationBadge();
    
    // Show toast notification popup
    showToastNotification(notification);
    
    console.log('📢 Notification added:', title);
}

// ============================================================================
// TOAST NOTIFICATION POPUP SYSTEM
// ============================================================================

function showToastNotification(notification) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${notification.type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            ${getToastIcon(notification.type)}
        </div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(notification.title)}</div>
            <div class="toast-message">${escapeHtml(notification.message)}</div>
            <div class="toast-time">${notification.time}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, 5000);
    
    // Play notification sound (optional)
    playNotificationSound(notification.type);
}

function getToastIcon(type) {
    const icons = {
        'danger': '<i class="fas fa-exclamation-triangle"></i>',
        'warning': '<i class="fas fa-exclamation-circle"></i>',
        'success': '<i class="fas fa-check-circle"></i>',
        'info': '<i class="fas fa-info-circle"></i>'
    };
    return icons[type] || icons['info'];
}

function playNotificationSound(type) {
    // Optional: Add sound effects
    // You can use Web Audio API or HTML5 audio
    try {
        // Simple beep using AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different types
        const frequencies = {
            'danger': 800,
            'warning': 600,
            'success': 400,
            'info': 500
        };
        
        oscillator.frequency.value = frequencies[type] || 500;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        // Sound failed, but that's ok
        console.log('Sound notification not available');
    }
}

// ============================================================================
// ✅ FIXED NOTIFICATION MONITORING - CHECKS SIMULATION STATUS
// ============================================================================

function startNotificationMonitoring() {
    // Stop any existing monitoring
    stopNotificationMonitoring();
    
    // Check sensor AQI levels every 10 seconds
    notificationMonitoringInterval = setInterval(async () => {
        // ✅ CHECK IF SIMULATION IS RUNNING
        try {
            const response = await fetch("/api/simulation_status/");
            const data = await response.json();
            
            // If simulation is not running, skip checking
            if (!data.running) {
                console.log('⚠️ Simulation stopped, pausing notifications');
                return;
            }
        } catch (error) {
            console.error('Error checking simulation status:', error);
            return;
        }
        
        if (!window.sensorState) return;
        
        Object.keys(window.sensorState).forEach(sensorId => {
            const sensor = window.sensorState[sensorId];
            
            if (!sensor.aqi) return;
            
            // High AQI Alert (> 100)
            if (sensor.aqi > 100 && !sensor.notified_high) {
                addNotification(
                    'High AQI Alert',
                    `${sensor.name || sensorId}: AQI is ${Math.round(sensor.aqi)} (Unhealthy)`,
                    'danger'
                );
                sensor.notified_high = true;
            }
            
            // Very High AQI Alert (> 150)
            if (sensor.aqi > 150 && !sensor.notified_very_high) {
                addNotification(
                    'Critical AQI Alert',
                    `${sensor.name || sensorId}: AQI is ${Math.round(sensor.aqi)} (Hazardous)`,
                    'danger'
                );
                sensor.notified_very_high = true;
            }
            
            // Reset notification flags when AQI drops below threshold
            if (sensor.aqi <= 100) {
                sensor.notified_high = false;
                sensor.notified_very_high = false;
            }
        });
    }, 10000); // Check every 10 seconds
    
    console.log('✅ Notification monitoring started');
}

function stopNotificationMonitoring() {
    if (notificationMonitoringInterval) {
        clearInterval(notificationMonitoringInterval);
        notificationMonitoringInterval = null;
        console.log('⏹️ Notification monitoring stopped');
    }
    
    // Clear notification flags from all sensors
    if (window.sensorState) {
        Object.keys(window.sensorState).forEach(sensorId => {
            const sensor = window.sensorState[sensorId];
            if (sensor) {
                sensor.notified_high = false;
                sensor.notified_very_high = false;
            }
        });
    }
}

// ============================================================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE FOR MAP.JS
// ============================================================================

window.updateSidebarForSensor = async function(sensorId) {
    // Not needed - selectSensor handles sidebar updates
};

window.updateAnalyticsForSensor = async function(sensorId) {
    // Not needed - selectSensor handles analytics updates
};

// Test notification popup (for manual testing)
window.testNotificationPopup = function() {
    const testMessages = [
        { title: 'High AQI Alert', message: 'Ormes Road: AQI is 125 (Unhealthy)', type: 'danger' },
        { title: 'Sensor Maintenance', message: 'Halls Road sensor requires calibration', type: 'warning' },
        { title: 'Sensor Online', message: 'Flowers Road sensor reconnected successfully', type: 'success' },
        { title: 'Data Sync', message: 'All sensor readings synchronized', type: 'info' }
    ];
    const random = testMessages[Math.floor(Math.random() * testMessages.length)];
    addNotification(random.title, random.message, random.type);
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initMobileSidebar();
    initTheme();
    initAnalyticsChart();
    initCalendar(); // Initialize calendar
    initBlogForm();
    initNotifications();
    initTerminalSidebar();
    initSensorCounterButtons();
    
    // Initialize street view with default state
    updateMapStreetView();

    // Fetch data immediately and then at intervals
    fetchSimulatedSensorData();
    setInterval(fetchSimulatedSensorData, 5000); // Refresh every 5 seconds for better sync
});