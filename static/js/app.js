// ============================================================================
// GLOBAL STATE & CONFIGURATION
// ============================================================================

let notifications = [];
let analyticsChart = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
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

/**
 * Get CSRF token from cookies
 */
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

/**
 * Drag and drop event handlers
 */
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
// SENSOR COUNT BUTTON CONTROL
// ============================================================================

function initSensorCounterButtons() {

    const btnMinus = document.getElementById('sensorMinus');
    const btnPlus = document.getElementById('sensorPlus');
    const countEl = document.getElementById('sensorCount');

    if (!btnMinus || !btnPlus || !countEl) return;

    const MIN = 1;
    const MAX = 10;

    let count = MIN;
    countEl.textContent = count;

    btnPlus.addEventListener('click', () => {
        if (count < MAX) {
            count++;
            updateCount();
        }
    });

    btnMinus.addEventListener('click', () => {
        if (count > MIN) {
            count--;
            updateCount();
        }
    });

    function updateCount() {
        countEl.textContent = count;
        console.log('Sensor Count:', count);
        // Hook: updateSensorMarker(count);
    }
}



// ============================================================================
// TERMINAL SIDEBAR WITH BACKEND INTEGRATION
// ============================================================================
function initTerminalSidebar() {
    const widgetBtn = document.getElementById("widgetToggle");
    const terminalSidebar = document.getElementById("terminalSidebar");
    const closeBtn = document.getElementById("closeSidebar");
    const startSimBtn = document.getElementById("startSimBtn");
    const stopSimBtn = document.getElementById("stopSimBtn");
    const resetSimBtn = document.getElementById("resetSimBtn");
    const terminalContent = document.getElementById("terminalContent");
    // const sensorSlider = document.getElementById("sensor-slider");
    // const sensorSlider = document.getElementById("sensorSlider");
    const sensorCount = document.getElementById("sensorCount");

    if (!widgetBtn || !terminalSidebar || !terminalContent) {
        console.warn("Terminal sidebar elements missing");
        return;
    }

    let logPollingInterval = null;
    let isPolling = false;

    /* =========================
       SIDEBAR TOGGLE
    ========================== */
    widgetBtn.addEventListener("click", () => {
        terminalSidebar.classList.remove("hidden");
        terminalSidebar.classList.toggle("open");

        // Check status when opening
        if (terminalSidebar.classList.contains("open")) {
            checkSimulationStatus();
        }
    });

    closeBtn?.addEventListener("click", () => {
        terminalSidebar.classList.remove("open");
    });

    /* =========================
       TERMINAL LOG HELPER
    ========================== */
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

    /* =========================
       CLEAR TERMINAL
    ========================== */
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

    /* =========================
       FETCH AND DISPLAY LOGS
    ========================== */
    async function fetchLogs() {
        try {
            const response = await fetch("/api/logs/");
            if (!response.ok) throw new Error("Failed to fetch logs");

            const data = await response.json();

            // Clear and repopulate terminal with all logs
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

    /* =========================
       START LOG POLLING
    ========================== */
    function startLogPolling() {
        if (isPolling) return;

        isPolling = true;
        fetchLogs(); // Fetch immediately

        // Poll every 2 seconds
        logPollingInterval = setInterval(fetchLogs, 2000);
    }

    /* =========================
       STOP LOG POLLING
    ========================== */
    function stopLogPolling() {
        isPolling = false;
        if (logPollingInterval) {
            clearInterval(logPollingInterval);
            logPollingInterval = null;
        }
    }

    /* =========================
       CHECK SIMULATION STATUS
    ========================== */
    async function checkSimulationStatus() {
        try {
            const response = await fetch("/api/simulation_status/");
            const data = await response.json();

            if (data.running) {
                startSimBtn.disabled = true;
                stopSimBtn.disabled = false;
                startLogPolling();
            } else {
                startSimBtn.disabled = false;
                stopSimBtn.disabled = true;
                stopLogPolling();
            }
        } catch (err) {
            console.error("Status check error:", err);
        }
    }

    /* =========================
       START SIMULATION
    ========================== */
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

    /* =========================
       STOP SIMULATION
    ========================== */
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

    /* =========================
       RESET SIMULATION
    ========================== */
    async function resetSimulation() {
        try {
            // Stop polling first
            stopLogPolling();

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

    // const coordinates = [
    //     { lat: 0, lon: 0 },          // 0
    //     { id: 'KP-001', name: 'Kilpauk Main Road', lat: 13.0827, lng: 80.2385 },
    //     { id: 'KP-002', name: 'Kilpauk Garden', lat: 13.0850, lng: 80.2400 },
    //     { id: 'KP-003', name: 'Poonamallee High Rd', lat: 13.0800, lng: 80.2350 },
    //     { id: 'KP-004', name: 'Kodambakkam Bridge', lat: 13.0780, lng: 80.2370 },
    //     { id: 'KP-005', name: 'Kilpauk Medical College', lat: 13.0870, lng: 80.2420 },
    //     { id: 'PW-001', name: 'Purasawalkam Station', lat: 13.0668, lng: 80.2550 },
    //     { id: 'PW-002', name: 'Kaladipet', lat: 13.0700, lng: 80.2580 },
    //     { id: 'PW-003', name: 'Otteri Nullah', lat: 13.0640, lng: 80.2520 },
    //     { id: 'PW-004', name: 'Periyar EVR Road', lat: 13.0620, lng: 80.2570 },
    // ];

    // /* =========================
    //    SENSOR COUNT WIDGET
    // ========================== */
    // sensorCount.textContent = sensorSlider.value;
    // sensorSlider.addEventListener("input", () => {
    //     const index = parseInt(sensorSlider.value, 10);
    //     sensorCount.textContent = index;

    //     const coord = coordinates[index];

    //     if (coord) {
    //         console.log(`Slider: ${index}`, coord);
    //     } else {
    //         console.log("No coordinate for slider value:", index);
    //     }
    // });
    // /* =========================
    //    TRAFFIC INTENSITY WIDGET
    // ========================== */




    // /* =========================
    //    PEAK HOUR WIDGET
    // ========================== */












    /* =========================
       BUTTON BINDINGS
    ========================== */
    startSimBtn?.addEventListener("click", startSimulation);
    stopSimBtn?.addEventListener("click", stopSimulation);
    resetSimBtn?.addEventListener("click", resetSimulation);

    /* =========================
       INITIALIZE
    ========================== */
    // Check status on page load
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

    /**
     * Apply theme and update UI
     */
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

        // Sync settings toggle
        if (settingsToggle) {
            settingsToggle.checked = !isLight;
        }

        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    // Initialize theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme');
    let isLightInit;

    if (savedTheme === 'light' || savedTheme === 'dark') {
        isLightInit = savedTheme === 'light';
    } else {
        isLightInit = false; // Default to dark
    }

    // console.log('Theme init -> saved:', savedTheme, 'resolved isLight:', isLightInit);

    // Apply initial theme
    applyTheme(isLightInit);

    // Enable transitions after initial render
    setTimeout(() => {
        if (!htmlElement.classList.contains('theme-transition')) {
            htmlElement.classList.add('theme-transition');
        }
    }, 100);

    // Header toggle event
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (!htmlElement.classList.contains('theme-transition')) {
                htmlElement.classList.add('theme-transition');
            }
            const isLightNow = htmlElement.classList.contains('light-mode');
            applyTheme(!isLightNow);
        });
    }

    // Settings toggle event
    if (settingsToggle) {
        settingsToggle.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            applyTheme(!isDark);
        });
    }
}

