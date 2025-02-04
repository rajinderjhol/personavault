# auth.py
import os
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta
import sqlite3
from functools import wraps
from flask import jsonify, request
import logging
from contextlib import contextmanager
import re  # Moved to the top for better organization

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database file path
DATABASE = os.getenv('DATABASE_PATH', 'memory_db/personavault.db')

# Helper function to hash passwords
def hash_password(password):
    """Hash a password using bcrypt."""
    if isinstance(password, bytes):
        password = password.decode('utf-8')  # Convert bytes to string if necessary
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Helper function to verify passwords
def verify_password(password, password_hash):
    """Verify password with enhanced error handling"""
    try:
        if not password or not password_hash:
            logger.error("Missing password or hash")
            return False
            
        password_bytes = password.encode('utf-8') if isinstance(password, str) else password
        hash_bytes = password_hash.encode('utf-8') if isinstance(password_hash, str) else password_hash
        
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception as e:
        logger.error(f"Password verification failed: {str(e)}")
        return False



# Validate email format
def validate_email(email):
    """Validate an email address using regex."""
    if not email:
        return False
    return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

# Context manager for database connections
@contextmanager
def get_db_connection():
    """Provide a database connection as a context manager."""
    conn = None
    try:
        logger.debug("Opening database connection...")
        conn = sqlite3.connect(DATABASE, detect_types=sqlite3.PARSE_DECLTYPES, timeout=10)
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        
        # Health check
        conn.execute("SELECT 1").fetchone()
        
        conn.execute("BEGIN")  # Start a transaction
        logger.debug("Database connection opened and transaction started.")
        yield conn
        conn.commit()  # Commit the transaction if no errors occur
        logger.debug("Transaction committed.")
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        if conn:
            logger.debug("Rolling back transaction due to error.")
            conn.rollback()  # Rollback the transaction on error
        raise
    finally:
        if conn:
            logger.debug("Closing database connection.")
            conn.close()


# Authentication middleware

def authenticate_user(session_id):
    """Authenticate a user based on their session ID."""
    logger.info(f"Authenticating session: {session_id}")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT user_id, expires_at FROM sessions WHERE session_id = ?',
                (session_id,)
            )
            session = cursor.fetchone()
            
            if session:
                user_id, expires_at = session[0], session[1]
                
                # Check if expires_at is a string. If so, parse it; otherwise, assume it's already a datetime.
                if isinstance(expires_at, str):
                    expires_at_dt = datetime.strptime(expires_at, "%Y-%m-%d %H:%M:%S.%f")
                else:
                    expires_at_dt = expires_at

                current_time = datetime.now(timezone.utc)
                logger.info(f"📌 Current Time (UTC): {current_time}")
                logger.info(f"🕒 Session Expires At: {expires_at_dt}")

                if expires_at_dt > current_time:
                    logger.info(f"✅ Session validated for user_id: {user_id}")
                    return user_id
                else:
                    logger.warning(f"❌ Session expired at {expires_at_dt}")
            else:
                logger.warning(f"❌ No session found for ID: {session_id}")

    except Exception as e:
        logger.error(f"Error in authenticate_user: {e}")

    return None


# Standardized error response format
def error_response(message, status_code):
    """Return a standardized error response with a message and status code."""
    return jsonify({"error": message}), status_code

# Decorator for session validation
def session_required(f):
    """Decorator to validate the session for protected endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_id = request.cookies.get('session_id')  # Read session_id from cookies
        logger.info(f"🔍 Received session_id: {session_id}")

        if not session_id:
            logger.warning("❌ Unauthorized request: No session ID provided.")
            return error_response("Unauthorized: No session ID provided.", 401)

        user_id = authenticate_user(session_id)
        if not user_id:
            logger.warning(f"❌ Unauthorized request: Invalid session ID: {session_id}")
            return error_response("Unauthorized: Invalid or expired session.", 401)

        return f(user_id, *args, **kwargs)

    return decorated_function
