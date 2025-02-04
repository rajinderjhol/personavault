# app.py
from pathlib import Path
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory, Response, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import uuid
import requests
import logging
import bcrypt
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import json
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine
from functools import wraps
from contextlib import contextmanager
import asyncio
import websockets
from threading import Thread
import concurrent.futures
import re

# --- Configuration Section ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import authentication functions from auth.py
from auth import hash_password, verify_password, validate_email, get_db_connection, authenticate_user, error_response, session_required

# Encryption Setup
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    if os.getenv('APP_ENV') == 'production':
        raise ValueError("ENCRYPTION_KEY must be set in production!")
    else:
        ENCRYPTION_KEY = Fernet.generate_key().decode()
        logger.warning("Using transient encryption key for development!")

cipher_suite = Fernet(ENCRYPTION_KEY.encode())

def encrypt_data(plaintext: str) -> str:
    if not plaintext:
        return ''
    try:
        return cipher_suite.encrypt(plaintext.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return ''

def decrypt_data(ciphertext: str) -> str:
    if not ciphertext:
        return ''
    try:
        return cipher_suite.decrypt(ciphertext.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return ''

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'fallback-secret-key')

# Security Configurations
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE='None',
    PERMANENT_SESSION_LIFETIME=timedelta(days=1),
    SESSION_PERMANENT=True,
    UPLOAD_FOLDER='uploads',
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
    ALLOWED_EXTENSIONS={'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# WebSocket server URL
WEBSOCKET_SERVER_URL = "ws://localhost:5002"

# Database configuration
DATABASE = os.getenv('DATABASE_PATH', 'memory_db/personavault.db')
engine = create_engine(f"sqlite:///{DATABASE}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Initialize scheduler for background tasks
scheduler = BackgroundScheduler()
scheduler.start()

# Configure CORS
CORS(
    app,
    resources={r"/*": {
        "origins": "https://localhost:5173",
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Disposition", "Set-Cookie"]
    }}
)




# Register SQLite3 adapters for datetime objects
sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())
sqlite3.register_converter("datetime", lambda ts: datetime.fromisoformat(ts.decode()))

# --- Database Initialization ---
def init_db():
    """Initialize the SQLite database and create necessary tables if they don't exist."""
    try:
        os.makedirs("memory_db", exist_ok=True)
        conn = sqlite3.connect(DATABASE, detect_types=sqlite3.PARSE_DECLTYPES)
        cursor = conn.cursor()

        # Create users table
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

        # Create sessions table
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

        # Create ai_settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_name TEXT NOT NULL DEFAULT 'Default',
                provider_type TEXT CHECK(provider_type IN ('Ollama', 'Internet', 'Hybrid')),
                model_name TEXT NOT NULL,
                model_description TEXT,            
                api_key_enc TEXT,
                api_endpoint TEXT,
                temperature REAL DEFAULT 0.7,
                max_tokens INTEGER DEFAULT 100,
                top_p REAL DEFAULT 0.9,
                system_prompt TEXT,
                response_format TEXT,
                language TEXT,
                is_active BOOLEAN DEFAULT 1,
                embedding_model TEXT,
                fallback_model_name TEXT,
                fallback_provider_type TEXT CHECK(fallback_provider_type IN ('Ollama', 'Internet')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                presence_penalty REAL,
                frequency_penalty REAL,
                user_context TEXT,
                privacy_level TEXT,      
                tags TEXT,              
                expiry_days INTEGER,     
                deployment_type TEXT CHECK(deployment_type IN ('local', 'internet', 'hybrid')), 
                provider_name TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        ''')

        # Create memories table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                memory_type TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                privacy_level TEXT,
                expiry_days INTEGER,
                embedding TEXT,
                read_status TEXT DEFAULT 'unread',
                thread_id TEXT,
                associated_files TEXT,            
                last_accessed TIMESTAMP,          
                access_count INTEGER DEFAULT 0,   
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        ''')

        # Add indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_settings_user ON ai_settings(user_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags);')

        conn.commit()
        conn.close()
        logger.info("Database initialized successfully with full schema.")
    except Exception as e:
        logger.error(f"Database initializing failed: {e}")
        raise

# Initialize the database
init_db()

# File uploads will fail if the directory doesn't exist.
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


# WebSocket server implementation
connected_clients = set()

async def handle_connection(websocket, path):
    """Handle WebSocket connections and messages."""
    logger.info("Client connected")
    connected_clients.add(websocket)
    try:
        async for message in websocket:
            logger.info(f"Received WebSocket message: {message}")
            try:
                data = json.loads(message)
                if not isinstance(data, dict):
                    raise ValueError("Invalid message format")

                if data.get("type") == "message":
                    response = {
                        "type": "message",
                        "sender": "bot",
                        "content": f"Echo: {data.get('content')}",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    for client in connected_clients:
                        await client.send(json.dumps(response))
            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Invalid WebSocket message: {e}")
                await websocket.send(json.dumps({"error": "Invalid message format"}))
    except websockets.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        connected_clients.remove(websocket)

def start_websocket_server():
    """Start the WebSocket server in a separate thread."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        start_server = websockets.serve(handle_connection, "localhost", 5002)
        logger.info("WebSocket server started on ws://localhost:5002")
        loop.run_until_complete(start_server)
        loop.run_forever()
    except Exception as e:
        logger.error(f"Failed to start WebSocket server: {e}")
    finally:
        loop.close()

websocket_thread = Thread(target=start_websocket_server, daemon=True)
websocket_thread.start()

# --- Authentication Endpoints ---
@app.route('/create-session', methods=['POST', 'OPTIONS'])
def create_session():
    """Endpoint to create a new session."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        session_name = data.get('session_name')

        if not session_name:
            logger.warning("Session name is required.")
            return error_response("Session name is required.", 400)

        session_id = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(days=1)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO sessions (session_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?)', 
            (session_id, expires_at, request.remote_addr,
            request.headers.get('User-Agent', ''))
        )
            conn.commit()

        logger.info(f"Session created: {session_id}")
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,
            secure=True,
            samesite='Lax',
            path='/'
        )

        return response
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return error_response("An error occurred while creating the session.", 500)

@app.route('/join-session', methods=['POST', 'OPTIONS'])
def join_session():
    """Endpoint to join an existing session."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        session_id = data.get('session_id')

        if not session_id:
            logger.warning("Session ID is required.")
            return error_response("Session ID is required.", 400)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?', (session_id, datetime.now()))
            session = cursor.fetchone()

            if not session:
                logger.warning(f"Invalid or expired session: {session_id}")
                return error_response("Invalid or expired session.", 404)

        logger.info(f"User joined session: {session_id}")
        return jsonify({"status": "success", "session_id": session_id})
    except Exception as e:
        logger.error(f"Error joining session: {e}")
        return error_response("An error occurred while joining the session.", 500)

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint to check the health of the backend."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return error_response("An error occurred during health check.", 500)

@app.route('/')
def serve_index():
    """Serve the frontend index.html file when the root path is accessed."""
    logger.info("Serving index.html")
    return send_from_directory('../frontend', 'index.html')

@app.route('/register', methods=['POST', 'OPTIONS'])
def register():
    """Endpoint to register a new user."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')

        if not username or not password:
            logger.warning("Registration attempt with missing username or password.")
            return error_response("Username and password are required", 400)

        if email and not validate_email(email):
            logger.warning("Invalid email address provided.")
            return error_response("Invalid email address", 400)

        password_hash = hash_password(password)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', (username, password_hash, email))
            conn.commit()

        logger.info(f"User registered successfully: {username}")
        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)
        return response
    except sqlite3.IntegrityError:
        logger.error(f"Username '{username}' already exists.")
        return error_response("Username already exists", 400)
    except Exception as e:
        logger.error(f"Error in /register endpoint: {e}")
        return error_response("An error occurred during registration.", 500)