// ============================================================================
// DASHBOARD DATA & STATS
// ============================================================================

async function fetchDashboardData() {
    try {
        const response = await fetch('/api/readings/?limit=1');
        const json = await response.json();
        const data = Array.isArray(json) ? json : (json.results || []);

        if (data && data.length > 0) {
            updateStats(data);
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

function updateStats(readings) {
    const latest = readings[0];

    // Update AQI
    const aqiElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (aqiElement) {
        aqiElement.textContent = latest.aqi;
    }

    // Update AQI Category
    const aqiStatus = document.getElementById("aqi_category");
    if (aqiStatus) {
        const category = latest.aqi_category.toUpperCase();
        aqiStatus.textContent = category;

        // Clear previous styles
        aqiStatus.classList.remove("excellent", "moderate", "poor");
        aqiStatus.style.color = "";

        // Apply class based on category
        if (category === "EXCELLENT") {
            aqiStatus.classList.add("excellent");
        } else if (category === "MODERATE") {
            aqiStatus.classList.add("moderate");
        } else if (category === "POOR") {
            aqiStatus.classList.add("poor");
        }
    }

    // Update Temperature
    const tempElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    // console.log('Temp Element:', tempElement);
    // console.log('Latest Temperature:', latest.temperature);
    if (tempElement) {
        tempElement.textContent = `${latest.temperature}°C`;
    }

    // Update Humidity
    const humElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (humElement) {
        humElement.textContent = `${latest.humidity}%`;
    }

    // Check for danger levels
    checkDangerLevel(latest);
}

// ============================================================================
// SENSOR DATA
// ============================================================================

async function fetchSensorData() {
    try {
        const response = await fetch('/api/sensors/');
        const json = await response.json();
        const data = Array.isArray(json) ? json : (json.results || []);

        if (data && data.length > 0) {
            updateSensor(data);
        }
    } catch (error) {
        console.error('Error fetching sensor data:', error);
    }
}

function updateSensor(sensors) {
    const allSensorsFilter = document.getElementById('allSensorsFilter');
    if (allSensorsFilter) {
        // console.log("Updating sensor count");
        const sensorCount = sensors.length;
        // console.log('Sensor Count:', sensorCount);
        allSensorsFilter.textContent = `ALL SENSORS (${sensorCount})`;
    }
}

// ============================================================================
// ANALYTICS CHART
// ============================================================================

function initAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    // console.log('Analytics canvas found:', ctx);
    // console.log('Chart global present:', typeof Chart !== 'undefined');

    const chartData = {
        labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
        datasets: [{
            label: 'Sensor A (Dwntwn)',
            data: [42, 45, 48, 55, 60, 58, 52, 48, 50, 55],
            borderColor: '#00E396',
            backgroundColor: 'rgba(0, 227, 150, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#00E396',
            tension: 0.4,
            fill: false
        },
        {
            label: 'Sensor B (Park)',
            data: [30, 32, 35, 38, 40, 38, 35, 32, 30, 32],
            borderColor: '#008FFB',
            backgroundColor: 'rgba(0, 143, 251, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#008FFB',
            tension: 0.4,
            fill: false
        },
        {
            label: 'Sensor C (Indstryl)',
            data: [65, 70, 75, 80, 85, 90, 85, 80, 75, 70],
            borderColor: '#FEB019',
            backgroundColor: 'rgba(254, 176, 25, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#FEB019',
            tension: 0.4,
            fill: false
        }
        ]
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
            analyticsChart = null;
        }

        analyticsChart = new Chart(ctx, config);
        // console.log('Analytics chart created successfully');
    } catch (err) {
        console.error('Error creating analytics chart:', err);
        try {
            const c2 = ctx.getContext && ctx.getContext('2d');
            if (c2) {
                analyticsChart = new Chart(c2, config);
                // console.log('Analytics chart created with 2D context fallback');
            } else {
                throw new Error('No 2D context available on canvas');
            }
        } catch (err2) {
            console.error('Fallback creation failed:', err2);
            createFallbackChart(ctx);
        }
    }

    // Initialize chart controls
    initChartControls();

    // Listen for theme changes
    window.addEventListener('themeChanged', updateChartTheme);
}

function createFallbackChart(ctx) {
    const fallback = document.createElement('canvas');
    fallback.id = 'analyticsFallback';
    fallback.style.width = '100%';
    fallback.style.height = '300px';
    ctx.parentNode.replaceChild(fallback, ctx);

    if (typeof Chart !== 'undefined') {
        new Chart(fallback, {
            type: 'line',
            data: {
                labels: ['t1', 't2', 't3'],
                datasets: [{
                    label: 'Test',
                    data: [1, 3, 2],
                    borderColor: '#00E396'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
        // console.log('Displayed fallback test chart');
    } else {
        const ctx2 = fallback.getContext('2d');
        ctx2.fillStyle = '#ff4d4d';
        ctx2.fillRect(10, 10, 100, 100);
        // console.log('Drew fallback red box (Chart.js missing)');
    }
}

function initChartControls() {
    // Chart type toggle buttons
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

    // Sensor filter
    const sensorFilter = document.getElementById('sensorFilter');
    if (sensorFilter) {
        sensorFilter.addEventListener('change', (e) => {
            const val = e.target.value;

            analyticsChart.data.datasets.forEach((dataset, index) => {
                if (val === 'all') {
                    dataset.hidden = false;
                } else {
                    dataset.hidden = index !== parseInt(val);
                }
            });

            analyticsChart.update();
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
// HEATMAP
// ============================================================================

function initHeatmap() {
    const heatmapGrid = document.getElementById('heatmapGrid');
    if (!heatmapGrid) return;

    // Generate 7 days × 24 hours = 168 cells
    for (let i = 0; i < 168; i++) {
        const cell = document.createElement('div');
        cell.className = 'heat-cell';

        // Random intensity
        const intensity = Math.random();
        let color;

        if (intensity < 0.6) {
            color = `rgba(0, 227, 150, ${0.2 + (Math.random() * 0.4)})`;
        } else if (intensity < 0.85) {
            color = `rgba(254, 176, 25, ${0.3 + (Math.random() * 0.5)})`;
        } else {
            color = `rgba(255, 69, 96, ${0.4 + (Math.random() * 0.6)})`;
        }

        cell.style.backgroundColor = color;

        // Tooltip
        const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(i / 24)];
        const hour = i % 24;
        cell.title = `${day} ${hour}:00 - AQI: ${Math.floor(intensity * 100)}`;

        heatmapGrid.appendChild(cell);
    }
}

// ============================================================================
// BLOG POST MANAGEMENT
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

    // Toggle form visibility
    if (addTitleBtn && blogForm) {
        addTitleBtn.addEventListener('click', () => {
            if (blogForm.style.display === 'none' || blogForm.style.display === '') {
                blogForm.style.display = 'block';
            } else {
                blogForm.style.display = 'none';
            }
        });
    }

    // Close form button
    if (closeFormBtn && blogForm) {
        closeFormBtn.addEventListener('click', () => {
            blogForm.style.display = 'none';
        });
    }

    // Clear form button
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

    // Character counters
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

    // Drag and drop for images
    if (dropZone && postImageInput) {
        dropZone.addEventListener('click', () => postImageInput.click());

        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                postImageInput.click();
            }
        });

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

    // Submit post
    if (sendBtn) {
        sendBtn.addEventListener('click', handlePostSubmit);
    }

    // Load existing posts
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
    const author = postAuthor ? postAuthor.value.trim() : '';
    const content = postDesc ? postDesc.value.trim() : '';

    if (!title || !content) {
        alert('Please provide a title and content.');
        return;
    }

    // Generate slug from title
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
        // Show loading state
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
            const err = await res.json().catch(() => ({
                detail: 'Server error'
            }));
            console.error('Error creating post:', err);
            alert('Error creating post: ' + (err.slug ? err.slug[0] : err.detail || JSON.stringify(err)));
            return;
        }

        // Success - clear all fields
        if (postTitle) postTitle.value = '';
        if (postAuthor) postAuthor.value = '';
        if (postDesc) postDesc.value = '';
        if (postImageInput) postImageInput.value = '';

        // Hide form
        if (blogForm) blogForm.style.display = 'none';

        // Refresh posts list
        await fetchPosts();
        alert('✓ Post submitted successfully!');

    } catch (err) {
        console.error('Submit error:', err);
        alert('Network error submitting post: ' + err.message);
    } finally {
        // Reset button state
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
        const grid = document.getElementById('blogGrid');
        if (grid) {
            grid.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:var(--danger);">Failed to load posts</div>';
        }
    }
}

function renderPosts(posts) {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!posts || posts.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:var(--text-secondary);">No posts yet</div>';
        return;
    }

    posts.forEach(p => {
        const card = document.createElement('a');
        card.href = `/blog/${p.slug}/`;
        card.className = 'blog-card';
        card.style.textDecoration = 'none';
        card.style.color = 'inherit';

        card.innerHTML = `
        <div class="blog-img-container">
            <img src="${p.image || '/static/img/blog-post-1.jpg'}"
                 alt="${escapeHtml(p.title)}"
                 class="blog-img">
        </div>
        <div class="blog-content">
            <h3 class="blog-title">${escapeHtml(p.title)}</h3>
            <p class="blog-excerpt">
                ${escapeHtml(p.excerpt || p.content.slice(0, 150) + '...')}
            </p>
            <div class="blog-footer">
                <div class="blog-footer-left">
                    <span class="date">
                        ${p.published_at ? new Date(p.published_at).toLocaleDateString() : 'Draft'}
                    </span>
                </div>
                
            </div>
        </div>
    `;

        grid.appendChild(card);
    });

}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const clearNotifs = document.getElementById('clearNotifs');

    if (!notificationBtn || !notificationDropdown) return;

    function closeNotifDropdown() {
        if (!notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.add('hidden');
            notificationBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function openNotifDropdown() {
        if (notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.remove('hidden');
            notificationBtn.setAttribute('aria-expanded', 'true');
        }
    }

    // Toggle dropdown
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (notificationDropdown.classList.contains('hidden')) {
            openNotifDropdown();
        } else {
            closeNotifDropdown();
        }
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (!notificationDropdown.classList.contains('hidden')) {
            if (!notificationDropdown.contains(e.target) &&
                e.target !== notificationBtn &&
                !notificationBtn.contains(e.target)) {
                closeNotifDropdown();
            }
        }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNotifDropdown();
        }
    });

    // Prevent closing when clicking inside dropdown
    notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Clear notifications
    if (clearNotifs) {
        clearNotifs.addEventListener('click', () => {
            notifications = [];
            renderNotifications();
            const notifBadge = document.getElementById('notifBadge');
            if (notifBadge) notifBadge.classList.add('hidden');
        });
    }

    // Initialize aria-expanded
    notificationBtn.setAttribute('aria-expanded',
        notificationDropdown.classList.contains('hidden') ? 'false' : 'true'
    );
}

function checkDangerLevel(data) {
    if (data.aqi > 100) {
        const msg = `Critical Warning: High AQI (${data.aqi}) detected!`;
        const exists = notifications.some(n => n.message === msg);

        if (!exists) {
            addNotification(msg, 'danger');
        }
    }
}

function addNotification(message, type) {
    notifications.unshift({
        message,
        type,
        time: new Date()
    });

    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge) notifBadge.classList.remove('hidden');

    renderNotifications();
}

function renderNotifications() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;

    notifList.innerHTML = '';

    if (notifications.length === 0) {
        notifList.innerHTML = '<div class="empty-state" style="padding:10px; color:var(--text-secondary); font-size:12px;">No new alerts</div>';
        return;
    }

    notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.type}`;
        item.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation notif-icon"></i>
            <div>
                <div style="font-weight: 600;">High AQI Alert</div>
                <div style="color: var(--text-secondary);">${n.message}</div>
                <div style="font-size: 10px; color: #666; margin-top: 4px;">Just now</div>
            </div>
        `;
        notifList.appendChild(item);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // console.log('Dashboard initializing...');

    // Initialize all modules
    initMobileSidebar();
    initTheme();
    initAnalyticsChart();
    initHeatmap();
    initBlogForm();
    initNotifications();
    initTerminalSidebar()

    // Fetch initial data
    fetchDashboardData();
    fetchSensorData();

    // Poll for updates every 30 seconds
    setInterval(fetchDashboardData, 30000);

    // console.log('Dashboard initialized successfully');
});