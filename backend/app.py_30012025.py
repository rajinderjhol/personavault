# app.py
"""
PersonaVault Backend Service
============================

A secure knowledge management system with AI integration featuring:

- User authentication & session management
- AI configuration profiles
- Encrypted memory storage with semantic search
- Secure file uploads
- Real-time WebSocket communication
- Theme customization
- Automated maintenance tasks

Architecture Components:
- REST API endpoints with JWT-like session management
- SQLite database with encrypted sensitive fields
- Fernet-based encryption for sensitive data
- Rate limiting for security-critical endpoints
- Background task scheduler for maintenance
- WebSocket server for real-time updates

Security Features:
- Content Security Policy (CSP) headers
- Secure cookie configurations
- PBKDF2 password hashing
- Input validation and sanitization
- Automated session expiration
- API rate limiting
"""

from pathlib import Path
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# --- Core Imports ---
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory, Response, session, make_response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import uuid
import requests
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import json
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine
from extensions import db 
from functools import wraps
from contextlib import contextmanager
import asyncio
import websockets
from threading import Thread
import re


# --- Configuration Constants ---
DEFAULT_THEME = 'light'  # Default UI theme
SESSION_LIFETIME = timedelta(hours=1)  # User session duration
CLEANUP_INTERVAL_HOURS = 6  # Database maintenance interval
MAX_FILE_SIZE_MB = 16  # Maximum file upload size
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}  # Permitted file types

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Security Imports ---
from auth import (
    hash_password,
    verify_password,
    validate_email,
    get_db_connection,
    authenticate_user,
    error_response,
    session_required
)

