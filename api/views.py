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

# from .import_json_loop import sync_json_to_database

FILE_PATH = "static/sensor_data.json"   # path to your JSON file
DELAY = 60                               # 1 minute



logger = logging.getLogger(__name__)

# ============================================================================
# SIMULATION STATE (NEW)
# ============================================================================
simulation_state = {
    'running': False,
    'thread': None,
    'logs': [],
    'sensor_data': [],
    'sensor_count': 1 
}

db_sync_state = {
    "running": False,
    "thread": None,
    "last_synced_count": 0,
    "total_synced": 0,
}

LOG_PATH = os.path.join(settings.BASE_DIR, "static", "sensor_logs.json")
DATA_PATH = os.path.join(settings.BASE_DIR, "static", "sensor_data.json")



# SENSORS = [
#     {"slave_id": 1, "name": "SENSOR-001", "latitude": 13.0856, "longitude": 80.2379, "location": "Taylor's Road, Kilpauk"},
#     {"slave_id": 2, "name": "SENSOR-002", "latitude": 13.0827, "longitude": 80.2707, "location": "Egmore Station"},
#     {"slave_id": 3, "name": "SENSOR-003", "latitude": 13.0660, "longitude": 80.2550, "location": "Anna Nagar"},
# ]

SENSORS = [
    {"slave_id": 1, "name": "KP-002", "location": "Ormes Road", "latitude": 13.0818, "longitude": 80.2460},
    {"slave_id": 2, "name": "KP-003", "location": "Flowers Road", "latitude": 13.0782, "longitude": 80.2468},
    {"slave_id": 3, "name": "KP-005", "location": "Halls Road", "latitude": 13.0746, "longitude": 80.2513},
    {"slave_id": 4, "name": "EG-001", "location": "Casa Major Road", "latitude": 13.0718, "longitude": 80.2548},
    {"slave_id": 5, "name": "KP-004", "location": "Pantheon Road", "latitude": 13.0728, "longitude": 80.2574},
    {"slave_id": 6, "name": "EG-004", "location": "Ethiraj Salai", "latitude": 13.0731, "longitude": 80.2622},
    {"slave_id": 7, "name": "EG-005", "location": "College Road (Egmore)", "latitude": 13.0766, "longitude": 80.2625},
    {"slave_id": 8, "name": "KP-001", "location": "Kilpauk Garden Road", "latitude": 13.0845, "longitude": 80.2390},
    {"slave_id": 9, "name": "EG-002", "location": "Kellys Road", "latitude": 13.0882, "longitude": 80.2470},
    {"slave_id": 10, "name": "EG-003", "location": "Commander-in-Chief Road", "latitude": 13.0910, "longitude": 80.2498}
]

