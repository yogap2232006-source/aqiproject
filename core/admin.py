from django.contrib import admin

from django.contrib import admin
from .models import Sensor, Reading


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    # list_display = ('sensor_id', 'name', 'area', 'is_active', 'created_at')
    list_display = ('sensor_id', 'name', 'area', 'is_active')
    search_fields = ('sensor_id', 'name', 'area')
    list_filter = ('is_active',)


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = ('slave_id', 'sensor', 'timestamp', 'temperature', 'humidity', 'air_quality', 'aqi_category', 'co_level', 'no_level', 'smoke')
    list_filter = ('timestamp', 'sensor')
    search_fields = ('slave_id', 'sensor__sensor_id', 'sensor__name')


from .models import BlogPost

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'status', 'published_at')
    list_filter = ('status', 'published_at')
    search_fields = ('title', 'excerpt', 'content')
    prepopulated_fields = {'slug': ('title',)}
    # readonly_fields = ('created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')


