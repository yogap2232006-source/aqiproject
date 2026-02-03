from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("analytics/", views.analytics, name="analytics"),
    path("blog/", views.blog, name="blog"),
    path("settings/", views.settings, name="settings"),
    path("blog/<slug:slug>/", views.blog_detail, name="blog_detail"),
]
