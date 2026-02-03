from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import viewsets, status
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from django.db import models
from core.models import Sensor, Reading, BlogPost
from .serializers import SensorSerializer, ReadingSerializer, BlogPostSerializer
from rest_framework import permissions
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json, os
from django.conf import settings
import random
import threading
import time
from datetime import datetime

logger = logging.getLogger(__name__)

# ============================================================================
# SIMULATION STATE (NEW)
# ============================================================================
simulation_state = {
    'running': False,
    'thread': None,
    'logs': [],
    'sensor_data': []
}

LOG_PATH = os.path.join(settings.BASE_DIR, "static", "sensor_logs.json")
DATA_PATH = os.path.join(settings.BASE_DIR, "static", "sensor_data.json")

SENSORS = [
    {"slave_id": 1, "name": "SENSOR-001", "latitude": 13.0856, "longitude": 80.2379, "location": "Taylor's Road, Kilpauk"},
    {"slave_id": 2, "name": "SENSOR-002", "latitude": 13.0827, "longitude": 80.2707, "location": "Egmore Station"},
    {"slave_id": 3, "name": "SENSOR-003", "latitude": 13.0660, "longitude": 80.2550, "location": "Anna Nagar"},
]


def write_log(message, level="INFO"):
    """Write log entry to both memory and file"""
    log_entry = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "message": message
    }
    
    # Add to memory
    simulation_state['logs'].append(log_entry)
    
    # Keep only last 200 logs in memory
    if len(simulation_state['logs']) > 200:
        simulation_state['logs'] = simulation_state['logs'][-200:]
    
    # Write to file
    try:
        with open(LOG_PATH, "w") as f:
            json.dump(simulation_state['logs'], f, indent=2)
    except Exception as e:
        logger.error(f"Error writing logs: {e}")


def generate_sensor_reading(sensor):
    """Generate simulated sensor reading"""
    temperature = round(random.uniform(20, 35), 1)
    humidity = round(random.uniform(40, 80), 1)
    pm25 = round(random.uniform(10, 150), 1)
    no2 = round(random.uniform(5, 50), 1)
    co = round(random.uniform(0.1, 2.0), 2)
    
    # Calculate AQI based on PM2.5
    if pm25 <= 50:
        aqi = pm25
        aqi_category = "Excellent"
        aqi_color = "Green"
    elif pm25 <= 100:
        aqi = 50 + (pm25 - 50)
        aqi_category = "Moderate"
        aqi_color = "Yellow"
    else:
        aqi = 100 + (pm25 - 100) * 2
        aqi_category = "Unhealthy"
        aqi_color = "Red"
    
    aqi = int(min(aqi, 500))
    
    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "slave_id": sensor["slave_id"],
        "name": sensor["name"],
        "location": sensor["location"],
        "temperature": temperature,
        "humidity": humidity,
        "pm25": pm25,
        "no2": no2,
        "co": co,
        "aqi": aqi,
        "aqi_category": aqi_category,
        "aqi_color": aqi_color,
        "latitude": sensor["latitude"],
        "longitude": sensor["longitude"]
    }

# Add a lock for thread safety
simulation_lock = threading.Lock()

