# app.py
from flask import Flask, request, jsonify, send_from_directory, Response, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
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

# Import authentication functions from auth.py
from auth import hash_password, verify_password, validate_email, get_db_connection, authenticate_user, error_response, session_required

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Set the secret key for session management
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'fallback-secret-key')  # Use environment variable or fallback

app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent client-side (JavaScript?) access to cookies
app.config['SESSION_COOKIE_SECURE'] = True  # Set to True for HTTPS
app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Allow cross-origin cookies
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)  # Set session lifetime
app.config['SESSION_PERMANENT'] = True   # Make sessions permanent

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# WebSocket server URL
WEBSOCKET_SERVER_URL = "ws://localhost:5003"

# Database file path
DATABASE = os.getenv('DATABASE_PATH', 'memory_db/personavault.db')

# Initialize SQLAlchemy engine and session
engine = create_engine(f"sqlite:///{DATABASE}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Initialize scheduler for background tasks
scheduler = BackgroundScheduler()
scheduler.start()

# Configure CORS to allow the frontend origin, methods, and headers.
CORS(
    app,
    resources={r"/*": {
        "origins": "https://localhost:5173",  # Allow only the frontend origin
        "methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],  # Add all necessary methods
        "allow_headers": ["Content-Type", "Authorization"],  # Allow necessary headers
        "supports_credentials": True,  # Allow cookies to be sent
    }}
)

# Register SQLite3 adapters for datetime objects
sqlite3.register_adapter(datetime, lambda dt: dt.isoformat())
sqlite3.register_converter("datetime", lambda ts: datetime.fromisoformat(ts.decode()))

# Initialize database and uploads folder
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
                theme TEXT DEFAULT 'light'  -- Add this line
            )
        ''')

        # Create sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                expires_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        # Create ai_settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ai_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                model_type TEXT,
                model_description TEXT,
                api_key TEXT,
                api_endpoint TEXT,
                temperature REAL DEFAULT 0.7,
                max_tokens INTEGER DEFAULT 100,
                top_p REAL DEFAULT 0.9,
                system_prompt TEXT,
                response_format TEXT,
                language TEXT,
                privacy_level TEXT,
                tags TEXT,
                expiry_days INTEGER,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                presence_penalty REAL,          -- New column
                frequency_penalty REAL,         -- New column
                user_context TEXT,              -- New column
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')

        # Add indexes for frequently queried columns
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_memory_type ON memories(memory_type);')

        conn.commit()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise

# Initialize the database
init_db()

# WebSocket connection handler
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
                    # Broadcast the message to all connected clients
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

# Function to start the WebSocket server
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

# Start the WebSocket server in a separate thread
websocket_thread = Thread(target=start_websocket_server, daemon=True)
websocket_thread.start()

# Endpoint to create a new session
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

        session_id = str(uuid.uuid4())  # Generate a unique session ID
        expires_at = datetime.now() + timedelta(days=1)  # Set session expiry time

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO sessions (session_id, expires_at) VALUES (?, ?)', (session_id, expires_at))
            conn.commit()

        logger.info(f"Session created: {session_id}")
        # Set an httpOnly cookie with the session ID
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,  # Prevent client-side JavaScript from accessing the cookie
            secure=True,    # Ensure the cookie is only sent over HTTPS
            samesite='Lax',  # Allow cross-origin cookies (lax, none, strict, etc.)
            path='/'  # Make the cookie available across all paths
        )

        return response
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return error_response("An error occurred while creating the session.", 500)

# Endpoint to join an existing session
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

# Endpoint to check the health of the backend
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

# Serve the frontend index.html file
@app.route('/')
def serve_index():
    """Serve the frontend index.html file when the root path is accessed."""
    logger.info("Serving index.html")
    return send_from_directory('../frontend', 'index.html')

# User registration endpoint
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
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response
    except sqlite3.IntegrityError:
        logger.error(f"Username '{username}' already exists.")
        return error_response("Username already exists", 400)
    except Exception as e:
        logger.error(f"Error in /register endpoint: {e}")
        return error_response("An error occurred during registration.", 500)

# User login endpoint
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

            # Delete all existing sessions for the user
            cursor.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
            conn.commit()

            # Create a new session
            session_id = str(uuid.uuid4())
            expires_at = datetime.now() + timedelta(hours=1)

            cursor.execute('INSERT INTO sessions (user_id, session_id, expires_at) VALUES (?, ?, ?)', (user_id, session_id, expires_at))
            conn.commit()

        logger.info(f"Login successful: User '{username}' logged in.")
        # Set an httpOnly cookie with the session ID
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,
            secure=True,  # Use secure cookies in production
            samesite='None'  # Allow cross-origin cookies
        )
        return response, 200
    except Exception as e:
        logger.error(f"Error in /login endpoint: {e}")
        return jsonify({"error": "An error occurred during login."}), 500

# Endpoint to validate a session
@app.route('/validate-session', methods=['POST'])
def validate_session():
    """Endpoint to validate a user's session."""
    try:
        session_id = request.cookies.get('session_id')  # Retrieve session ID from cookies
        if not session_id:
            logger.warning("Unauthorized request: No session ID provided.")
            return jsonify({"error": "Unauthorized: No session ID provided."}), 401

        # Validate session ID (implement authenticate_user logic)
        user_id = authenticate_user(session_id)
        if not user_id:
            logger.warning("Unauthorized request: Invalid session ID.")
            return jsonify({"error": "Unauthorized: Invalid or expired session."}), 401

        # Fetch user data from the database
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

# Endpoint to log out a user and delete the session
@app.route('/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Endpoint to log out a user and delete the session."""
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        session_id = request.cookies.get('session_id')  # Retrieve session ID from cookies
        if not session_id:
            logger.warning("Unauthorized request: No session ID provided.")
            return error_response("Unauthorized", 401)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
            conn.commit()

        logger.info(f"Logout successful: Session '{session_id}' deleted.")
        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response
    except Exception as e:
        logger.error(f"Error in /logout endpoint: {e}")
        return error_response("An error occurred during logout.", 500)

# Endpoint to log out all sessions for the user
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
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response
    except Exception as e:
        logger.error(f"Error in /logout-all endpoint: {e}")
        return error_response("An error occurred during logout.", 500)

# Endpoint to fetch user profile
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

# Endpoint to update user profile
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
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response
    except Exception as e:
        logger.error(f"Error in /profile endpoint: {e}")
        return error_response("An error occurred while updating the profile.", 500)

# Endpoint to change ai settings
@app.route('/ai-settings', methods=['GET'])
@session_required
def get_ai_settings(user_id):
    logger.info(f"Incoming request to /ai-settings with method: {request.method}")
    
    # Log session and cookies for debugging purposes
    logger.debug(f"Session: {session}")
    logger.debug(f"Cookies: {request.cookies}")
    logger.info(f"Fetching AI settings for user_id: {user_id}")

    # Ensure user_id is extracted correctly from session or cookie
    if not user_id:
        logger.error("user_id not found in session or cookie!")
        return jsonify({"error": "Authentication failed. Please login again."}), 401

    logger.info(f"Fetched user_id: {user_id} from session or cookie.")
    
    if request.method == 'OPTIONS':
        logger.info("OPTIONS request received. Sending default response.")
        return app.make_default_options_response()

    try:
        # Get 'type' parameter from query string (default is 'local') or 'past' for past settings
        model_type = request.args.get('type', 'local')
        fetch_past = request.args.get('past', 'false').lower() == 'true'

        if fetch_past:
            # Fetch past AI settings for the user
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT model_name, model_type, temperature, max_tokens, top_p, system_prompt, response_format, language, created_at
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
                        "model_type": setting[1],
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
        else:
            # Fetch current AI settings based on 'model_type'
            logger.info(f"Fetching AI settings for user_id: {user_id}, type: {model_type}")
            
            if model_type not in ['local', 'internet']:
                logger.warning(f"Invalid model_type: {model_type}")
                return jsonify({"error": "Invalid model_type. Must be 'local' or 'internet'."}), 400

            with get_db_connection() as conn:
                if not conn:
                    logger.error("Failed to connect to the database.")
                    return jsonify({"error": "Database connection failed."}), 500

                cursor = conn.cursor()
                cursor.execute('''
                    SELECT model_name, model_type, temperature, max_tokens, top_p, system_prompt, response_format, language, api_key, api_endpoint
                    FROM ai_settings
                    WHERE user_id = ? AND model_type = ?
                ''', (user_id, model_type))
                settings = cursor.fetchone()

                if not settings:
                    logger.info(f"No AI settings found for user_id: {user_id} and type: {model_type}. Returning default settings.")
                    return jsonify({
                        "model_name": "phi:latest",
                        "model_type": "local",
                        "temperature": 0.7,
                        "max_tokens": 100,
                        "top_p": 0.9,
                        "system_prompt": "You are a helpful assistant.",
                        "response_format": "text",
                        "language": "en"
                    }), 200

                logger.info(f"AI settings fetched for user_id: {user_id} and type: {model_type}: {settings}")
                return jsonify({
                    "model_name": settings[0],
                    "model_type": settings[1],
                    "temperature": settings[2],
                    "max_tokens": settings[3],
                    "top_p": settings[4],
                    "system_prompt": settings[5],
                    "response_format": settings[6],
                    "language": settings[7],
                    "api_key": settings[8] if model_type == 'internet' else None,
                    "api_endpoint": settings[9] if model_type == 'internet' else None
                }), 200

    except Exception as e:
        logger.error(f"Error in /ai-settings endpoint: {e}")
        return jsonify({"error": "An error occurred while fetching AI settings."}), 500



# past-ai-settings endpoint

@app.route('/past-ai-settings', methods=['GET'])
@session_required
def get_past_ai_settings(user_id):
    """Endpoint to fetch past AI settings for a user."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT model_name, model_type, temperature, max_tokens, top_p, system_prompt, response_format, language, created_at
                FROM ai_settings
                WHERE user_id = ?
                ORDER BY created_at DESC
            ''', (user_id,))
            past_settings = cursor.fetchall()

            if not past_settings:
                logger.info(f"No past AI settings found for user_id: {user_id}.")
                return jsonify([]), 200

            # Format the response
            formatted_settings = []
            for setting in past_settings:
                formatted_settings.append({
                    "model_name": setting[0],
                    "model_type": setting[1],
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



# Endpoint to POST AI settings
@app.route('/ai-settings', methods=['POST', 'OPTIONS'])
@session_required
def save_ai_settings(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        model_type = data.get('type')
        settings = data.get('settings')

        if not model_type or not settings:
            return error_response("Model type and settings are required.", 400)

        if not validate_ai_settings(settings):
            return error_response("Invalid AI settings.", 400)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO ai_settings 
                (user_id, model_name, model_type, temperature, max_tokens, top_p, system_prompt, response_format, language, api_key, api_endpoint)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                settings.get('model_name'),
                model_type,
                settings.get('temperature'),
                settings.get('max_tokens'),
                settings.get('top_p'),
                settings.get('system_prompt'),
                settings.get('response_format'),
                settings.get('language'),
                settings.get('api_key'),
                settings.get('api_endpoint')
            ))
            conn.commit()

        response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response
    except Exception as e:
        logger.error(f"Error saving AI settings: {e}")
        return error_response("An error occurred while saving AI settings.", 500)






# Endpoint to GET AI settings directly from DB
@app.route('/get-ai-settings-direct', methods=['GET', 'OPTIONS'])
@session_required
def get_ai_settings_direct(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT model_name, model_type, temperature, max_tokens, top_p, system_prompt, response_format, language, api_key, api_endpoint
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

# Endpoint to chat with the AI model
@app.route('/chat', methods=['POST', 'OPTIONS'])
@session_required
@limiter.limit("10 per minute")
def chat(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        logger.info(f"Received chat request from user_id: {user_id}, payload: {data}")

        if not data or not data.get('message'):
            logger.warning("Invalid chat request: Missing message.")
            return jsonify({"error": "Message is required."}), 400

        # Fetch AI settings for the user
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT model_name, model_type, api_key, api_endpoint, temperature, max_tokens, top_p, system_prompt, response_format, language
                FROM ai_settings
                WHERE user_id = ?
            ''', (user_id,))
            settings = cursor.fetchone()

            if not settings:
                logger.error(f"AI settings not found for user_id: {user_id}")
                return jsonify({"error": "AI settings not found."}), 404

            model_name, model_type, api_key, api_endpoint, temperature, max_tokens, top_p, system_prompt, response_format, language = settings
            logger.info(f"Fetched AI settings for user_id {user_id}: {settings}")

        # Prepare the payload for the AI model
        payload = {
            "model": model_name or 'phi:latest',
            "messages": [
                {
                    "role": "user",
                    "content": data.get('message')
                }
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "system_prompt": system_prompt,
            "response_format": response_format,
            "language": language
        }

        # Send the request to the AI model
        if model_type == 'local':
            ollama_url = "http://localhost:11434/api/chat"
            logger.info(f"Sending payload to local AI model: {payload}")

            response = requests.post(ollama_url, json=payload, stream=True, timeout=30)
            response.raise_for_status()

            # Process the streaming response
            ai_response = ""
            for line in response.iter_lines():
                if line:
                    try:
                        json_object = json.loads(line.decode('utf-8'))
                        if json_object.get("message", {}).get("content"):
                            ai_response += json_object["message"]["content"]
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON object: {e}")
                        continue

            logger.info(f"AI response: {ai_response}")
        elif model_type == 'api':
            headers = {"Authorization": f"Bearer {api_key}"}
            logger.info(f"Sending payload to external API: {payload}")
            response = requests.post(api_endpoint, json=payload, headers=headers, timeout=10)
            ai_response = response.json().get("response", "No response from AI.")
        else:
            logger.error(f"Invalid model type: {model_type}")
            return jsonify({"error": "Invalid model type."}), 400

        if response.status_code != 200:
            logger.error(f"Failed to get response from AI model. Status: {response.status_code}, Response: {response.text}")
            return jsonify({"error": "Failed to get response from AI model."}), 500

        # Save the memory
        memory_id = save_memory(
            user_id=user_id,
            memory_type='chat',
            content=data.get('message'),
            tags=data.get('tags', ''),
            privacy_level=data.get('privacy_level', 'public'),
            expiry_days=data.get('expiry_days', 7)
        )

        logger.info(f"Memory saved with ID: {memory_id}")

        # Return the AI's response
        return jsonify({"response": {"content": ai_response}})

    except Exception as e:
        logger.error(f"Error in /chat endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": "An error occurred while processing the chat."}), 500

# Endpoint to search memories
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

# Endpoint to store a chat message in the memories table
@app.route('/store-message', methods=['POST', 'OPTIONS'])
@session_required
def store_message(user_id):
    if request.method == 'OPTIONS':
        return app.make_default_options_response()

    try:
        data = request.json
        logger.info(f"Received request to store message: {data}")

        sender = data.get('sender')  # 'user' or 'bot'
        content = data.get('content')
        thread_id = data.get('thread_id')
        read_status = data.get('read_status', 'unread')

        if not sender or not content:
            logger.warning("Invalid request: Sender and content are required.")
            return jsonify({"error": "Sender and content are required."}), 400

        # Save the message to the memories table
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

# Serve static files (CSS, JS, images, etc.)
@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (CSS, JS, images, etc.) from the frontend directory."""
    logger.info(f"Serving static file: {path}")
    response = send_from_directory('../frontend', path)
    response.headers['Cache-Control'] = 'public, max-age=3600'  # Cache for 1 hour
    return response



# user themes and preferences 
# SAVE THEME: user themes and preferences (first try to be saved to db or localstorage)
@app.route('/save-theme', methods=['POST'])
@session_required
def save_theme(user_id):
    data = request.json
    theme = data.get('theme')
    if not theme:
        return error_response("Theme is required.", 400)

    # Save the theme to the database (e.g., update the user's preferences)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET theme = ? WHERE id = ?', (theme, user_id))
        conn.commit()

    return jsonify({"status": "success"})

# GET THEME: user themes and preferences (first try to be saved to db or localstorage)

@app.route('/get-theme', methods=['GET'])
@session_required
def get_theme(user_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT theme FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()

        if not user:
            return error_response("User not found.", 404)

        theme = user['theme'] or 'light'  # Default to 'light' if no theme is set
        return jsonify({"theme": theme})







# SECTION ON SETTINGS WIDGET
# Create a new endpoint /available-models that returns a list of available models installed locally
@app.route('/available-models', methods=['GET'])
@session_required
def get_available_models(user_id):
    """Endpoint to fetch available AI models."""
    try:
        # Example: Return a list of available models
        available_models = ['phi:latest', 'gpt-3.5-turbo', 'gpt-4']
        return jsonify({"available_models": available_models}), 200
    except Exception as e:
        logger.error(f"Error fetching available models: {e}")
        return jsonify({"error": "An error occurred while fetching available models."}), 500



# this is the final code (end of the file)
# Run the app
if __name__ == '__main__':
    logger.info("Starting Flask application...")
    app.run(
        host='0.0.0.0',
        port=5001,
        ssl_context=('certs/backend-cert.pem', 'certs/backend-key.pem')  # path is verified
    )

