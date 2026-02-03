from rest_framework import serializers
from core.models import Sensor, Reading, BlogPost


class SensorNestedSerializer(serializers.ModelSerializer):
    """Lightweight sensor serializer for nested representation."""
    
    class Meta:
        model = Sensor
        fields = ('id', 'sensor_id', 'name', 'latitude', 'longitude')


class ReadingSerializer(serializers.ModelSerializer):
    aqi = serializers.SerializerMethodField(read_only=True)
    sensor_detail = SensorNestedSerializer(source='sensor', read_only=True)

    class Meta:
        model = Reading
        fields = '__all__'
        read_only_fields = ('aqi', 'sensor_detail', 'timestamp')

    def get_aqi(self, obj):
        return obj.air_quality

    def validate(self, data):
        """
        Validate reading data.
        Ensure required fields are present and values are reasonable.
        """
        # Validate temperature range (-50 to 60 Celsius)
        if 'temperature' in data:
            if not -50 <= data['temperature'] <= 60:
                raise serializers.ValidationError({
                    'temperature': 'Temperature must be between -50 and 60 degrees Celsius'
                })
        
        # Validate humidity range (0 to 100%)
        if 'humidity' in data:
            if not 0 <= data['humidity'] <= 100:
                raise serializers.ValidationError({
                    'humidity': 'Humidity must be between 0 and 100%'
                })
        
        # Validate air quality (0 to 500 AQI scale)
        if 'air_quality' in data:
            if not 0 <= data['air_quality'] <= 500:
                raise serializers.ValidationError({
                    'air_quality': 'Air quality must be between 0 and 500'
                })
        
        return data


class SensorSerializer(serializers.ModelSerializer):
    """
    Serializer for Sensor model.
    Includes the latest reading for each sensor.
    """
    latest = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = (
            'id',
            'sensor_id',
            'name',
            'area',
            'latitude',
            'longitude',
            'is_active',
            'latest'
        )

    def get_latest(self, obj):
        reading = obj.readings.first()
        return ReadingSerializer(reading).data if reading else None



class BlogPostSerializer(serializers.ModelSerializer):
    """Serializer for BlogPost model."""
    author_name = serializers.SerializerMethodField(read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = BlogPost
        fields = (
            'id', 'title', 'slug', 'author', 'author_name', 
            'content', 'excerpt', 'image', 'status', 
            'published_at', 'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at', 'author_name')
    
    def get_author_name(self, obj):
        """Return author username or 'Anonymous' if no author."""
        if obj.author:
            return str(obj.author.username)
        return 'Anonymous'


class ReadingIngestSerializer(serializers.Serializer):
    """
    Simplified serializer for ingesting readings from external sources.
    This can be used for validation before converting to ReadingSerializer.
    """
    sensor_id = serializers.CharField(max_length=50, required=False)
    timestamp = serializers.DateTimeField()
    slave_id = serializers.IntegerField()

    temperature = serializers.FloatField()
    humidity = serializers.FloatField()
    air_quality = serializers.FloatField()

    aqi_category = serializers.CharField(max_length=50)
    aqi_color = serializers.CharField(max_length=20)

    co_level = serializers.FloatField()
    no_level = serializers.FloatField()
    smoke = serializers.FloatField()

    latitude = serializers.FloatField()
    longitude = serializers.FloatField()