def sync_json_to_database():
    """
    Read the JSON array and sync only NEW records to database
    Runs in background thread every 60 seconds
    """
    print("🚀 Database sync thread started (1 min interval)")
    
    while db_sync_state['running']:
        try:
            # Wait 60 seconds before next sync
            time.sleep(DELAY)
            
            # Read the entire JSON array
            with open(FILE_PATH, "r") as f:
                all_readings = json.load(f)  # This is an ARRAY of readings
            
            # Get only NEW records we haven't synced yet
            already_synced = db_sync_state['last_synced_count']
            new_readings = all_readings[already_synced:]
            
            if not new_readings:
                print("ℹ️  No new readings to sync")
                continue
            
            print(f"🔄 Syncing {len(new_readings)} new readings to database...")
            
            synced_count = 0
            error_count = 0
            
            # Loop through each NEW reading in the array
            for reading_data in new_readings:
                try:
                    # Get or create sensor
                    sensor, created = Sensor.objects.get_or_create(
                        sensor_id=reading_data["name"],  # Use 'name' as sensor_id (e.g., "KP-002")
                        defaults={
                            "name": reading_data["name"],
                            "location": reading_data["location"],
                            "latitude": reading_data["latitude"],
                            "longitude": reading_data["longitude"],
                            "is_active": True,
                        }
                    )
                    
                    if created:
                        print(f"   ➕ Created new sensor: {reading_data['name']}")
                    
                    # Parse timestamp
                    timestamp = datetime.strptime(
                        reading_data["timestamp"], 
                        "%Y-%m-%d %H:%M:%S"
                    )
                    
                    # Create reading (use get_or_create to avoid duplicates)
                    reading, created = Reading.objects.get_or_create(
                        sensor=sensor,
                        timestamp=timestamp,
                        slave_id=reading_data["slave_id"],
                        defaults={
                            "temperature": reading_data.get("temperature"),
                            "humidity": reading_data.get("humidity"),
                            "air_quality": reading_data.get("pm25"),
                            "no_level": reading_data.get("no2"),
                            "co_level": reading_data.get("co"),
                            "aqi_category": reading_data.get("aqi_category", ""),
                            "aqi_color": reading_data.get("aqi_color", ""),
                            "latitude": reading_data.get("latitude"),
                            "longitude": reading_data.get("longitude"),
                        }
                    )
                    
                    if created:
                        synced_count += 1
                
                except Exception as e:
                    error_count += 1
                    print(f"   ❌ Error syncing reading: {e}")
            
            # Update state
            db_sync_state['last_synced_count'] = len(all_readings)
            db_sync_state['total_synced'] += synced_count
            
            print(f"✅ Sync complete: {synced_count} added, {error_count} errors (Total synced: {db_sync_state['total_synced']})")
            print(f"   At {timezone.now()}")
            
        except Exception as e:
            print(f"❌ Database sync error: {e}")
            import traceback
            traceback.print_exc()
    
    print("🛑 Database sync thread stopped")


# def sync_json_to_database():
#     """
#     Enhanced version with detailed logging to debug issues
#     """
#     write_log("Database sync thread started", "SYSTEM")
#     logger.info("DB SYNC THREAD: Started successfully")
    
#     while db_sync_state['running']:
#         try:
#             # Wait 60 seconds before next sync
#             logger.info("DB SYNC: Waiting 60 seconds...")
#             time.sleep(60)
            
#             logger.info("DB SYNC: Checking for data file...")
#             if not os.path.exists(DATA_PATH):
#                 write_log("No data file found, skipping sync", "DEBUG")
#                 logger.warning(f"DB SYNC: Data file not found at {DATA_PATH}")
#                 continue
            
#             # Read all data from JSON file
#             logger.info(f"DB SYNC: Reading data from {DATA_PATH}")
#             with open(DATA_PATH, 'r') as f:
#                 all_readings = json.load(f)
            
#             logger.info(f"DB SYNC: Found {len(all_readings)} total records in JSON")
            
#             # Get count of records we've already synced
#             already_synced = db_sync_state['last_synced_count']
#             logger.info(f"DB SYNC: Already synced {already_synced} records")
            
#             # Get only NEW records
#             new_readings = all_readings[already_synced:]
            
#             if not new_readings:
#                 write_log("No new readings to sync", "DEBUG")
#                 logger.info("DB SYNC: No new readings to sync")
#                 continue
            
#             write_log(f"Syncing {len(new_readings)} new readings to database...", "INFO")
#             logger.info(f"DB SYNC: Starting to sync {len(new_readings)} new readings")
            
#             # Sync each new reading to database
#             synced_count = 0
#             error_count = 0
            
#             for idx, reading_data in enumerate(new_readings):
#                 try:
#                     logger.debug(f"DB SYNC: Processing reading {idx+1}/{len(new_readings)}")
                    
#                     # Get or create sensor
#                     sensor_name = reading_data.get('name')
#                     slave_id = reading_data.get('slave_id')
                    
#                     logger.debug(f"DB SYNC: Looking for sensor {sensor_name} (slave_id={slave_id})")
                    
