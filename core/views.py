from django.shortcuts import render, get_object_or_404
from core.models import BlogPost
def analytics(request):
    return render(request,"analytics.html")

# Blog list page
def blog(request):
    posts = BlogPost.objects.filter(status="published")
    return render(request, "blog.html", {"posts": posts})


# Blog detail page
def blog_detail(request, slug):
    post = get_object_or_404(
        BlogPost,
        slug=slug,
        status="published"
    )
    return render(request, "blog_detail.html", {"post": post})

def settings(request):
    return render(request,"settings.html")
    

def dashboard(request):
    return render(request,"dashboard.html")
    