# --- Encryption Service ---
class DataVault:
    """
    Cryptographic service for handling sensitive data using Fernet symmetric encryption.
    
    Attributes:
        key (str): Encryption key from environment variables.
        cipher (Fernet): Fernet cipher instance.
    
    Methods:
        encrypt(plaintext): Encrypts string data.
        decrypt(ciphertext): Decrypts encrypted data.
    """
    
    def __init__(self):
        """Initialize encryption system with environment key or generate transient key."""
        self.key = os.getenv('ENCRYPTION_KEY')
        if not self.key:
            if os.getenv('APP_ENV') == 'production':
                raise RuntimeError("ENCRYPTION_KEY required in production!")
            self.key = Fernet.generate_key().decode()
            logger.warning("Using transient encryption key for development!")
        self.cipher = Fernet(self.key.encode())

    def encrypt(self, plaintext: str) -> str:
        """Encrypt sensitive string data."""
        if not plaintext:
            return ''
        try:
            return self.cipher.encrypt(plaintext.encode()).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return ''

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt encrypted string data."""
        if not ciphertext:
            return ''
        try:
            return self.cipher.decrypt(ciphertext.encode()).decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return ''

vault = DataVault()  # Global encryption instance

# --- Flask Application Setup ---
def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///personavault.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize SQLAlchemy FIRST
    db.init_app(app)
    
    # Import blueprints AFTER db initialization BUT BEFORE registration
    from ollama_service import ollama_bp  # <-- ADD THIS LINE HERE
    
    # Register blueprints
    app.register_blueprint(ollama_bp, url_prefix='/api')  # <-- KEEP THIS
    
    # Create database tables
    with app.app_context():
        from models import AISetting
        db.create_all()
    
    return app

app = create_app()

# Security Headers Configuration
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=os.getenv('APP_ENV') == 'production',  # Only secure in production
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=SESSION_LIFETIME,
    UPLOAD_FOLDER='uploads',
    MAX_CONTENT_LENGTH=MAX_FILE_SIZE_MB * 1024 * 1024,
    ALLOWED_EXTENSIONS=ALLOWED_EXTENSIONS,
    SESSION_COOKIE_DOMAIN=os.getenv('SESSION_COOKIE_DOMAIN', 'localhost')
)

# CORS Configuration
CORS(
    app,
    resources={
        r"/*": {
            "origins": ["http://localhost:5173", "https://localhost:5173", "https://127.0.0.1:5173"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "X-CSRFToken"],
            "supports_credentials": True,  # Ensure this is True
            "expose_headers": ["Content-Disposition", "Set-Cookie"],
            "max_age": 600,
        }
    }
)

def _build_cors_preflight_response():
    response = make_response()
    origin = request.headers.get('Origin')
    allowed_origins = ["https://localhost:5173", "https://127.0.0.1:5173"]
    
    if origin in allowed_origins:
        response.headers.add("Access-Control-Allow-Origin", origin)
    else:
        # Return a 204 No Content response for disallowed origins
        response.status_code = 204
        return response
    
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
    response.headers.add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    return response

# CORS preflight response
@app.before_request
def handle_options():
    """Handle CORS preflight requests."""
    if request.method == "OPTIONS":
        return _build_cors_preflight_response()

# --- Update CSP Headers ---
@app.after_request
def add_security_headers(response):
    """Add security headers to responses."""
    csp = (
        "default-src 'self' https: 'unsafe-inline'; "
        "connect-src 'self' http://localhost:11434 ws://localhost:5002; "  # Allow localhost:11434 for API
        "img-src 'self' data:; "
        "script-src 'self'; "
        "style-src 'self';"
    )
    response.headers["Content-Security-Policy"] = csp
    return response

# --- Database Management ---
DATABASE = os.getenv('DATABASE_PATH', 'memory_db/personavault.db')
engine = create_engine(f"sqlite:///{DATABASE}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """
    Initialize database schema with required tables.
    
    Tables:
    - users: User accounts and authentication data.
    - sessions: Active user sessions.
    - ai_settings: AI configuration profiles.
    - memories: Encrypted user memories.
    
    Indexes:
    - Optimize common query patterns.
    """
    try:
        os.makedirs("memory_db", exist_ok=True)
        with sqlite3.connect(DATABASE, detect_types=sqlite3.PARSE_DECLTYPES) as conn:
            cursor = conn.cursor()

            # Users Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    email TEXT,
                    role TEXT DEFAULT 'user',
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    theme TEXT DEFAULT 'light',
                    last_login TIMESTAMP,
                    failed_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP
                );
            ''')

            # Sessions Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_id TEXT NOT NULL,
                    expires_at TIMESTAMP,
                    ip_address TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            ''')
            # Widgets table ()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_widgets (
                    user_id INTEGER PRIMARY KEY,
                    widgets TEXT DEFAULT '["chat","settings","agent"]',
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            ''')

            # AI Settings Table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ai_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    profile_name TEXT NOT NULL DEFAULT 'Default',
                    provider_type TEXT CHECK(provider_type IN ('Ollama', 'Internet', 'Hybrid')),
                    model_name TEXT NOT NULL,
                    api_key_enc TEXT,
                    api_endpoint TEXT,
                    temperature REAL DEFAULT 0.7,
                    max_tokens INTEGER DEFAULT 100,
                    system_prompt TEXT,
                    deployment_type TEXT CHECK(deployment_type IN ('local', 'internet', 'hybrid')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            ''')

            # Create Indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_settings_deployment ON ai_settings(deployment_type);')

        logger.info("Database schema initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

init_db()
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- Theme Management Endpoints ---
@app.route('/get-theme', methods=['GET', 'OPTIONS'])
@session_required
def get_theme(user_id):
    """
    Retrieve user's theme preference.
    
    Parameters:
    - user_id (int): Authenticated user ID from session.
    
    Returns:
    - JSON: { "theme": "light|dark" }
    
    Errors:
    - 500: Database error.
    """
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT theme FROM users WHERE id = ?', (user_id,))
            result = cursor.fetchone()
            theme = result[0] if result else DEFAULT_THEME
        return jsonify({"theme": theme})
    except Exception as e:
        logger.error(f"Theme fetch error: {e}")
        return error_response("Failed to retrieve theme", 500)

@app.route('/save-theme', methods=['POST', 'OPTIONS'])
@session_required
def save_theme(user_id):
    """
    Update user's theme preference.
    
    Parameters:
    - user_id (int): Authenticated user ID from session.
    - JSON: { "theme": "light|dark" }
    
    Returns:
    - JSON: { "status": "success" }
    
    Errors:
    - 500: Database error.
    """
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        data = request.json
        theme = data.get('theme', DEFAULT_THEME)
        
        with get_db_connection() as conn:
            conn.execute('UPDATE users SET theme = ? WHERE id = ?', (theme, user_id))
            conn.commit()
        
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Theme save error: {e}")
        return error_response("Failed to save theme", 500)

# --- User Management Endpoints ---
@app.route('/validate-session', methods=['POST', 'OPTIONS'])
def validate_session():
    try:
        session_id = request.cookies.get('session_id')
        if not session_id:
            return jsonify({
                "isAuthenticated": False,
                "showLogin": True,
                "showLogout": False,
                "showRegister": True,
                "theme": DEFAULT_THEME,
                "widgets": []
            }), 200

        user_id = authenticate_user(session_id)
        if not user_id:
            return jsonify({
                "isAuthenticated": False,
                "showLogin": True,
                "showLogout": False,
                "showRegister": True,
                "theme": DEFAULT_THEME,
                "widgets": []
            }), 401

        # Fetch user theme and widgets from the database
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Fetch theme
            cursor.execute('SELECT theme FROM users WHERE id = ?', (user_id,))
            theme_result = cursor.fetchone()
            theme = theme_result[0] if theme_result else DEFAULT_THEME

            # Fetch widgets
            cursor.execute('SELECT widgets FROM user_widgets WHERE user_id = ?', (user_id,))
            widgets_result = cursor.fetchone()
            widgets = json.loads(widgets_result[0]) if widgets_result else ["chat", "settings", "agent"]
                 
        return jsonify({
            "isAuthenticated": True,
            "showLogin": False,
            "showLogout": True,
            "showRegister": False,
            "theme": theme,
            "widgets": widgets
        }), 200

    except Exception as e:
        logger.error(f"Session validation error: {e}")
        return jsonify({"error": "Session validation failed"}), 500

# --- User Management Endpoints LOGIN AND LOGOUT---

# app route for register 
@app.route('/register', methods=['POST', 'OPTIONS'])
def register():
    """Handle user registration."""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not all([username, email, password]):
            return error_response("Missing required fields", 400)

        # Check if username or email already exists
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email))
            if cursor.fetchone():
                return error_response("Username or email already exists", 409)

            # Hash the password
            password_hash = hash_password(password)

            # Insert new user
            cursor.execute('''
                INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)
            ''', (username, email, password_hash))
            conn.commit()

            # Fetch the new user's ID
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            user_id = cursor.fetchone()[0]

            # Create a session
            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + SESSION_LIFETIME
            cursor.execute('''
                INSERT INTO sessions (user_id, session_id, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                user_id, 
                session_id, 
                expires_at,
                request.remote_addr,
                request.headers.get('User-Agent', '')
            ))
            conn.commit()

        # Set session cookie with explicit domain/path
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,  # Ensure this is a valid datetime object
            httponly=True,       # Prevent client-side JavaScript access
            secure=True,        # Set to False for local development (HTTP)
            samesite='Lax',     # Required for cross-origin requests
            path='/',            # Ensure the cookie is sent with all requests
          #  domain='localhost'   # Explicitly set to 'localhost' for local development
        )   

        logger.info(f"Session cookie set for user {user_id} with session_id {session_id}")
        return response

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return error_response("Registration failed", 500)
        

# app route for login
@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Authenticate user and create session."""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not all([username, password]):
            return error_response("Username and password required", 400)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, password_hash, failed_attempts, locked_until 
                FROM users 
                WHERE username = ?
            ''', (username,))
            user = cursor.fetchone()

            # Account lock check
            if user and user[3] and datetime.now() < datetime.fromisoformat(user[3]):
                return error_response("Account locked", 403)

            # Authentication logic
            if not user or not verify_password(password, user[1]):
                if user:
                    cursor.execute('''
                        UPDATE users 
                        SET failed_attempts = failed_attempts + 1 
                        WHERE id = ?
                    ''', (user[0],))
                    conn.commit()
                return error_response("Invalid credentials", 401)

            # Delete existing sessions for the user
            cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user[0],))
            conn.commit()

            # Reset security fields
            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + SESSION_LIFETIME
            cursor.execute('''
                UPDATE users 
                SET last_login = ?, failed_attempts = 0 
                WHERE id = ?
            ''', (datetime.now(), user[0]))
            
            # Session management
            cursor.execute('''
                INSERT INTO sessions 
                (user_id, session_id, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                user[0], 
                session_id, 
                expires_at,
                request.remote_addr,
                request.headers.get('User-Agent', '')
            ))
            conn.commit()

        # Set session cookie with explicit domain/path
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,
            secure=os.getenv('APP_ENV') == 'production',  # Secure only in production
            samesite='Lax',
            path='/',
          #  domain='localhost'
        )
        logger.info(f"Session cookie set for user {user[0]} with session_id {session_id}")
        logger.info(f"Deleted existing sessions for user {user[0]}")
        return response

    except Exception as e:
        logger.error(f"Login error: {e}")
        return error_response("Authentication failed", 500)