#                     sensor, created = Sensor.objects.get_or_create(
#                         sensor_id=sensor_name,
#                         defaults={
#                             'name': sensor_name,
#                             'location': reading_data.get('location', ''),
#                             'latitude': reading_data.get('latitude'),
#                             'longitude': reading_data.get('longitude'),
#                             'is_active': True
#                         }
#                     )
                    
#                     if created:
#                         write_log(f"Created new sensor in DB: {sensor_name}", "INFO")
#                         logger.info(f"DB SYNC: Created new sensor {sensor_name}")
#                     else:
#                         logger.debug(f"DB SYNC: Found existing sensor {sensor_name}")
                    
#                     # Parse timestamp
#                     timestamp_str = reading_data.get('timestamp')
#                     logger.debug(f"DB SYNC: Parsing timestamp {timestamp_str}")
                    
#                     timestamp = parse_datetime(timestamp_str)
#                     if not timestamp:
#                         try:
#                             timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
#                         except Exception as e:
#                             logger.error(f"DB SYNC: Failed to parse timestamp {timestamp_str}: {e}")
#                             raise
                    
#                     # ⚠️ IMPORTANT: Check if your Reading model has these exact field names
#                     # If not, you need to update the field names to match YOUR model
                    
#                     logger.debug(f"DB SYNC: Creating reading for {sensor_name} at {timestamp}")
                    
#                     reading, created = Reading.objects.get_or_create(
#                         sensor=sensor,
#                         timestamp=timestamp,
#                         slave_id=slave_id,
#                         defaults={
#                             'temperature': reading_data.get('temperature'),
#                             'humidity': reading_data.get('humidity'),
#                             'air_quality': reading_data.get('pm25'),  # ⚠️ Check if your model has 'air_quality' or 'pm25'
#                             'aqi_category': reading_data.get('aqi_category', ''),
#                             'aqi_color': reading_data.get('aqi_color', ''),
#                             'co_level': reading_data.get('co'),
#                             'no_level': reading_data.get('no2'),  # ⚠️ Check if your model has 'no_level' or 'no2'
#                             'smoke': 0.0,
#                             'latitude': reading_data.get('latitude'),
#                             'longitude': reading_data.get('longitude')
#                         }
#                     )
                    
#                     if created:
#                         synced_count += 1
#                         logger.debug(f"DB SYNC: Created new reading #{synced_count}")
#                     else:
#                         logger.debug(f"DB SYNC: Reading already exists (duplicate)")
                    
#                 except Exception as e:
#                     error_count += 1
#                     write_log(f"Error syncing reading: {str(e)}", "ERROR")
#                     logger.error(f"DB SYNC ERROR on reading {idx+1}: {str(e)}")
#                     logger.error(f"DB SYNC ERROR data: {reading_data}")
#                     import traceback
#                     logger.error(f"DB SYNC TRACEBACK: {traceback.format_exc()}")
            
#             # Update sync state
#             db_sync_state['last_synced_count'] = len(all_readings)
#             db_sync_state['total_synced'] += synced_count
            
#             write_log(
#                 f"Database sync complete: {synced_count} new records added, {error_count} errors (Total: {db_sync_state['total_synced']})",
#                 "SUCCESS"
#             )
#             logger.info(f"DB SYNC COMPLETE: {synced_count} added, {error_count} errors, total synced: {db_sync_state['total_synced']}")
            
#         except Exception as e:
#             write_log(f"Database sync error: {str(e)}", "ERROR")
#             logger.error(f"DB SYNC THREAD ERROR: {e}")
#             import traceback
#             logger.error(f"DB SYNC THREAD TRACEBACK: {traceback.format_exc()}")
    
#     write_log("Database sync thread stopped", "SYSTEM")
#     logger.info("DB SYNC THREAD: Stopped")