def simulation_loop():
    """Main simulation loop that runs in background thread - FIXED VERSION"""
    write_log("Sensor simulation initialized", "SYSTEM")
    write_log(f"Monitoring {len(SENSORS)} sensors", "INFO")
    
    iteration = 0
    
    # DEBUG: Check if file path exists
    write_log(f"Data file path: {DATA_PATH}", "DEBUG")
    
    # Ensure the directory exists
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    write_log(f"Directory created/verified: {os.path.dirname(DATA_PATH)}", "DEBUG")
    
    # Load existing data at start
    all_historical_data = []
    try:
        if os.path.exists(DATA_PATH):
            with open(DATA_PATH, "r") as f:
                content = f.read()
                if content.strip():  # Check if file is not empty
                    all_historical_data = json.loads(content)
                    write_log(f"Loaded {len(all_historical_data)} existing readings", "INFO")
                else:
                    write_log("Data file exists but is empty, starting fresh", "INFO")
        else:
            write_log("No existing data file, starting fresh", "INFO")
    except json.JSONDecodeError as e:
        write_log(f"Error reading existing data (invalid JSON): {e}. Starting fresh.", "ERROR")
        all_historical_data = []
    except Exception as e:
        write_log(f"Error loading existing data: {e}. Starting fresh.", "ERROR")
        all_historical_data = []
    
    while simulation_state['running']:
        try:
            iteration += 1
            simulated_data = []
            
            # Generate readings for all sensors
            for sensor in SENSORS:
                reading = generate_sensor_reading(sensor)
                simulated_data.append(reading)
                
                write_log(
                    f"{sensor['name']} | AQI: {reading['aqi']} ({reading['aqi_category']}) | PM2.5: {reading['pm25']} µg/m³ | Temp: {reading['temperature']}°C",
                    "DATA"
                )
            
            # Thread-safe update of current sensor data
            with simulation_lock:
                simulation_state['sensor_data'] = simulated_data
            
            # Append new readings to historical data
            all_historical_data.extend(simulated_data)
            
            # Limit history to prevent file from growing too large
            # Keep last 1000 readings (adjust as needed)
            MAX_HISTORY = 1000
            if len(all_historical_data) > MAX_HISTORY:
                old_count = len(all_historical_data)
                all_historical_data = all_historical_data[-MAX_HISTORY:]
                write_log(f"Trimmed history from {old_count} to {len(all_historical_data)} readings", "INFO")
            
            # Write complete history to file
            try:
                # Write to temporary file first, then rename (atomic operation)
                temp_path = DATA_PATH + ".tmp"
                with open(temp_path, "w") as f:
                    json.dump(all_historical_data, f, indent=2)
                
                # Rename temp file to actual file (atomic on most systems)
                os.replace(temp_path, DATA_PATH)
                
                write_log(f"Saved {len(all_historical_data)} total readings to file", "DEBUG")
                
            except Exception as e:
                write_log(f"Error writing history file: {e}", "ERROR")
            
            write_log(f"Network scan #{iteration} complete - All sensors online (Total history: {len(all_historical_data)})", "SUCCESS")
            
            # Wait 3 seconds before next reading
            time.sleep(3)
            
        except Exception as e:
            write_log(f"Simulation error: {str(e)}", "ERROR")
            import traceback
            write_log(f"Traceback: {traceback.format_exc()}", "ERROR")
            time.sleep(1)
    
    write_log(f"Simulation stopped - Final history count: {len(all_historical_data)}", "SYSTEM")


# UPDATED get_sensor_data_simulation endpoint to show history count
@require_http_methods(["GET"])
def get_sensor_data_simulation(request):
    """Get current sensor data from simulation"""
    
    # Also read the full history file to show count
    history_count = 0
    try:
        if os.path.exists(DATA_PATH):
            with open(DATA_PATH, "r") as f:
                history = json.load(f)
                history_count = len(history)
    except:
        pass
    
    return JsonResponse({
        'data': simulation_state['sensor_data'],  # Current readings (latest 3)
        'running': simulation_state['running'],
        'history_count': history_count  # Total historical readings
    })


# NEW ENDPOINT: Get all historical data
@require_http_methods(["GET"])
def get_sensor_history(request):
    """Get all historical sensor data with optional filtering"""
    
    try:
        with open(DATA_PATH, "r") as f:
            all_data = json.load(f)
    except Exception as e:
        return JsonResponse({
            'error': f'Could not read history: {str(e)}',
            'data': []
        }, status=500)
    
    # Optional filters
    sensor_name = request.GET.get('sensor')  # e.g., ?sensor=SENSOR-001
    limit = request.GET.get('limit')  # e.g., ?limit=50
    
    # Filter by sensor if requested
    if sensor_name:
        all_data = [r for r in all_data if r.get('name') == sensor_name]
    
    # Limit results if requested
    if limit:
        try:
            limit = int(limit)
            all_data = all_data[-limit:]  # Get last N readings
        except ValueError:
            pass
    
    return JsonResponse({
        'data': all_data,
        'count': len(all_data),
        'running': simulation_state['running']
    })


