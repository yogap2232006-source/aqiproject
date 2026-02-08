from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SensorViewSet, 
    ReadingViewSet, 
    BlogPostViewSet, 
    ingest_reading,
    bulk_ingest_readings,
    sensor_logs,
    start_simulation,
    stop_simulation,
    reset_simulation,
    simulation_status,
    get_logs,
    get_sensor_data_simulation,
    debug_simulation_files,
    get_sensor_history,
    set_sensor_count,
    manual_db_sync,
    get_sensor_readings,      # NEW
    get_sensor_forecast,      # NEW
)


# Create router for viewsets
router = DefaultRouter()
router.register('sensors', SensorViewSet, basename='sensor')
router.register('readings', ReadingViewSet, basename='reading')
router.register('posts', BlogPostViewSet, basename='post')

# Combine router URLs with custom endpoints
urlpatterns = router.urls + [
    path('readings/ingest/', ingest_reading, name='ingest-reading'),
    path('readings/bulk-ingest/', bulk_ingest_readings, name='bulk-ingest-reading'),
    path("sensor-logs/", sensor_logs, name='sensor_logs'),
    
    # Simulation control endpoints
    path('simulation/start/', start_simulation, name='start_simulation'),
    path('simulation/stop/', stop_simulation, name='stop_simulation'),
    path('simulation/reset/', reset_simulation, name='reset_simulation'),
    path('simulation_status/', simulation_status, name='simulation_status'),
    
    # Data endpoints
    path('logs/', get_logs, name='get_logs'),
    path('sensor-data/', get_sensor_data_simulation, name='get_sensor_data_simulation'),
    path('simulation/debug/', debug_simulation_files, name='debug-simulation'),
    path('simulation/history/', get_sensor_history, name='sensor-history'),
    path('set_sensor_count/', set_sensor_count), 
    path('manual-db-sync/', manual_db_sync, name='manual_db_sync'),
    
    # ============================================================================
    # NEW SENSOR-SPECIFIC ENDPOINTS
    # ============================================================================
    
    # Get readings for a specific sensor with time range filtering
    path('sensors/<str:sensor_id>/readings/', 
         get_sensor_readings, 
         name='sensor_readings'),
    
    # Get AQI forecast for a specific sensor based on historical data
    path('sensors/<str:sensor_id>/forecast/', 
         get_sensor_forecast, 
         name='sensor_forecast'),
]


# ============================================================================
# API ENDPOINT USAGE EXAMPLES
# ============================================================================
# 
# Get last 24 hours of data for sensor KP-002:
# GET /api/sensors/KP-002/readings/?hours=24&limit=100
#
# Get forecast for sensor KP-002:
# GET /api/sensors/KP-002/forecast/
#
# Get last 100 readings for sensor EG-001:
# GET /api/sensors/EG-001/readings/?limit=100
#
# Get last 48 hours for sensor KP-003:
# GET /api/sensors/KP-003/readings/?hours=48
#
# Get only last reading for sensor KP-001:
# GET /api/sensors/KP-001/readings/?limit=1
# ============================================================================