# ============================================================================
# MANUAL SYNC ENDPOINT FOR TESTING
# ============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def manual_db_sync(request):
    """
    Manually trigger database sync for testing
    Provides detailed feedback about what went wrong
    """
    try:
        logger.info("MANUAL SYNC: Starting...")
        
        if not os.path.exists(DATA_PATH):
            return JsonResponse({
                'success': False,
                'error': f'Data file not found at {DATA_PATH}'
            })
        
        # Read data
        with open(DATA_PATH, 'r') as f:
            all_readings = json.load(f)
        
        logger.info(f"MANUAL SYNC: Found {len(all_readings)} records in JSON")
        
        # Get new records
        already_synced = db_sync_state['last_synced_count']
        new_readings = all_readings[already_synced:]
        
        if not new_readings:
            return JsonResponse({
                'success': True,
                'message': 'No new readings to sync',
                'total_in_json': len(all_readings),
                'already_synced': already_synced
            })
        
        logger.info(f"MANUAL SYNC: Syncing {len(new_readings)} new records")
        
        synced_count = 0
        error_count = 0
        errors = []
        
        for idx, reading_data in enumerate(new_readings):
            try:
                sensor_name = reading_data.get('name')
                slave_id = reading_data.get('slave_id')
                
                sensor, created = Sensor.objects.get_or_create(
                    sensor_id=sensor_name,
                    defaults={
                        'name': sensor_name,
                        'location': reading_data.get('location', ''),
                        'latitude': reading_data.get('latitude'),
                        'longitude': reading_data.get('longitude'),
                        'is_active': True
                    }
                )
                
                timestamp_str = reading_data.get('timestamp')
                timestamp = parse_datetime(timestamp_str)
                if not timestamp:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                
                reading, created = Reading.objects.get_or_create(
                    sensor=sensor,
                    timestamp=timestamp,
                    slave_id=slave_id,
                    defaults={
                        'temperature': reading_data.get('temperature'),
                        'humidity': reading_data.get('humidity'),
                        'air_quality': reading_data.get('pm25'),
                        'aqi_category': reading_data.get('aqi_category', ''),
                        'aqi_color': reading_data.get('aqi_color', ''),
                        'co_level': reading_data.get('co'),
                        'no_level': reading_data.get('no2'),
                        'smoke': 0.0,
                        'latitude': reading_data.get('latitude'),
                        'longitude': reading_data.get('longitude')
                    }
                )
                
                if created:
                    synced_count += 1
                    
            except Exception as e:
                error_count += 1
                errors.append({
                    'index': idx,
                    'error': str(e),
                    'data': reading_data
                })
                logger.error(f"MANUAL SYNC ERROR on record {idx}: {e}")
        
        # Update state
        db_sync_state['last_synced_count'] = len(all_readings)
        db_sync_state['total_synced'] += synced_count
        
        return JsonResponse({
            'success': True,
            'message': 'Manual sync complete',
            'synced_count': synced_count,
            'error_count': error_count,
            'total_synced': db_sync_state['total_synced'],
            'errors': errors[:5]  # Return first 5 errors for debugging
        })
        
    except Exception as e:
        logger.error(f"MANUAL SYNC FAILED: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def start_simulation(request):
    """Start the sensor simulation AND database sync automatically"""
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
    
    # ✅ AUTO-START DATABASE SYNC
    if not db_sync_state['running']:
        db_sync_state['running'] = True
        db_sync_state['last_synced_count'] = 0
        db_sync_state['total_synced'] = 0
        db_sync_state['thread'] = threading.Thread(target=sync_json_to_database, daemon=True)
        db_sync_state['thread'].start()
        write_log("Database sync auto-started (1-minute interval)", "SYSTEM")
        print("🚀 Database sync auto-started")
    
    return JsonResponse({
        'success': True,
        'message': 'Simulation and database sync started successfully'
    })


# ============================================================================
# MODIFIED START_SIMULATION - AUTO-START DB SYNC
# ============================================================================

# @csrf_exempt
# @require_http_methods(["POST"])
# def start_simulation(request):
#     """Start the sensor simulation AND database sync automatically"""
#     if simulation_state['running']:
#         return JsonResponse({
#             'success': False,
#             'message': 'Simulation already running'
#         })
    
#     # Clear old logs
#     simulation_state['logs'] = []
    
#     # Start simulation in background thread
#     simulation_state['running'] = True
#     simulation_state['thread'] = threading.Thread(target=simulation_loop, daemon=True)
#     simulation_state['thread'].start()
    
#     # ✅ AUTO-START DATABASE SYNC
#     if not db_sync_state['running']:
#         db_sync_state['running'] = True
#         db_sync_state['last_synced_count'] = 0
#         db_sync_state['thread'] = threading.Thread(target=sync_json_to_database, daemon=True)
#         db_sync_state['thread'].start()
#         write_log("Database sync auto-started (1-minute interval)", "SYSTEM")
    
#     return JsonResponse({
#         'success': True,
#         'message': 'Simulation and database sync started successfully'
#     })


# # ============================================================================
# # MODIFIED STOP_SIMULATION - AUTO-STOP DB SYNC
# # ============================================================================

# @csrf_exempt
# @require_http_methods(["POST"])
# def stop_simulation(request):
#     """Stop the sensor simulation AND database sync"""
#     if not simulation_state['running']:
#         return JsonResponse({
#             'success': False,
#             'message': 'Simulation not running'
#         })
    
#     # Stop simulation
#     simulation_state['running'] = False
#     if simulation_state['thread']:
#         simulation_state['thread'].join(timeout=2)
    
#     # ✅ AUTO-STOP DATABASE SYNC
#     if db_sync_state['running']:
#         db_sync_state['running'] = False
#         if db_sync_state['thread']:
#             db_sync_state['thread'].join(timeout=2)
#         write_log(f"Database sync stopped (Total synced: {db_sync_state['total_synced']})", "SYSTEM")
    
#     return JsonResponse({
#         'success': True,
#         'message': 'Simulation and database sync stopped',
#         'total_synced_to_db': db_sync_state['total_synced']
#     })

@csrf_exempt
@require_http_methods(["POST"])
def stop_simulation(request):
    """Stop the sensor simulation AND database sync"""
    if not simulation_state['running']:
        return JsonResponse({
            'success': False,
            'message': 'Simulation not running'
        })
    
    # Stop simulation
    simulation_state['running'] = False
    if simulation_state['thread']:
        simulation_state['thread'].join(timeout=2)
    
    # ✅ AUTO-STOP DATABASE SYNC
    if db_sync_state['running']:
        db_sync_state['running'] = False
        if db_sync_state['thread']:
            db_sync_state['thread'].join(timeout=2)
        write_log(f"Database sync stopped (Total synced: {db_sync_state['total_synced']})", "SYSTEM")
        print(f"🛑 Database sync stopped (Total synced: {db_sync_state['total_synced']})")
    
    return JsonResponse({
        'success': True,
        'message': 'Simulation and database sync stopped',
        'total_synced_to_db': db_sync_state['total_synced']
    })

# ============================================================================
# MODIFIED RESET_SIMULATION - RESET DB SYNC STATE
# ============================================================================

@csrf_exempt
@require_http_methods(["POST"])
def reset_simulation(request):
    """Reset the simulation, clear logs, AND reset DB sync state"""
    # Stop if running
    if simulation_state['running']:
        simulation_state['running'] = False
        if simulation_state['thread']:
            simulation_state['thread'].join(timeout=2)
    
    # Stop DB sync if running
    if db_sync_state['running']:
        db_sync_state['running'] = False
        if db_sync_state['thread']:
            db_sync_state['thread'].join(timeout=2)
    
    # Clear logs and data
    simulation_state['logs'] = []
    simulation_state['sensor_data'] = []
    
    # ✅ RESET DB SYNC STATE
    db_sync_state['last_synced_count'] = 0
    db_sync_state['total_synced'] = 0
    
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
        'message': 'Simulation and database sync reset'
    })