@app.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        logger.info(f"Login attempt for username: {username}")

        if not username or not password:
            logger.warning("Login attempt with missing username or password.")
            return jsonify({"error": "Username and password are required"}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
            user = cursor.fetchone()

            if not user:
                logger.warning(f"Login failed: User '{username}' not found.")
                return jsonify({"error": "Username not found"}), 401

            user_id, password_hash = user
            if not verify_password(password, password_hash):
                logger.warning(f"Login failed: Incorrect password for user '{username}'.")
                return jsonify({"error": "Incorrect password"}), 401

            cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
            conn.commit()

            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + timedelta(hours=1)

            cursor.execute('INSERT INTO sessions (user_id, session_id, expires_at) VALUES (?, ?, ?)', (user_id, session_id, expires_at))
            conn.commit()

        logger.info(f"Login successful: User '{username}' logged in.")
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,
            secure=True,
            samesite='None'
        )
        return response, 200
    except Exception as e:
        logger.error(f"Error in /login endpoint: {e}")
        return jsonify({"error": "An error occurred during login."}), 500

@app.route('/validate-session', methods=['POST'])
def validate_session():
    """Endpoint to validate a user's session."""
    try:
        session_id = request.cookies.get('session_id')
        if not session_id:
            logger.warning("Unauthorized request: No session ID provided.")
            return jsonify({"error": "Unauthorized: No session ID provided."}), 401

        user_id = authenticate_user(session_id)
        if not user_id:
            logger.warning("Unauthorized request: Invalid session ID.")
            return jsonify({"error": "Unauthorized: Invalid session."}), 401

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT username, email FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()

        if not user:
            logger.error(f"User not found for user_id: {user_id}")
            return jsonify({"error": "User not found"}), 404

        username, email = user
        logger.info(f"Session validated for user_id: {user_id}")
        return jsonify({
            "status": "success",
            "user_id": user_id,
            "username": username,
            "email": email
        })

    except sqlite3.DatabaseError as db_error:
        logger.error(f"Database error: {db_error}")
        return jsonify({"error": "Database error occurred."}), 500
    except Exception as e:
        logger.error(f"Error in /validate-session endpoint: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500

@app.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Endpoint to log out a user and delete the session."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        session_id = request.cookies.get('session_id')
        if not session_id:
            logger.warning("Unauthorized request: No session ID provided.")
            return error_response("Unauthorized", 401)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
            conn.commit()

        logger.info(f"Logout successful: Session '{session_id}' deleted.")
        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)
        return response
    except Exception as e:
        logger.error(f"Error in /logout endpoint: {e}")
        return error_response("An error occurred during logout.", 500)