# DEBUGGING ENDPOINT: Check file status
@require_http_methods(["GET"])
def debug_simulation_files(request):
    """Debug endpoint to check file status"""
    
    info = {
        'data_path': DATA_PATH,
        'log_path': LOG_PATH,
        'data_file_exists': os.path.exists(DATA_PATH),
        'log_file_exists': os.path.exists(LOG_PATH),
        'data_file_size': 0,
        'log_file_size': 0,
        'data_readable': False,
        'log_readable': False,
        'data_record_count': 0,
        'log_record_count': 0,
        'directory_writable': False
    }
    
    # Check data file
    if os.path.exists(DATA_PATH):
        info['data_file_size'] = os.path.getsize(DATA_PATH)
        try:
            with open(DATA_PATH, 'r') as f:
                data = json.load(f)
                info['data_record_count'] = len(data)
                info['data_readable'] = True
        except Exception as e:
            info['data_read_error'] = str(e)
    
    # Check log file
    if os.path.exists(LOG_PATH):
        info['log_file_size'] = os.path.getsize(LOG_PATH)
        try:
            with open(LOG_PATH, 'r') as f:
                logs = json.load(f)
                info['log_record_count'] = len(logs)
                info['log_readable'] = True
        except Exception as e:
            info['log_read_error'] = str(e)
    
    # Check if directory is writable
    try:
        test_file = os.path.join(os.path.dirname(DATA_PATH), '.write_test')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        info['directory_writable'] = True
    except Exception as e:
        info['directory_write_error'] = str(e)
    
    # Memory state
    info['memory_sensor_count'] = len(simulation_state['sensor_data'])
    info['memory_log_count'] = len(simulation_state['logs'])
    info['simulation_running'] = simulation_state['running']
    
    return JsonResponse(info)


# ============================================================================
# SIMULATION API ENDPOINTS (NEW)
# ============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def start_simulation(request):
    """Start the sensor simulation"""
    if simulation_state['running']:
        return JsonResponse({
            'success': False,
            'message': 'Simulation already running'
        })
    
    # Clear old logs
    simulation_state['logs'] = []
    
    # Start simulation in background thread
    simulation_state['running'] = True
    simulation_state['thread'] = threading.Thread(target=simulation_loop, daemon=True)
    simulation_state['thread'].start()
    
    return JsonResponse({
        'success': True,
        'message': 'Simulation started successfully'
    })


@csrf_exempt
@require_http_methods(["POST"])
def stop_simulation(request):
    """Stop the sensor simulation"""
    if not simulation_state['running']:
        return JsonResponse({
            'success': False,
            'message': 'Simulation not running'
        })
    
    simulation_state['running'] = False
    
    # Wait for thread to finish (max 2 seconds)
    if simulation_state['thread']:
        simulation_state['thread'].join(timeout=2)
    
    return JsonResponse({
        'success': True,
        'message': 'Simulation stopped'
    })


@csrf_exempt
@require_http_methods(["POST"])
def reset_simulation(request):
    """Reset the simulation and clear logs"""
    # Stop if running
    if simulation_state['running']:
        simulation_state['running'] = False
        if simulation_state['thread']:
            simulation_state['thread'].join(timeout=2)
    
    # Clear logs and data
    simulation_state['logs'] = []
    simulation_state['sensor_data'] = []
    
    # Clear files
    try:
        with open(LOG_PATH, "w") as f:
            json.dump([], f)
        with open(DATA_PATH, "w") as f:
            json.dump([], f)
    except:
        pass
    
    return JsonResponse({
        'success': True,
        'message': 'Simulation reset'
    })


@require_http_methods(["GET"])
def get_logs(request):
    """Get current logs"""
    return JsonResponse({
        'logs': simulation_state['logs'],
        'running': simulation_state['running']
    })


@require_http_methods(["GET"])
def get_sensor_data_simulation(request):
    """Get current sensor data from simulation"""
    return JsonResponse({
        'data': simulation_state['sensor_data'],
        'running': simulation_state['running']
    })