#  ---- 
# logout endpoint
@app.route('/logout', methods=['POST', 'OPTIONS'])
@session_required
def logout(user_id):
    """Terminate user session with cookie cleanup."""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    try:
        session_id = request.cookies.get('session_id')
        with get_db_connection() as conn:
            conn.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
            conn.commit()

        response = jsonify({"status": "success"})
        response.delete_cookie(
            'session_id',
            path='/',
            domain=os.getenv('SESSION_COOKIE_DOMAIN', 'localhost')
        )
        return response
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return error_response("Logout failed", 500)

# new endpoint in app.py to return widget configuration 
@app.route('/widget-config', methods=['GET'])
@session_required
def get_widget_config(user_id):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM ai_settings WHERE user_id = ?', (user_id,))
            settings = cursor.fetchall()

            # Example widget configuration (customize as needed)
            widget_config = {
                "chat": {
                    "endpoint": "https://localhost:5001/api/ollama/chat",
                    "model": "default",
                    "temperature": 0.7
                },
                "settings": {
                    "theme": "light",
                    "profile_name": "Default"
                },
                "agent": {
                    "endpoint": "https://localhost:5001/agent",
                    "model": "default"
                }
            }

        return jsonify(widget_config)
    except Exception as e:
        logger.error(f"Failed to fetch widget config: {e}")
        return error_response("Failed to retrieve widget config", 500)