@app.route('/logout-all', methods=['POST', 'OPTIONS'])
@session_required
def logout_all(user_id):
    """Endpoint to log out all sessions for the user."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
            conn.commit()

        logger.info(f"All sessions logged out for user_id: {user_id}")
        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)
        return response
    except Exception as e:
        logger.error(f"Error in /logout-all endpoint: {e}")
        return error_response("An error occurred during logout.", 500)

@app.route('/profile', methods=['GET', 'OPTIONS'])
@session_required
def get_profile(user_id):
    """Endpoint to fetch the user's profile."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT username, email FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()

            if not user:
                logger.error(f"User not found for user_id: {user_id}")
                return error_response("User not found", 404)

            username, email = user
            logger.info(f"Profile fetched for user: {username}")
            return jsonify({"username": username, "email": email})
    except Exception as e:
        logger.error(f"Error in /profile endpoint: {e}")
        return error_response("An error occurred while fetching the profile.", 500)

@app.route('/profile', methods=['POST', 'OPTIONS'])
@session_required
def update_profile(user_id):
    """Endpoint to update the user's profile."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')

        if not username or not email:
            logger.warning("Username and email are required.")
            return error_response("Username and email are required.", 400)

        if email and not validate_email(email):
            logger.warning("Invalid email address provided.")
            return error_response("Invalid email address", 400)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE users SET username = ?, email = ? WHERE id = ?', (username, email, user_id))
            conn.commit()

        logger.info(f"Profile updated for user_id: {user_id}")
        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)
        return response
    except Exception as e:
        logger.error(f"Error in /profile endpoint: {e}")
        return error_response("An error occurred while updating the profile.", 500)



# SETTINGS PART GET AI SETTINGS START

@app.route('/ai-settings', methods=['GET'])
@session_required
def get_ai_settings(user_id):
    try:
        logger.info(f"Fetching AI settings for user_id: {user_id}")

        deployment_type = request.args.get('deployment', 'local')
        provider_name = request.args.get('provider')
        model_type = request.args.get('model')
        fetch_past = request.args.get('past', 'false').lower() == 'true'

        logger.info(f"Deployment type: {deployment_type}, Provider: {provider_name}, Model: {model_type}, Fetch past: {fetch_past}")

        if fetch_past:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT model_name, provider_type, temperature, max_tokens, top_p, 
                           system_prompt, response_format, language, created_at
                    FROM ai_settings
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                ''', (user_id,))
                past_settings = cursor.fetchall()

                if not past_settings:
                    logger.info(f"No past AI settings found for user_id: {user_id}.")
                    return jsonify([]), 200

                return jsonify([{
                    "model_name": s[0],
                    "provider_type": s[1],
                    "temperature": s[2],
                    "max_tokens": s[3],
                    "top_p": s[4],
                    "system_prompt": s[5],
                    "response_format": s[6],
                    "language": s[7],
                    "created_at": s[8],
                } for s in past_settings]), 200
        else:
            provider_type = type_mapping.get(deployment_type)
            if not provider_type:
                logger.warning(f"Invalid deployment_type: {deployment_type}")
                return jsonify({"error": "Invalid deployment type"}), 400

            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT model_name, provider_type, temperature, max_tokens, top_p,
                           system_prompt, response_format, language, api_key_enc, api_endpoint
                    FROM ai_settings
                    WHERE user_id = ? 
                    AND deployment_type = ?
                    AND (provider_name = ? OR ? IS NULL)
                    AND (model_name = ? OR ? IS NULL)
                ''', (user_id, deployment_type, provider_name, provider_name, model_type, model_type))
                settings = cursor.fetchone()

                if not settings:
                    logger.info(f"No AI settings found for user_id: {user_id}, deployment_type: {deployment_type}.")
                    return jsonify({
                        "model_name": "phi:latest",
                        "provider_type": "Ollama",
                        "temperature": 0.7,
                        "max_tokens": 100,
                        "top_p": 0.9,
                        "system_prompt": "You are a helpful assistant.",
                        "response_format": "text",
                        "language": "en"
                    }), 200

                decrypted_api_key = decrypt_data(settings[8]) if settings[8] else None

                return jsonify({
                    "model_name": settings[0],
                    "provider_type": settings[1],
                    "temperature": settings[2],
                    "max_tokens": settings[3],
                    "top_p": settings[4],
                    "system_prompt": settings[5],
                    "response_format": settings[6],
                    "language": settings[7],
                    "api_key": decrypted_api_key,
                    "api_endpoint": settings[9]
                }), 200

    except Exception as e:
        logger.error(f"Error in /ai-settings endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": "An error occurred while fetching AI settings."}), 500


#END SETTINGS PART GET AI SETTINGS END






def validate_ai_settings(settings):
    """Validate required AI settings fields"""
    required = ['model_name', 'provider_type', 'temperature']
    if not all(key in settings for key in required):
        logger.error("Missing required AI settings fields")
        return False
    return True

@app.route('/past-ai-settings', methods=['GET'])
@session_required
def get_past_ai_settings(user_id):
    """Endpoint to fetch past AI settings for a user."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT model_name, provider_type, temperature, max_tokens, top_p, system_prompt, response_format, language, created_at
                FROM ai_settings
                WHERE user_id = ?
                ORDER BY created_at DESC
            ''', (user_id,))
            past_settings = cursor.fetchall()

            if not past_settings:
                logger.info(f"No past AI settings found for user_id: {user_id}.")
                return jsonify([]), 200

            formatted_settings = []
            for setting in past_settings:
                formatted_settings.append({
                    "model_name": setting[0],
                    "provider_type": setting[1],
                    "temperature": setting[2],
                    "max_tokens": setting[3],
                    "top_p": setting[4],
                    "system_prompt": setting[5],
                    "response_format": setting[6],
                    "language": setting[7],
                    "created_at": setting[8],
                })

            logger.info(f"Fetched past AI settings for user_id: {user_id}")
            return jsonify(formatted_settings), 200
    except Exception as e:
        logger.error(f"Error fetching past AI settings: {e}")
        return jsonify({"error": "An error occurred while fetching past AI settings."}), 500


@app.route('/get-ai-settings-direct', methods=['GET', 'OPTIONS'])
@session_required
def get_ai_settings_direct(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT model_name, provider_type, temperature, max_tokens, top_p, system_prompt, response_format, language, api_key, api_endpoint
                FROM ai_settings
                WHERE user_id = ?
            ''', (user_id,))
            settings = cursor.fetchall()

            if not settings:
                logger.info(f"No AI settings found for user_id: {user_id}. Returning empty list.")
                return jsonify([])

            logger.info(f"AI settings fetched for user_id: {user_id}")
            return jsonify(settings)
    except Exception as e:
        logger.error(f"Error in /get-ai-settings-direct endpoint: {e}")
        return jsonify({"error": str(e)}), 500


