# AQI Project API Usage Guide

## Overview
Complete OpenAPI 3.0 specification has been generated for the AQI Project API. The spec includes all endpoints, request/response schemas, parameters, and examples.

## OpenAPI Specification File
- **File:** `openapi.json` (root directory)
- **Format:** OpenAPI 3.0.0
- **Base URL (Development):** `http://localhost:8000/api`

## Viewing the OpenAPI Spec

### Option 1: Swagger UI (Recommended - Interactive)
Host the spec using Swagger UI:

```bash
# Using npm
npm install -g swagger-ui-dist
swagger-ui-dist -u ./openapi.json

# Or use online viewer
# Visit: https://editor.swagger.io/
# Then File > Import URL > https://your-domain/openapi.json
```

### Option 2: ReDoc (Documentation-focused)
```bash
# Using npm
npm install -g redoc-cli
redoc-cli serve openapi.json
```

### Option 3: Online Swagger Editor
1. Go to https://editor.swagger.io/
2. Click "File" → "Import File"
3. Select `openapi.json`

### Option 4: Direct File View
Open `openapi.json` in your code editor or browser for raw viewing.

## API Endpoints Summary

### Sensors
- `GET /sensors/` - List all active sensors
- `GET /sensors/{id}/` - Get single sensor
- `GET /sensors/{sensor_id}/readings/` - Get sensor readings (with stats)
- `GET /sensors/{sensor_id}/forecast/` - Get 24h AQI forecast

### Readings
- `GET /readings/` - List readings (filterable by sensor, date range)
- `POST /ingest/` - Ingest single reading
- `POST /readings/bulk_ingest/` - Bulk ingest multiple readings

### Simulation
- `POST /simulation/start/` - Start simulation
- `POST /simulation/stop/` - Stop simulation
- `POST /simulation/reset/` - Reset simulation
- `GET /simulation/status/` - Get simulation status
- `GET /simulation/data/` - Get current simulated data
- `GET /simulation/history/` - Get historical data
- `GET /simulation/logs/` - Get simulation logs
- `POST /simulation/set_sensor_count/` - Set active sensor count
- `GET /simulation/debug/` - Debug diagnostics

### Database Sync
- `POST /simulation/manual-sync/` - Manually sync JSON to database

### Blog
- `GET /blogposts/` - List published blog posts
- `POST /blogposts/` - Create new blog post
- `GET /blogposts/{id}/` - Get single blog post
- `PUT /blogposts/{id}/` - Update blog post
- `DELETE /blogposts/{id}/` - Delete blog post

## Quick Examples

### Get Sensor Readings (Last 12 hours)
```bash
curl -X GET "http://localhost:8000/api/sensors/KP-002/readings/?hours=12&limit=100"
```

### Ingest Single Reading
```bash
curl -X POST "http://localhost:8000/api/ingest/" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "KP-002",
    "sensor_name": "KP-002",
    "timestamp": "2026-02-09 12:34:56",
    "temperature": 25.1,
    "humidity": 55.2,
    "pm25": 42.3,
    "no2": 12.1,
    "co": 0.6,
    "aqi": 42,
    "aqi_category": "Moderate",
    "aqi_color": "Yellow",
    "latitude": 13.0818,
    "longitude": 80.2460
  }'
```

### Set Sensor Count
```bash
curl -X POST "http://localhost:8000/api/simulation/set_sensor_count/" \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'
```

### Get Sensor Forecast
```bash
curl -X GET "http://localhost:8000/api/sensors/KP-002/forecast/"
```

### List Blog Posts
```bash
curl -X GET "http://localhost:8000/api/blogposts/"
```

## Data Models

### Sensor
```json
{
  "id": 1,
  "sensor_id": "KP-002",
  "name": "KP-002",
  "area": "Ormes Road",
  "latitude": 13.0818,
  "longitude": 80.2460,
  "is_active": true
}
```

### Reading
```json
{
  "id": 1,
  "sensor": 1,
  "slave_id": 1,
  "timestamp": "2026-02-09T12:34:56Z",
  "temperature": 25.1,
  "humidity": 55.2,
  "air_quality": 42,
  "aqi_category": "Moderate",
  "aqi_color": "Yellow",
  "co_level": 0.6,
  "no_level": 12.1,
  "smoke": null,
  "latitude": 13.0818,
  "longitude": 80.2460
}
```

### Blog Post
```json
{
  "id": 1,
  "title": "Air Quality Update",
  "slug": "air-quality-update",
  "excerpt": "Latest air quality trends",
  "content": "<p>Article content...</p>",
  "featured_image": "http://example.com/image.jpg",
  "status": "published",
  "created_at": "2026-02-09T12:00:00Z",
  "published_at": "2026-02-09T12:00:00Z",
  "author": {
    "id": 1,
    "username": "admin"
  }
}
```

## Query Parameters

### Readings List Filters
- `sensor` - Filter by sensor ID or sensor name
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Limit results

### Sensor Readings
- `limit` - Max records (default: 100)
- `hours` - Look back hours (default: 24)

### History Query
- `sensor` - Filter by sensor name
- `limit` - Limit results

## Authentication & Permissions

### Default Setup
- **Sensors/Readings:** Read allowed for all
- **Ingestion:** Open (consider protecting in production)
- **Simulation Control:** Open (consider protecting in production)
- **Blog Posts:** 
  - Read: Public
  - Create/Update/Delete: Authenticated users (DRF `IsAuthenticatedOrReadOnly`)

### Best Practices
1. Add API token authentication for production
2. Use DRF's `TokenAuthentication` or similar
3. Add rate limiting to ingestion endpoints
4. Restrict simulation control to authenticated admin users

## Error Responses

Standard HTTP status codes:
- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request (validation errors)
- `404` Not Found
- `500` Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

## Integration with Postman

1. Open Postman
2. Click "Import" (top left)
3. Select "Link" tab
4. Paste: `file:///path/to/openapi.json`
5. Click "Continue"
6. Postman will auto-generate a collection with all endpoints

## Deployment Notes

### Static File Serving
- Ensure `DEBUG=False` in production
- Use `python manage.py collectstatic`
- Serve `openapi.json` from web root for easy access

### CORS Configuration
If API is accessed from different domain:
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://yourdomain.com",
]
```

### Rate Limiting (Optional)
```bash
pip install djangorestframework-throttling
```

Then add to viewsets:
```python
throttle_classes = [UserRateThrottle]
```

## Support

For API issues:
1. Check `openapi.json` for endpoint details
2. Review server logs
3. Use `/api/simulation/debug/` for diagnostics
4. Check database via Django admin

## Version Info
- **API Version:** 1.0.0
- **OpenAPI Version:** 3.0.0
- **Generated:** February 9, 2026
- **Django Version:** 6.0.2+
- **DRF Version:** Latest compatible

---

**Next Steps:**
1. Import `openapi.json` into Swagger UI or Postman
2. Test endpoints using the interactive interface
3. Review authentication requirements for production
4. Configure CORS if needed
5. Set up rate limiting for public APIs