# --- AI Configuration Endpoints ---
@app.route('/ai-settings', methods=['GET', 'POST', 'OPTIONS'])
@session_required
def handle_ai_settings(user_id):
    """
    Manage AI configuration profiles.
    
    GET: Retrieve all profiles for user.
    POST: Create new configuration profile.
    
    Parameters (POST):
    - JSON: {
        "settings": {
            "profile_name": str,
            "model_name": str,
            "provider_type": "Ollama|Internet|Hybrid",
            "deployment_type": "local|internet|hybrid",
            "temperature": float,
            "max_tokens": int,
            "system_prompt": str,
            "api_key": str (optional),
            "api_endpoint": str (optional)
        }
      }
    
    Returns:
    - GET: List of configuration profiles.
    - POST: { "status": "success" }
    
    Errors:
    - 400: Missing required fields.
    - 500: Database error.
    """
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    if request.method == 'GET':
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, profile_name, provider_type, deployment_type,
                        model_name, temperature, max_tokens, system_prompt
                    FROM ai_settings 
                    WHERE user_id = ?
                ''', (user_id,))
                settings = cursor.fetchall()
                
                results = []
                for row in settings:
                    results.append({
                        'id': row[0],
                        'profile_name': row[1],
                        'provider_type': row[2],
                        'deployment_type': row[3],
                        'model_name': row[4],
                        'temperature': row[5],
                        'max_tokens': row[6],
                        'system_prompt': row[7]
                    })
                
                logger.info(f"Fetched AI settings for user {user_id}: {results}")
                return jsonify(results)
        except Exception as e:
            logger.error(f"AI settings fetch error: {str(e)}")
            return error_response("Failed to retrieve settings", 500)

    elif request.method == 'POST':
        try:
            data = request.json.get('settings', {})
            required = ['profile_name', 'model_name', 'provider_type', 'deployment_type']
            if not all(data.get(k) for k in required):
                return error_response("Missing required fields", 400)
            
            encrypted_key = vault.encrypt(data.get('api_key', ''))
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO ai_settings (
                        user_id, profile_name, model_name, provider_type,
                        deployment_type, temperature, max_tokens, system_prompt,
                        api_key_enc, api_endpoint
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    data['profile_name'],
                    data['model_name'],
                    data['provider_type'],
                    data['deployment_type'],
                    data.get('temperature', 0.7),
                    data.get('max_tokens', 100),
                    data.get('system_prompt', ''),
                    encrypted_key,
                    data.get('api_endpoint', '')
                ))
                conn.commit()
            
            logger.info(f"Saved new AI settings for user {user_id}: {data}")
            return jsonify({"status": "success"})
        except Exception as e:
            logger.error(f"AI settings save error: {str(e)}")
            return error_response("Failed to save configuration", 500)

# Add these routes from refactoring settingswidget to backend to the existing Flask app
@app.route('/ai-settings', methods=['POST'])
@session_required
def save_ai_settings(user_id):
    """
    Save AI settings for the user.
    """
    try:
        payload = request.json.get('settings', {})
        response, status_code = save_ai_settings(user_id, payload)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai-settings', methods=['GET'])
@session_required
def get_past_settings(user_id):
    """
    Fetch past AI settings for the user.
    """
    try:
        response, status_code = fetch_past_settings(user_id)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai-settings/<int:setting_id>', methods=['DELETE'])
@session_required
def delete_ai_settings(user_id, setting_id):
    """
    Delete AI settings for the user.
    """
    try:
        response, status_code = delete_ai_settings(user_id, setting_id)
        return jsonify(response), status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ai-settings/current', methods=['GET', 'OPTIONS'])
@session_required
def get_current_ai_settings(user_id):
    """
    Retrieve the current AI settings for the user.
    
    Parameters:
    - user_id (int): Authenticated user ID from session.
    
    Returns:
    - JSON: The current AI settings.
    
    Errors:
    - 404: No settings found.
    - 500: Database error.
    """
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, profile_name, provider_type, deployment_type,
                    model_name, temperature, max_tokens, system_prompt
                FROM ai_settings 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            ''', (user_id,))
            settings = cursor.fetchone()
            
            if not settings:
                return error_response("No settings found", 404)
            
            result = {
                'id': settings[0],
                'profile_name': settings[1],
                'provider_type': settings[2],
                'deployment_type': settings[3],
                'model_name': settings[4],
                'temperature': settings[5],
                'max_tokens': settings[6],
                'system_prompt': settings[7]
            }
            
            return jsonify(result)
    except Exception as e:
        logger.error(f"Failed to fetch current AI settings: {e}")
        return error_response("Failed to retrieve settings", 500)