# SAVE SETTINGS PART


@app.route('/ai-settings', methods=['POST', 'OPTIONS'])
@session_required
def save_ai_settings(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        deployment_type = data.get('deployment', 'local')
        provider_name = data.get('provider')
        settings = data.get('settings')

        if not settings:
            return error_response("Settings are required.", 400)

        # Validate required fields
        required_fields = ['model_name', 'provider_type', 'temperature', 'max_tokens', 'system_prompt']
        if not all(key in settings for key in required_fields):
            return error_response("Missing required fields in AI settings.", 400)

        # Validate deployment type
        if deployment_type not in {'local', 'internet', 'hybrid'}:
            return error_response("Invalid deployment type.", 400)

        # Validate provider type
        if settings['provider_type'] not in {'Ollama', 'Internet', 'Hybrid'}:
            return error_response("Invalid provider type.", 400)

        # Encrypt API key if provided
        if 'api_key' in settings and settings['api_key']:
            settings['api_key'] = encrypt_data(settings['api_key'])

        # Save settings to the database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO ai_settings 
                (user_id, model_name, provider_type, deployment_type, provider_name, temperature, max_tokens, top_p, 
                 system_prompt, response_format, language, api_key_enc, api_endpoint)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                settings.get('model_name'),
                settings.get('provider_type'),
                deployment_type,
                provider_name,
                settings.get('temperature'),
                settings.get('max_tokens'),
                settings.get('top_p', 0.9),  # Default value for top_p
                settings.get('system_prompt'),
                settings.get('response_format', 'text'),  # Default value for response_format
                settings.get('language', 'en'),  # Default value for language
                settings.get('api_key', ''),  # Optional API key
                settings.get('api_endpoint', '')  # Optional API endpoint
            ))
            conn.commit()

        return jsonify({"status": "success"}), 200
    except Exception as e:
        logger.error(f"Error saving AI settings: {e}")
        return error_response("An error occurred while saving AI settings.", 500)