# ============================================================================
# STATUS ENDPOINT - INCLUDES DB SYNC INFO
# ============================================================================

@require_http_methods(["GET"])
def simulation_status(request):
    """Get simulation status including database sync info"""
    with simulation_lock:
        current_count = simulation_state.get('sensor_count', 1)
    
    return JsonResponse({
        'running': simulation_state['running'],
        'log_count': len(simulation_state['logs']),
        'sensor_count': len(simulation_state['sensor_data']),
        'active_sensor_count': current_count,
        # ✅ DB SYNC STATUS
        'db_sync_running': db_sync_state['running'],
        'db_sync_total_synced': db_sync_state['total_synced'],
        'db_sync_last_count': db_sync_state['last_synced_count']
    })




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
    """Main simulation loop that runs in background thread - respects sensor_count"""
    write_log("Sensor simulation initialized", "SYSTEM")
    
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
                if content.strip():
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
            
            # ✅ GET ACTIVE SENSOR COUNT FROM STATE
            with simulation_lock:
                active_count = simulation_state.get('sensor_count', 1)
            
            write_log(f"Monitoring {active_count} sensors", "INFO")
            
            # ✅ ONLY GENERATE DATA FOR ACTIVE SENSORS
            for i in range(active_count):
                sensor = SENSORS[i]  # Use first N sensors based on count
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
            MAX_HISTORY = 1000
            if len(all_historical_data) > MAX_HISTORY:
                old_count = len(all_historical_data)
                all_historical_data = all_historical_data[-MAX_HISTORY:]
                write_log(f"Trimmed history from {old_count} to {len(all_historical_data)} readings", "INFO")
            
            # Write complete history to file
            try:
                temp_path = DATA_PATH + ".tmp"
                with open(temp_path, "w") as f:
                    json.dump(all_historical_data, f, indent=2)
                
                os.replace(temp_path, DATA_PATH)
                
                write_log(f"Saved {len(all_historical_data)} total readings to file", "DEBUG")
                
            except Exception as e:
                write_log(f"Error writing history file: {e}", "ERROR")
            
            write_log(f"Network scan #{iteration} complete - {active_count} sensors online (Total history: {len(all_historical_data)})", "SUCCESS")
            
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