@require_http_methods(["GET"])
def simulation_status(request):
    """Get simulation status"""
    return JsonResponse({
        'running': simulation_state['running'],
        'log_count': len(simulation_state['logs']),
        'sensor_count': len(simulation_state['sensor_data'])
    })


# ============================================================================
# EXISTING CODE (PRESERVED)
# ============================================================================

def sensor_logs(request):
    """Legacy endpoint - now reads from simulation state"""
    try:
        with open(LOG_PATH) as f:
            logs = json.load(f)
    except:
        logs = simulation_state['logs']  # Fallback to memory if file doesn't exist

    return JsonResponse(logs, safe=False)


class SensorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing sensor information.
    Read-only access to active sensors.
    
    Endpoints:
    - GET /api/sensors/ - List all active sensors
    - GET /api/sensors/{id}/ - Retrieve a specific sensor
    """
    queryset = Sensor.objects.filter(is_active=True)
    serializer_class = SensorSerializer


class ReadingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sensor readings.
    
    Supports filtering by:
    - sensor: sensor_id or pk (e.g., ?sensor=1 or ?sensor=SENSOR_001)
    - from: ISO datetime or date string (inclusive) (e.g., ?from=2024-01-01)
    - to: ISO datetime or date string (inclusive) (e.g., ?to=2024-12-31)
    - limit: integer to get latest N records (e.g., ?limit=100)
    
    Endpoints:
    - GET /api/readings/ - List all readings (with optional filters)
    - POST /api/readings/ - Create a new reading
    - GET /api/readings/{id}/ - Retrieve a specific reading
    - PUT /api/readings/{id}/ - Update a reading
    - DELETE /api/readings/{id}/ - Delete a reading
    """
    queryset = Reading.objects.all().order_by('-timestamp')
    serializer_class = ReadingSerializer
    pagination_class = None  # Return array (frontend expects an array)

    def get_queryset(self):
        qs = super().get_queryset()
        sensor_q = self.request.query_params.get('sensor')
        from_q = self.request.query_params.get('from')
        to_q = self.request.query_params.get('to')
        limit_q = self.request.query_params.get('limit')

        # Filter by sensor (supports sensor_id, pk, or slave_id)
        if sensor_q:
            qs = qs.filter(
                models.Q(sensor__sensor_id=sensor_q) | 
                models.Q(sensor__id=sensor_q) | 
                models.Q(slave_id=sensor_q)
            )

        # Filter by date range
        if from_q:
            dt = parse_datetime(from_q)
            if dt:
                qs = qs.filter(timestamp__gte=dt)
        if to_q:
            dt = parse_datetime(to_q)
            if dt:
                qs = qs.filter(timestamp__lte=dt)

        # Limit results
        if limit_q:
            try:
                n = int(limit_q)
                qs = qs[:n]
            except ValueError:
                logger.warning(f"Invalid limit parameter: {limit_q}")

        return qs


class BlogPostViewSet(viewsets.ModelViewSet):
    """
    ViewSet for blog posts.
    
    Listing of published posts is public.
    Creation is allowed anonymously.
    Updates and deletes require authentication.
    
    Endpoints:
    - GET /api/posts/ - List all published posts
    - POST /api/posts/ - Create a new post (anonymous allowed)
    - GET /api/posts/{id}/ - Retrieve a specific post
    - PUT /api/posts/{id}/ - Update a post (auth required)
    - DELETE /api/posts/{id}/ - Delete a post (auth required)
    """
    queryset = BlogPost.objects.filter(status='published').order_by('-published_at', '-created_at')
    serializer_class = BlogPostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    authentication_classes = []  # Allow anonymous submissions

    def get_permissions(self):
        # Allow anonymous POST (create)
        if self.action == 'create':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Set author and published_at when publishing
        author = self.request.user if self.request.user and self.request.user.is_authenticated else None
        if serializer.validated_data.get('status') == 'published' and not serializer.validated_data.get('published_at'):
            serializer.save(author=author, published_at=timezone.now())
        else:
            serializer.save(author=author)