# END SAVE SETTINGS PART
# END SETTINGS PART




VALID_DEPLOYMENT_TYPES = {'local', 'internet', 'hybrid'}
VALID_PROVIDER_NAMES = {'Ollama', 'Internet', 'Hybrid'}



def validate_ai_settings(settings):
    """Validate AI settings before saving to the database."""
    required_fields = ['model_name', 'provider_type', 'temperature', 'max_tokens', 'system_prompt']
    if not all(key in settings for key in required_fields):
        return False

    # Validate temperature and max_tokens are numbers
    if not isinstance(settings['temperature'], (int, float)) or not isinstance(settings['max_tokens'], int):
        return False

    # Validate deployment type
    if settings.get('deployment_type') and settings['deployment_type'] not in {'local', 'internet', 'hybrid'}:
        return False

    # Validate provider type
    if settings.get('provider_type') and settings['provider_type'] not in {'Ollama', 'Internet', 'Hybrid'}:
        return False

    return True





@app.route('/search-memories', methods=['POST', 'OPTIONS'])
@session_required
@limiter.limit("10 per minute")
def search_memories(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        query = data.get('query')

        if not query:
            logger.warning("Invalid request: Search query is required.")
            return jsonify({"error": "Search query is required."}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT content FROM memories
                WHERE user_id = ? AND content LIKE ?
            ''', (user_id, f'%{query}%'))
            results = cursor.fetchall()

        logger.info(f"Search results for query '{query}': {results}")
        return jsonify({"results": [result[0] for result in results]}), 200

    except Exception as e:
        logger.error(f"Error in /search-memories endpoint: {e}")
        return jsonify({"error": "An error occurred while searching memories."}), 500




@app.route('/store-message', methods=['POST', 'OPTIONS'])
@session_required
def store_message(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        logger.info(f"Received request to store message: {data}")

        sender = data.get('sender')
        content = data.get('content')
        thread_id = data.get('thread_id')
        read_status = data.get('read_status', 'unread')

        if not sender or not content:
            logger.warning("Invalid request: Sender and content are required.")
            return jsonify({"error": "Sender and content are required."}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO memories (user_id, memory_type, content, tags, privacy_level, expiry_days, read_status, thread_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, 'chat', content, '', 'public', 7, read_status, thread_id))
            conn.commit()
            memory_id = cursor.lastrowid

        logger.info(f"Message stored with ID: {memory_id}")
        return jsonify({"status": "success", "memory_id": memory_id}), 200

    except Exception as e:
        logger.error(f"Error storing message: {e}")
        return jsonify({"error": "An error occurred while storing the message."}), 500

def save_memory(user_id, memory_data):
    """Original memory saving logic with validation"""
    required_fields = ['memory_type', 'content']
    if not all(field in memory_data for field in required_fields):
        raise ValueError("Missing required memory fields")
        
    if memory_data['memory_type'] not in ['chat', 'file', 'url', 'note']:
        raise ValueError("Invalid memory type")
        
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO memories (
                    user_id, memory_type, content, tags,
                    privacy_level, expiry_days, thread_id,
                    associated_files, embedding
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    user_id,
                    memory_data['memory_type'],
                    memory_data['content'],
                    memory_data.get('tags', ''),
                    memory_data.get('privacy_level', 'private'),
                    memory_data.get('expiry_days', 30),
                    memory_data.get('thread_id', ''),
                    memory_data.get('associated_files', ''),
                    memory_data.get('embedding', '')
                )
            )
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"Memory save failed: {e}")
        raise

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (CSS, JS, images, etc.) from the frontend directory."""
    logger.info(f"Serving static file: {path}")
    response = send_from_directory('../frontend', path)
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response

def allowed_file(filename):
    """Original file validation"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/upload', methods=['POST', 'OPTIONS'])
@session_required
def upload_file(user_id):
    """Original file upload logic"""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()
        
    if 'file' not in request.files:
        return error_response("No file uploaded", 400)
        
    file = request.files['file']
    if file.filename == '':
        return error_response("Empty filename", 400)
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        memory_data = {
            'memory_type': 'file',
            'content': filename,
            'associated_files': filepath
        }
        memory_id = save_memory(user_id, memory_data)
        
        return jsonify({
            "status": "success",
            "memory_id": memory_id,
            "filepath": filepath
        })
        
    return error_response("Invalid file type", 400)

@app.route('/save-theme', methods=['POST'])
@session_required
def save_theme(user_id):
    data = request.json
    theme = data.get('theme')
    if not theme:
        return error_response("Theme is required.", 400)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET theme = ? WHERE id = ?', (theme, user_id))
        conn.commit()

    return jsonify({"status": "success"})

@app.route('/get-theme', methods=['GET'])
@session_required
def get_theme(user_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT theme FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()

        if not user:
            return error_response("User not found.", 404)

        theme = user['theme'] or 'light'
        return jsonify({"theme": theme})

@app.route('/available-models', methods=['GET'])
@session_required
def get_available_models(user_id):
    """Original model listing logic"""
    try:
        local_models = requests.get("http://localhost:11434/api/tags").json()['models']
        internet_models = ["gpt-4", "gpt-3.5-turbo"]
        
        return jsonify({
            "local": [m['name'] for m in local_models],
            "internet": internet_models
        })
    except Exception as e:
        logger.error(f"Model fetch failed: {e}")
        return error_response("Model retrieval error", 500)

def cleanup_job():
    """Original maintenance tasks"""
    logger.info("Running cleanup tasks...")
    
    with get_db_connection() as conn:
        now = datetime.now()
        
        conn.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
        
        conn.execute('''
            DELETE FROM memories 
            WHERE expiry_days > 0 AND 
                  datetime(created_at, '+' || expiry_days || ' days') < ?''',
            (now,)
        )
        
        conn.execute('''
            SELECT associated_files FROM memories
            WHERE memory_type = 'file'
        ''')
        valid_files = [row[0] for row in conn.fetchall()]
        
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            full_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if full_path not in valid_files:
                os.remove(full_path)
                
        conn.commit()

scheduler.add_job(
    cleanup_job,
    'interval',
    hours=6,
    next_run_time=datetime.now() + timedelta(minutes=10)
)

if __name__ == '__main__':
    logger.info("Starting Flask application...")
    app.run(
        host='0.0.0.0',
        port=5001,
        ssl_context=('certs/backend-cert.pem', 'certs/backend-key.pem')
    )