# @csrf_exempt
# @require_http_methods(["POST"])
# def start_simulation(request):
#     """Start the sensor simulation"""
#     if simulation_state['running']:
#         return JsonResponse({
#             'success': False,
#             'message': 'Simulation already running'
#         })
    
#     # Clear old logs
#     simulation_state['logs'] = []
    
#     # Start simulation in background thread
#     simulation_state['running'] = True
#     simulation_state['thread'] = threading.Thread(target=simulation_loop, daemon=True)
#     simulation_state['thread'].start()
    
#     return JsonResponse({
#         'success': True,
#         'message': 'Simulation started successfully'
#     })
def start_simulation(request):
    if simulation_state["running"]:
        return JsonResponse({
            "success": False,
            "message": "Simulation already running"
        })

    simulation_state["logs"] = []
    simulation_state["running"] = True

    # --- Start simulation loop ---
    simulation_state["thread"] = threading.Thread(
        target=simulation_loop,
        daemon=True
    )
    simulation_state["thread"].start()

    # --- Auto-start DB sync ---
    if not db_sync_state["running"]:
        db_sync_state["running"] = True
        db_sync_state["thread"] = threading.Thread(
            target=sync_json_to_database,
            daemon=True
        )
        db_sync_state["thread"].start()

        write_log("Database sync auto-started (1-minute interval)", "SYSTEM")

    return JsonResponse({
        "success": True,
        "message": "Simulation and database sync started successfully"
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

@csrf_exempt
@require_http_methods(["POST"])
@csrf_exempt
@require_http_methods(["POST"])
def set_sensor_count(request):
    """Update the active sensor count for simulation"""
    body = json.loads(request.body)
    count = int(body.get("count", 1))
    
    # Clamp between 1 and 10
    count = max(1, min(10, count))

    with simulation_lock:
        simulation_state["sensor_count"] = count

    return JsonResponse({
        "success": True,
        "sensor_count": count
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

print('running')

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