@api_view(['POST'])
def ingest_reading(request):
    """
    Ingest sensor reading data from JSON payload.
    
    This endpoint accepts JSON data and automatically creates or links sensors.
    
    Expected JSON format:
    {
        "sensor_id": "SENSOR_001",  # Optional: will create/link sensor
        "slave_id": 1,
        "timestamp": "2024-01-31T12:00:00Z",
        "temperature": 25.5,
        "humidity": 60.0,
        "air_quality": 85.0,
        "aqi_category": "Good",
        "aqi_color": "green",
        "co_level": 2.5,
        "no_level": 1.8,
        "smoke": 10.5,
        "latitude": 13.0827,
        "longitude": 80.2707
    }
    
    Usage:
    POST /api/readings/ingest/
    Content-Type: application/json
    
    Returns: Created reading object with 201 status
    """
    payload = request.data.copy()
    
    # Extract sensor_id from payload
    sensor_id = payload.pop('sensor_id', None) or payload.get('sensor')
    
    if sensor_id:
        # Try to find existing sensor
        sensor = Sensor.objects.filter(sensor_id=str(sensor_id)).first()
        
        if not sensor:
            # Create new sensor record
            sensor_name = payload.pop('sensor_name', str(sensor_id))
            sensor = Sensor.objects.create(
                sensor_id=str(sensor_id),
                name=sensor_name,
                is_active=True
            )
            logger.info(f"Created new sensor: {sensor_id}")
        
        # Link sensor to reading
        payload['sensor'] = sensor.id
    
    # Validate and save reading
    serializer = ReadingSerializer(data=payload)
    
    if serializer.is_valid():
        reading = serializer.save()
        logger.info(f"Ingested reading for slave_id={reading.slave_id} at {reading.timestamp}")
        return Response(
            ReadingSerializer(reading).data,
            status=status.HTTP_201_CREATED
        )
    else:
        logger.error(f"Reading validation failed: {serializer.errors}")
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
def bulk_ingest_readings(request):
    """
    Bulk ingest multiple sensor readings from JSON array.
    
    Expected JSON format:
    [
        {
            "sensor_id": "SENSOR_001",
            "slave_id": 1,
            "timestamp": "2024-01-31T12:00:00Z",
            ...
        },
        {
            "sensor_id": "SENSOR_002",
            "slave_id": 2,
            "timestamp": "2024-01-31T12:00:00Z",
            ...
        }
    ]
    
    Usage:
    POST /api/readings/bulk-ingest/
    Content-Type: application/json
    
    Returns: Summary of created readings
    """
    readings_data = request.data if isinstance(request.data, list) else [request.data]
    
    created_readings = []
    errors = []
    
    for idx, reading_data in enumerate(readings_data):
        try:
            payload = reading_data.copy()
            
            # Handle sensor creation/linking
            sensor_id = payload.pop('sensor_id', None) or payload.get('sensor')
            
            if sensor_id:
                sensor = Sensor.objects.filter(sensor_id=str(sensor_id)).first()
                if not sensor:
                    sensor_name = payload.pop('sensor_name', str(sensor_id))
                    sensor = Sensor.objects.create(
                        sensor_id=str(sensor_id),
                        name=sensor_name,
                        is_active=True
                    )
                payload['sensor'] = sensor.id
            
            # Validate and save
            serializer = ReadingSerializer(data=payload)
            if serializer.is_valid():
                reading = serializer.save()
                created_readings.append(reading.id)
            else:
                errors.append({
                    'index': idx,
                    'data': reading_data,
                    'errors': serializer.errors
                })
        
        except Exception as e:
            errors.append({
                'index': idx,
                'data': reading_data,
                'error': str(e)
            })
    
    response_data = {
        'created_count': len(created_readings),
        'error_count': len(errors),
        'created_ids': created_readings,
        'errors': errors
    }
    
    status_code = status.HTTP_201_CREATED if created_readings else status.HTTP_400_BAD_REQUEST
    
    return Response(response_data, status=status_code)


