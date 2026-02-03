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

]