# Environment Setup Guide - AQI Project

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation Steps](#installation-steps)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Verification Checklist](#verification-checklist)
8. [Troubleshooting](#troubleshooting)
9. [Development Tools](#development-tools)

---

## Prerequisites

### Required Software
- **Python:** 3.8 or higher (3.9+ recommended)
- **pip:** Python package manager (comes with Python)
- **git:** Version control system
- **SQLite3:** Database (bundled with Python)
- **Node.js & npm:** (Optional, for frontend build tools)

### Check Prerequisites
```bash
# Check Python version
python --version
python3 --version

# Check pip
pip --version

# Check git
git --version

# Check Node.js (optional)
node --version
npm --version
```

---

## System Requirements

### Minimum System Specs
- **OS:** Linux, macOS, or Windows
- **RAM:** 2GB minimum, 4GB+ recommended
- **Disk Space:** 2GB for project + dependencies
- **Network:** Required for initial `pip install`

### Operating System Specifics

#### Linux (Ubuntu/Debian)
```bash
# Update package lists
sudo apt update

# Install Python and dependencies
sudo apt install python3 python3-pip python3-venv git

# Install optional dev tools
sudo apt install sqlite3 nodejs npm
```

#### macOS
```bash
# Using Homebrew
brew install python@3.11 python-pip git sqlite nodejs

# Or download from python.org
# https://www.python.org/downloads/
```

#### Windows
```powershell
# Using Windows Package Manager
winget install Python.Python.3.11
winget install Git.Git
winget install Nodejs.Nodejs

# Or download installers from:
# - https://www.python.org/downloads/
# - https://git-scm.com/download/win
# - https://nodejs.org/
```

---

## Installation Steps

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/jswnthh/aqiproject.git

# Navigate to project directory
cd aqiproject

# Verify structure
ls -la
```

**Expected output:**
```
├── api/
├── core/
├── aqiproject/
├── static/
├── media/
├── manage.py
├── db.sqlite3
├── openapi.json
└── requirements.txt (if exists)
```

### 2. Create Virtual Environment

A virtual environment isolates project dependencies from system Python.

#### Linux/macOS
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# You should see (venv) in your terminal prompt
```

#### Windows (Command Prompt)
```cmd
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# You should see (venv) in your terminal prompt
```

#### Windows (PowerShell)
```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\Activate.ps1

# If you get an execution policy error, run:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Verify activation:**
```bash
# Should show path with /venv/ or \venv\
which python

# Or on Windows
where python
```

### 3. Install Dependencies

```bash
# Upgrade pip first
pip install --upgrade pip setuptools wheel

# Install required packages
pip install django==6.0.2
pip install djangorestframework
pip install pillow
pip install django-cors-headers
pip install python-dotenv

# Or install from requirements.txt (if exists)
pip install -r requirements.txt
```

**Verify installations:**
```bash
pip list | grep -E "django|rest-framework|pillow"
```

### 4. Create Requirements File (Optional but Recommended)

```bash
# Generate requirements.txt from current environment
pip freeze > requirements.txt
```

**Example requirements.txt:**
```
django==6.0.2
djangorestframework==3.14.0
pillow==10.0.0
django-cors-headers==4.3.0
python-dotenv==1.0.0
gunicorn==21.2.0  # For production
```

---

## Environment Configuration

### 1. Create Environment Variables File

```bash
# Create .env file in project root
touch .env
```

### 2. Configure .env File

Edit `.env` with your settings:

```env
# Django Settings
SECRET_KEY=your-very-secret-key-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///db.sqlite3

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# API Settings
API_TIMEOUT=30

# Email (Optional)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# File Upload Limits
MAX_UPLOAD_SIZE=5242880  # 5MB

# Logging Level
LOG_LEVEL=INFO

# Sensor Simulation
SIMULATION_ENABLED=True
SIMULATION_INTERVAL=3  # seconds
```

### 3. Generate Django Secret Key

```bash
# Using Python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Copy the output and paste into SECRET_KEY in .env
```

### 4. Update Django Settings

Edit `aqiproject/settings.py` if needed:

```python
# Load environment variables
from dotenv import load_dotenv
import os

load_dotenv()

# Security settings
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-key-for-dev')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# CORS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

# Static files
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

---

## Database Setup

### 1. Run Database Migrations

Migrations create/update database tables based on Django models.

```bash
# Show pending migrations
python manage.py showmigrations

# Apply migrations
python manage.py migrate

# Expected output shows "OK" for each app
```

**Verify migration:**
```bash
# Check database structure
python manage.py dbshell

# Inside sqlite3 shell:
.tables
.schema core_sensor
.quit
```

### 2. Create Superuser (Admin Account)

```bash
python manage.py createsuperuser

# You'll be prompted for:
# Username: admin
# Email: admin@example.com
# Password: (enter securely)
# Password (again): (confirm)
```

### 3. Load Sample Data (Optional)

```bash
# If you have a fixtures file
python manage.py loaddata initial_data.json

# Or manually via Django shell
python manage.py shell
```

**Inside the Django shell:**
```python
from core.models import Sensor

# Create sample sensors
Sensor.objects.create(
    sensor_id='KP-001',
    name='KP-001',
    area='Kilpauk Garden Road',
    latitude=13.0845,
    longitude=80.2390,
    is_active=True
)

# Exit shell
exit()
```

---

## Running the Application

### 1. Start Development Server

```bash
# Ensure virtual environment is activated
# (venv) should appear in terminal prompt

# Run development server
python manage.py runserver

# Or specify custom host/port
python manage.py runserver 0.0.0.0:8000

# Expected output:
# System check identified no issues (0 silenced).
# February 09, 2026 - 12:00:00
# Django version 6.0.2, using settings 'aqiproject.settings'
# Starting development server at http://127.0.0.1:8000/
# Quit the server with CONTROL-C.
```

### 2. Verify Server is Running

Open in your browser or terminal:

```bash
# In another terminal window/tab
curl http://localhost:8000/

# Or open browser
# http://localhost:8000/
```

### 3. Access Admin Panel

```
URL: http://localhost:8000/admin/
Username: admin (or your superuser username)
Password: (your superuser password)
```

### 4. Start Sensor Simulation

```bash
# In yet another terminal, or use Postman/curl

# Start simulation
curl -X POST http://localhost:8000/api/simulation/start/

# Check status
curl http://localhost:8000/api/simulation/status/

# View logs
curl http://localhost:8000/api/simulation/logs/
```

---

## Verification Checklist

Run these checks to confirm setup success:

```bash
# 1. Check Python version
python --version
# Expected: Python 3.8+

# 2. Check virtual environment activation
which python  # Linux/macOS
where python  # Windows - should show /venv/ or \venv\

# 3. List installed packages
pip list | head -20

# 4. Check Django installation
django-admin --version

# 5. Check project structure
ls -la
# Should show: api, core, aqiproject, static, manage.py, etc.

# 6. Test Django setup
python manage.py check
# Expected: System check identified no issues

# 7. Test database
python manage.py showmigrations
# Should list migrations for: admin, auth, contenttypes, core, sessions

# 8. Start server and verify
python manage.py runserver &
sleep 2
curl http://localhost:8000/
kill %1  # Kill the background process

# 9. Test API endpoint
curl http://localhost:8000/api/sensors/

echo "✅ Setup verification complete!"
```

---

## Troubleshooting

### Virtual Environment Issues

#### Problem: Virtual environment not activating
```bash
# Linux/macOS
# Check if venv directory exists
ls -la venv/

# Recreate if missing
python3 -m venv venv
source venv/bin/activate

# Windows
# Try alternative activation
venv\Scripts\Activate.bat
```

#### Problem: "No module named django"
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate  # Windows

# Reinstall packages
pip install django
pip install -r requirements.txt
```

### Database Issues

#### Problem: "no such table"
```bash
# Run migrations
python manage.py migrate

# Check migration status
python manage.py showmigrations

# If stuck, reset database (development only)
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

#### Problem: Corrupted database
```bash
# Backup existing
cp db.sqlite3 db.sqlite3.backup

# Delete and recreate (only in development!)
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser

# Restore if needed
cp db.sqlite3.backup db.sqlite3
```

### Port Already in Use

#### Problem: "That port is already in use"
```bash
# Find process using port 8000
lsof -i :8000          # Linux/macOS
netstat -ano | findstr :8000  # Windows

# Kill the process
kill -9 <PID>          # Linux/macOS
taskkill /PID <PID> /F # Windows

# Or use different port
python manage.py runserver 8001
```

### Import/PYTHONPATH Issues

#### Problem: "ImportError: No module named"
```bash
# Verify PYTHONPATH
python -c "import sys; print('\n'.join(sys.path))"

# Add project to path (temporary)
export PYTHONPATH="${PYTHONPATH}:/path/to/aqiproject"

# Or reinstall django/dependencies
pip install --upgrade --force-reinstall django
```

### Static Files Issues

#### Problem: CSS/JS files not loading
```bash
# Collect static files
python manage.py collectstatic --noinput

# Check static files directory
ls -la static/
ls -la staticfiles/

# Verify STATIC_URL and STATICFILES_DIRS in settings
python -c "from django.conf import settings; print(settings.STATIC_URL)"
```

### Pillow/Image Issues

#### Problem: "ModuleNotFoundError: No module named 'PIL'"
```bash
# Install Pillow
pip install pillow

# On macOS, might need system libraries
brew install libjpeg libpng libopenjp2 libtiff webp little-cms2

# Reinstall pillow
pip install --force-reinstall pillow
```

---

## Development Tools

### Setup IDE/Editor

#### VS Code Configuration

Create `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "ms-python.python"
  },
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/venv": true
  }
}
```

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Django",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/manage.py",
      "args": ["runserver"],
      "django": true,
      "justMyCode": true
    }
  ]
}
```

#### PyCharm Configuration
1. Open project in PyCharm
2. Go to **PyCharm → Settings → Project → Python Interpreter**
3. Click gear icon → **Add** → **Existing Environment**
4. Select `venv/bin/python` (Linux/macOS) or `venv\Scripts\python.exe` (Windows)
5. Click **OK**

### Install Development Tools

```bash
# Code formatter
pip install black

