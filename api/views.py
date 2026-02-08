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

FILE_PATH = "static/sensor_data.json"
DELAY = 10

logger = logging.getLogger(__name__)

# ============================================================================
# SIMULATION STATE
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
    """Read the JSON array and sync only NEW records to database"""
    print("🚀 Database sync thread started (1 min interval)")
    
    while db_sync_state['running']:
        try:
            time.sleep(DELAY)
            
            with open(FILE_PATH, "r") as f:
                all_readings = json.load(f)
            
            already_synced = db_sync_state['last_synced_count']
            new_readings = all_readings[already_synced:]
            
            if not new_readings:
                print("ℹ️  No new readings to sync")
                continue
            
            print(f"🔄 Syncing {len(new_readings)} new readings to database...")
            
            synced_count = 0
            error_count = 0
            
            for reading_data in new_readings:
                try:
                    sensor, created = Sensor.objects.get_or_create(
                        sensor_id=reading_data["name"],
                        defaults={
                            "name": reading_data["name"],
                            "area": reading_data.get("location", ""),  
                            "latitude": reading_data.get("latitude"),
                            "longitude": reading_data.get("longitude"),
                            "is_active": True,
                        }
                    )
                    
                    if created:
                        print(f"   ➕ Created new sensor: {reading_data['name']}")
                    
                    timestamp = datetime.strptime(
                        reading_data["timestamp"],
                        "%Y-%m-%d %H:%M:%S"
                    )

                    if timezone.is_naive(timestamp):
                        timestamp = timezone.make_aware(timestamp)
                    
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
            
            db_sync_state['last_synced_count'] = len(all_readings)
            db_sync_state['total_synced'] += synced_count
            
            print(f"✅ Sync complete: {synced_count} added, {error_count} errors (Total synced: {db_sync_state['total_synced']})")
            print(f"   At {timezone.now()}")
            
        except Exception as e:
            print(f"❌ Database sync error: {e}")
            import traceback
            traceback.print_exc()
    
    print("🛑 Database sync thread stopped")