# --- WebSocket Server ---
class WSManager:
    """
    WebSocket connection manager for real-time updates.
    
    Attributes:
        connected (set): Active WebSocket connections.
    
    Methods:
        handler: Main WebSocket handler.
        broadcast: Send message to all connections.
    """
    
    def __init__(self):
        self.connected = set()

    async def handler(self, websocket, path):
        """Handle WebSocket connections and message routing."""
        self.connected.add(websocket)
        try:
            async for message in websocket:
                await self.process_message(websocket, message)
        except websockets.ConnectionClosed:
            pass
        finally:
            self.connected.remove(websocket)

    async def process_message(self, websocket, message):
        """Process incoming WebSocket messages."""
        try:
            data = json.loads(message)
            if data.get('type') == 'message':
                response = {
                    'type': 'message',
                    'sender': 'bot',
                    'content': f'Echo: {data.get("content")}',
                    'timestamp': datetime.utcnow().isoformat()
                }
                await self.broadcast(response)
        except json.JSONDecodeError:
            await websocket.send(json.dumps({'error': 'Invalid JSON'}))

    async def broadcast(self, message):
        """Broadcast message to all connected clients."""
        for client in self.connected:
            await client.send(json.dumps(message))

ws_manager = WSManager()

# --- WebSocket Health Check ---
@app.route('/ws-health', methods=['GET'])
def ws_health():
    return jsonify({
        "status": "active",
        "clients": len(ws_manager.connected)
    })

# --- WebSocket Server Thread ---
def ws_server():
    """Start WebSocket server in background thread."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Add reuse port configuration
    start_server = websockets.serve(
        ws_manager.handler, 
        "localhost", 
        5002,
        reuse_port=True  # Allow multiple processes to bind to the port
    )
    
    try:
        loop.run_until_complete(start_server)
        loop.run_forever()
    except OSError as e:
        if e.errno == 48:  # Address already in use
            logger.warning("WebSocket server already running")
        else:
            raise
            
Thread(target=ws_server, daemon=True).start()

# --- Maintenance Tasks ---
def cleanup_job():
    """Scheduled maintenance tasks:
    - Remove expired sessions.
    - Delete expired memories.
    - Clean orphaned uploads.
    """
    logger.info("Running cleanup tasks...")
    now = datetime.now()
    
    with get_db_connection() as conn:
        # Expired sessions
        conn.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
        
        # Expired memories
        conn.execute('''
            DELETE FROM memories 
            WHERE expiry_days > 0 AND 
                  datetime(created_at, '+' || expiry_days || ' days') < ?
        ''', (now,))
        
        # Orphaned files
        cursor = conn.execute('SELECT associated_files FROM memories')
        valid_files = {row[0] for row in cursor}
        for f in os.listdir(app.config['UPLOAD_FOLDER']):
            path = os.path.join(app.config['UPLOAD_FOLDER'], f)
            if path not in valid_files and os.path.isfile(path):
                os.remove(path)
        
        conn.commit()

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    cleanup_job,
    'interval',
    hours=CLEANUP_INTERVAL_HOURS,
    next_run_time=datetime.now() + timedelta(minutes=1)
)
scheduler.start()

# --- Main Execution ---
if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5001,
        ssl_context=('certs/backend-cert.pem', 'certs/backend-key.pem'),
        debug=os.getenv('APP_ENV') == 'development',
        use_reloader=False
    )