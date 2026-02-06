from django.db import models
from django.utils import timezone


class Sensor(models.Model):
    sensor_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150, blank=True)
    area = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name or self.sensor_id
    
# class Sensor(models.Model):
#     slave_id = models.IntegerField(unique=True)
#     name = models.CharField(max_length=50)
#     location = models.CharField(max_length=100)  # ✅ ADD THIS
#     latitude = models.FloatField()
#     longitude = models.FloatField()

#     def __str__(self):
#         return f"{self.name} ({self.location})"


class Reading(models.Model):
    # raw slave id from device
    slave_id = models.IntegerField(null=True, blank=True)

    # optional FK mapping
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.SET_NULL,
        related_name="readings",
        null=True,
        blank=True
    )

    timestamp = models.DateTimeField(default=timezone.now)

    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    air_quality = models.FloatField(null=True, blank=True)

    aqi_category = models.CharField(max_length=50, blank=True)
    aqi_color = models.CharField(max_length=20, blank=True)

    co_level = models.FloatField(null=True, blank=True)
    no_level = models.FloatField(null=True, blank=True)
    smoke = models.FloatField(null=True, blank=True)

    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"slave:{self.slave_id or 'unk'} @ {self.timestamp:%Y-%m-%d %H:%M}"


class BlogPost(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("published", "Published"),
    )

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    author = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="posts"
    )
    content = models.TextField()
    excerpt = models.TextField(blank=True)
    image = models.ImageField(upload_to="img/", null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    published_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.status == "published" and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