@csrf_exempt
@require_http_methods(["POST"])
def manual_db_sync(request):
    """Manually trigger database sync for testing"""
    try:
        logger.info("MANUAL SYNC: Starting...")
        
        if not os.path.exists(DATA_PATH):
            return JsonResponse({
                'success': False,
                'error': f'Data file not found at {DATA_PATH}'
            })
        
        with open(DATA_PATH, 'r') as f:
            all_readings = json.load(f)
        
        logger.info(f"MANUAL SYNC: Found {len(all_readings)} records in JSON")
        
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
                        'area': reading_data.get('location', ''),
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
        
        db_sync_state['last_synced_count'] = len(all_readings)
        db_sync_state['total_synced'] += synced_count
        
        return JsonResponse({
            'success': True,
            'message': 'Manual sync complete',
            'synced_count': synced_count,
            'error_count': error_count,
            'total_synced': db_sync_state['total_synced'],
            'errors': errors[:5]
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
    
    simulation_state['logs'] = []
    simulation_state['running'] = True
    simulation_state['thread'] = threading.Thread(target=simulation_loop, daemon=True)
    simulation_state['thread'].start()
    
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


@csrf_exempt
@require_http_methods(["POST"])
def stop_simulation(request):
    """Stop the sensor simulation AND database sync"""
    if not simulation_state['running']:
        return JsonResponse({
            'success': False,
            'message': 'Simulation not running'
        })
    
    simulation_state['running'] = False
    if simulation_state['thread']:
        simulation_state['thread'].join(timeout=2)
    
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


@csrf_exempt
@require_http_methods(["POST"])
def reset_simulation(request):
    """Reset the simulation, clear logs, AND reset DB sync state"""
    if simulation_state['running']:
        simulation_state['running'] = False
        if simulation_state['thread']:
            simulation_state['thread'].join(timeout=2)
    
    if db_sync_state['running']:
        db_sync_state['running'] = False
        if db_sync_state['thread']:
            db_sync_state['thread'].join(timeout=2)
    
    simulation_state['logs'] = []
    simulation_state['sensor_data'] = []
    
    db_sync_state['last_synced_count'] = 0
    db_sync_state['total_synced'] = 0
    
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
    
    simulation_state['logs'].append(log_entry)
    
    if len(simulation_state['logs']) > 200:
        simulation_state['logs'] = simulation_state['logs'][-200:]
    
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


simulation_lock = threading.Lock()


def simulation_loop():
    """Main simulation loop that runs in background thread"""
    write_log("Sensor simulation initialized", "SYSTEM")
    
    iteration = 0
    write_log(f"Data file path: {DATA_PATH}", "DEBUG")
    
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    write_log(f"Directory created/verified: {os.path.dirname(DATA_PATH)}", "DEBUG")
    
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
            
            with simulation_lock:
                active_count = simulation_state.get('sensor_count', 1)
            
            write_log(f"Monitoring {active_count} sensors", "INFO")
            
            for i in range(active_count):
                sensor = SENSORS[i]
                reading = generate_sensor_reading(sensor)
                simulated_data.append(reading)
                
                write_log(
                    f"{sensor['name']} | AQI: {reading['aqi']} ({reading['aqi_category']}) | PM2.5: {reading['pm25']} µg/m³ | Temp: {reading['temperature']}°C",
                    "DATA"
                )
            
            with simulation_lock:
                simulation_state['sensor_data'] = simulated_data
            
            all_historical_data.extend(simulated_data)
            
            MAX_HISTORY = 1000
            if len(all_historical_data) > MAX_HISTORY:
                old_count = len(all_historical_data)
                all_historical_data = all_historical_data[-MAX_HISTORY:]
                write_log(f"Trimmed history from {old_count} to {len(all_historical_data)} readings", "INFO")
            
            try:
                temp_path = DATA_PATH + ".tmp"
                with open(temp_path, "w") as f:
                    json.dump(all_historical_data, f, indent=2)
                
                os.replace(temp_path, DATA_PATH)
                
                write_log(f"Saved {len(all_historical_data)} total readings to file", "DEBUG")
                
            except Exception as e:
                write_log(f"Error writing history file: {e}", "ERROR")
            
            write_log(f"Network scan #{iteration} complete - {active_count} sensors online (Total history: {len(all_historical_data)})", "SUCCESS")
            
            time.sleep(3)
            
        except Exception as e:
            write_log(f"Simulation error: {str(e)}", "ERROR")
            import traceback
            write_log(f"Traceback: {traceback.format_exc()}", "ERROR")
            time.sleep(1)
    
    write_log(f"Simulation stopped - Final history count: {len(all_historical_data)}", "SYSTEM")


@require_http_methods(["GET"])
def get_sensor_data_simulation(request):
    """Get current sensor data from simulation"""
    history_count = 0
    try:
        if os.path.exists(DATA_PATH):
            with open(DATA_PATH, "r") as f:
                history = json.load(f)
                history_count = len(history)
    except:
        pass
    
    return JsonResponse({
        'data': simulation_state['sensor_data'],
        'running': simulation_state['running'],
        'history_count': history_count
    })


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
    
    sensor_name = request.GET.get('sensor')
    limit = request.GET.get('limit')
    
    if sensor_name:
        all_data = [r for r in all_data if r.get('name') == sensor_name]
    
    if limit:
        try:
            limit = int(limit)
            all_data = all_data[-limit:]
        except ValueError:
            pass
    
    return JsonResponse({
        'data': all_data,
        'count': len(all_data),
        'running': simulation_state['running']
    })


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
    
    if os.path.exists(DATA_PATH):
        info['data_file_size'] = os.path.getsize(DATA_PATH)
        try:
            with open(DATA_PATH, 'r') as f:
                data = json.load(f)
                info['data_record_count'] = len(data)
                info['data_readable'] = True
        except Exception as e:
            info['data_read_error'] = str(e)
    
    if os.path.exists(LOG_PATH):
        info['log_file_size'] = os.path.getsize(LOG_PATH)
        try:
            with open(LOG_PATH, 'r') as f:
                logs = json.load(f)
                info['log_record_count'] = len(logs)
                info['log_readable'] = True
        except Exception as e:
            info['log_read_error'] = str(e)
    
    try:
        test_file = os.path.join(os.path.dirname(DATA_PATH), '.write_test')
        with open(test_file, 'w') as f:
            f.write('test')
        os.remove(test_file)
        info['directory_writable'] = True
    except Exception as e:
        info['directory_write_error'] = str(e)
    
    info['memory_sensor_count'] = len(simulation_state['sensor_data'])
    info['memory_log_count'] = len(simulation_state['logs'])
    info['simulation_running'] = simulation_state['running']
    
    return JsonResponse(info)


@csrf_exempt
@require_http_methods(["POST"]) 
def set_sensor_count(request):
    """Update the active sensor count for simulation"""
    body = json.loads(request.body)
    count = int(body.get("count", 1))
    
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


# ============================================================================
# NEW ENDPOINTS FOR SENSOR-SPECIFIC DATA
# ============================================================================

@require_http_methods(["GET"])
def get_sensor_readings(request, sensor_id):
    """Get readings for a specific sensor with optional time range"""
    try:
        sensor = Sensor.objects.filter(sensor_id=sensor_id).first()
        
        if not sensor:
            return JsonResponse({
                'error': 'Sensor not found',
                'sensor_id': sensor_id
            }, status=404)
        
        limit = request.GET.get('limit', '100')
        hours = request.GET.get('hours', '24')
        
        try:
            limit = int(limit)
            hours = int(hours)
        except ValueError:
            limit = 100
            hours = 24
        
        end_time = timezone.now()
        start_time = end_time - timezone.timedelta(hours=hours)
        
        readings = Reading.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('-timestamp')[:limit]
        
        data = [{
            'timestamp': r.timestamp.isoformat(),
            'temperature': r.temperature,
            'humidity': r.humidity,
            'air_quality': r.air_quality,
            'aqi_category': r.aqi_category,
            'aqi_color': r.aqi_color,
            'co_level': r.co_level,
            'no_level': r.no_level,
            'smoke': r.smoke,
            'latitude': r.latitude,
            'longitude': r.longitude
        } for r in readings]
        
        if data:
            aqi_values = [r.air_quality for r in readings if r.air_quality]
            stats = {
                'current_aqi': readings[0].air_quality if readings else None,
                'avg_aqi': sum(aqi_values) / len(aqi_values) if aqi_values else None,
                'max_aqi': max(aqi_values) if aqi_values else None,
                'min_aqi': min(aqi_values) if aqi_values else None,
                'current_temp': readings[0].temperature if readings else None,
                'current_humidity': readings[0].humidity if readings else None,
                'current_co': readings[0].co_level if readings else None,
                'current_no': readings[0].no_level if readings else None,
                'current_smoke': readings[0].smoke if readings else None
            }
        else:
            stats = {
                'current_aqi': None,
                'avg_aqi': None,
                'max_aqi': None,
                'min_aqi': None,
                'current_temp': None,
                'current_humidity': None,
                'current_co': None,
                'current_no': None,
                'current_smoke': None
            }
        
        return JsonResponse({
            'sensor_id': sensor_id,
            'sensor_name': sensor.name,
            'readings': data,
            'stats': stats,
            'count': len(data)
        })
        
    except Exception as e:
        logger.error(f"Error fetching sensor readings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_sensor_forecast(request, sensor_id):
    """Generate AQI forecast for a specific sensor based on historical data"""
    try:
        sensor = Sensor.objects.filter(sensor_id=sensor_id).first()
        
        if not sensor:
            return JsonResponse({
                'error': 'Sensor not found',
                'sensor_id': sensor_id
            }, status=404)
        
        end_time = timezone.now()
        start_time = end_time - timezone.timedelta(hours=48)
        
        readings = Reading.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time,
            timestamp__lte=end_time
        ).order_by('timestamp')
        
        if not readings:
            return JsonResponse({
                'error': 'No historical data available for forecasting',
                'sensor_id': sensor_id
            }, status=404)
        
        historical_aqi = [r.air_quality for r in readings if r.air_quality is not None]
        
        if len(historical_aqi) < 5:
            return JsonResponse({
                'error': 'Insufficient historical data for forecasting',
                'sensor_id': sensor_id
            }, status=400)
        
        forecast_hours = 24
        forecast = []
        
        recent_avg = sum(historical_aqi[-10:]) / len(historical_aqi[-10:])
        older_avg = sum(historical_aqi[:10]) / min(10, len(historical_aqi[:10]))
        trend = (recent_avg - older_avg) / len(historical_aqi)
        
        last_value = historical_aqi[-1]
        
        for i in range(forecast_hours):
            predicted_value = last_value + (trend * (i + 1))
            
            current_hour = (timezone.now().hour + i) % 24
            if 7 <= current_hour <= 9 or 17 <= current_hour <= 19:
                predicted_value *= 1.15
            
            predicted_value = max(10, min(200, predicted_value))
            
            forecast_time = end_time + timezone.timedelta(hours=i+1)
            
            forecast.append({
                'timestamp': forecast_time.isoformat(),
                'hour': forecast_time.strftime('%H:%M'),
                'predicted_aqi': round(predicted_value, 1),
                'confidence': max(0.5, 1.0 - (i * 0.02))
            })
        
        return JsonResponse({
            'sensor_id': sensor_id,
            'sensor_name': sensor.name,
            'current_aqi': historical_aqi[-1],
            'forecast': forecast,
            'trend': 'increasing' if trend > 0 else 'decreasing' if trend < 0 else 'stable'
        })
        
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': str(e)
        }, status=500)


