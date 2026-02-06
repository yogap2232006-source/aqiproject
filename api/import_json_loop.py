import json
import time
from datetime import datetime

from django.utils import timezone
from core.models import Sensor, Reading 


FILE_PATH = "static/sensor_data.json"   # path to your JSON file
DELAY = 60                # 1 minute

db_sync_state = {
    "running": False,
    "thread": None,
    "last_synced_count": 0,
}

def import_json_once():
    with open(FILE_PATH, "r") as f:
        data = json.load(f)

    # --- Sensor ---
    sensor, _ = Sensor.objects.get_or_create(
        slave_id=data["slave_id"],
        defaults={
            "name": data["name"],
            "location": data["location"],
            "latitude": data["latitude"],
            "longitude": data["longitude"],
        }
    )

    # --- Reading ---
    Reading.objects.create(
        slave_id=data["slave_id"],
        sensor=sensor,
        timestamp=datetime.strptime(
            data["timestamp"], "%Y-%m-%d %H:%M:%S"
        ),
        temperature=data.get("temperature"),
        humidity=data.get("humidity"),
        air_quality=data.get("pm25"),
        no_level=data.get("no2"),
        co_level=data.get("co"),
        aqi_category=data.get("aqi_category", ""),
        aqi_color=data.get("aqi_color", ""),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
    )

    print(f"✅ Imported at {timezone.now()}")


def run_loop():
    print("🚀 JSON importer started (1 min interval)")
    while True:
        try:
            import_json_once()
        except Exception as e:
            print("❌ Error:", e)

        time.sleep(DELAY)