# Linter
pip install pylint

# Type checker
pip install mypy

# Testing framework
pip install pytest pytest-django pytest-cov

# Code quality
pip install flake8

# Pre-commit hooks
pip install pre-commit
pre-commit install
```

### Create Pre-commit Hooks

Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.1.0
    hooks:
      - id: black
  - repo: https://github.com/PyCQA/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
  - repo: https://github.com/PyCQA/isort
    rev: 5.12.0
    hooks:
      - id: isort
```

---

## Security Setup (Production)

### Environment Variables for Production

```env
# settings.py production values
SECRET_KEY=<generate-new-secure-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# SSL/TLS
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_HSTS_SECONDS=31536000

# Database (use PostgreSQL in production)
DATABASE_URL=postgresql://user:pass@localhost/aqiproject

# Email backend
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
```

### Create Superuser for Production

```bash
# Use strong password
python manage.py createsuperuser

# Create regular users via admin panel
# Don't use superuser for API/daily operations
```

### Database Backup

```bash
# SQLite backup
cp db.sqlite3 db.sqlite3.backup

# Or use management command
python manage.py dumpdata > db_backup.json

# Restore
python manage.py loaddata db_backup.json
```

---

## Quick Reference Commands

```bash
# Activate virtual environment
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver

# Run tests
python manage.py test

# Access Django shell
python manage.py shell

# Collect static files
python manage.py collectstatic

# Fix code formatting
black .

# Run linter
flake8 .

# Type checking
mypy .

# Deactivate virtual environment
deactivate
```

---

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Python Virtual Environments](https://docs.python.org/3/tutorial/venv.html)
- [OpenAPI/Swagger Spec](./openapi.json)
- [API Usage Guide](./API_USAGE_GUIDE.md)

---

**Last Updated:** February 9, 2026  
**Version:** 1.0.0  
**Python:** 3.8+  
**Django:** 6.0.2