# ============================================================================
# EXISTING CODE (PRESERVED)
# ============================================================================

def sensor_logs(request):
    """Legacy endpoint - now reads from simulation state"""
    try:
        with open(LOG_PATH) as f:
            logs = json.load(f)
    except:
        logs = simulation_state['logs']

    return JsonResponse(logs, safe=False)


class SensorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Sensor.objects.filter(is_active=True)
    serializer_class = SensorSerializer


class ReadingViewSet(viewsets.ModelViewSet):
    queryset = Reading.objects.all().order_by('-timestamp')
    serializer_class = ReadingSerializer
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        sensor_q = self.request.query_params.get('sensor')
        from_q = self.request.query_params.get('from')
        to_q = self.request.query_params.get('to')
        limit_q = self.request.query_params.get('limit')

        if sensor_q:
            qs = qs.filter(
                models.Q(sensor__sensor_id=sensor_q) | 
                models.Q(sensor__id=sensor_q) | 
                models.Q(slave_id=sensor_q)
            )

        if from_q:
            dt = parse_datetime(from_q)
            if dt:
                qs = qs.filter(timestamp__gte=dt)
        if to_q:
            dt = parse_datetime(to_q)
            if dt:
                qs = qs.filter(timestamp__lte=dt)

        if limit_q:
            try:
                n = int(limit_q)
                qs = qs[:n]
            except ValueError:
                logger.warning(f"Invalid limit parameter: {limit_q}")

        return qs


class BlogPostViewSet(viewsets.ModelViewSet):
    queryset = BlogPost.objects.filter(status='published').order_by('-published_at', '-created_at')
    serializer_class = BlogPostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    authentication_classes = []

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        author = self.request.user if self.request.user and self.request.user.is_authenticated else None
        if serializer.validated_data.get('status') == 'published' and not serializer.validated_data.get('published_at'):
            serializer.save(author=author, published_at=timezone.now())
        else:
            serializer.save(author=author)


@api_view(['POST'])
def ingest_reading(request):
    payload = request.data.copy()
    
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
            logger.info(f"Created new sensor: {sensor_id}")
        
        payload['sensor'] = sensor.id
    
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
    readings_data = request.data if isinstance(request.data, list) else [request.data]
    
    created_readings = []
    errors = []
    
    for idx, reading_data in enumerate(readings_data):
        try:
            payload = reading_data.copy()
            
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


print('running')