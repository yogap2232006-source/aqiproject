## How to Run Project

### Prerequisites
- **Python** 3.8 or higher
- **pip** (Python package manager)
- **git** (for cloning the repository)

### Quick Start (5-10 minutes)

#### 1. Clone the Repository
```bash
git clone https://github.com/jswnthh/aqiproject.git
cd aqiproject
```

#### 2. Create Virtual Environment

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (Command Prompt):**
```cmd
python -m venv venv
venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

#### 3. Install Dependencies
```bash
pip install --upgrade pip
pip install django==6.0.2
pip install djangorestframework
pip install pillow
pip install django-cors-headers
pip install python-dotenv
```

#### 4. Configure Environment
Create a `.env` file in the project root:
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:8000
```

**Generate a secure SECRET_KEY:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

#### 5. Setup Database
```bash
# Run migrations
python manage.py migrate

# Create admin superuser
python manage.py createsuperuser
# Follow prompts to create admin account
```

#### 6. Run Development Server
```bash
python manage.py runserver
```

**Expected output:**
```
System check identified no issues (0 silenced).
Django version 6.0.2, using settings 'aqiproject.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### Access the Application

- **Main App:** http://localhost:8000/
- **Admin Panel:** http://localhost:8000/admin/
- **API:** http://localhost:8000/api/
- **API Documentation:** See [openapi.json](openapi.json)

### Start Sensor Simulation (Optional)

In a new terminal window:
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or your Windows activation command

# Start simulation
curl -X POST http://localhost:8000/api/simulation/start/

# Check status
curl http://localhost:8000/api/simulation/status/

# View logs
curl http://localhost:8000/api/simulation/logs/
```

### Verify Setup

Run this verification command to confirm everything is working:
```bash
python manage.py check
```

Expected output:
```
System check identified no issues (0 silenced).
```

### Troubleshooting

**Port 8000 Already in Use:**
```bash
# Use different port
python manage.py runserver 8001
```

**Database Error:**
```bash
# Reset database (development only)
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

**Module Not Found:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Next Steps

- Check [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed setup & troubleshooting
- Review [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md) for API documentation
- Visit [openapi.json](openapi.json) for OpenAPI specification
- Access Django admin at `/admin/` to manage data

### Useful Commands

```bash
# Access Django interactive shell
python manage.py shell

# Create migrations for model changes
python manage.py makemigrations

# Apply pending migrations
python manage.py migrate

# Collect static files (production)
python manage.py collectstatic

# Run tests
python manage.py test

# Flush database (delete all data)
python manage.py flush

# Deactivate virtual environment
deactivate
```

---

**Full Setup Guide:** See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for comprehensive setup, troubleshooting, IDE configuration, and production deployment instructions.
