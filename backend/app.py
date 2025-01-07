from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
import uuid
import requests
from memory_manager import save_memory, get_memories
from file_manager import save_file

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for all routes

# Initialize database and uploads folder
def init_db():
    try:
        os.makedirs("memory_db", exist_ok=True)
        conn = sqlite3.connect("memory_db/personavault.db")
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                memory_type TEXT,
                content TEXT,
                tags TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

init_db()

# Endpoint: /chat
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        if not data or 'message' not in data:
            return jsonify({"error": "Invalid input: 'message' is required"}), 400

        user_input = data.get('message')
        user_id = data.get('user_id', 'default_user')

        # Call Ollama API with streaming
        ollama_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "llama2",  # Use the model you have installed (e.g., llama2)
            "prompt": user_input,
            "stream": True  # Enable streaming
        }

        # Stream the response from Ollama
        def generate():
            with requests.post(ollama_url, json=payload, stream=True) as r:
                for line in r.iter_lines():
                    if line:
                        yield line.decode('utf-8') + "\n"

        # Save memory
        memory_id = save_memory(user_id, 'chat', user_input, 'general')

        # Stream the response to the frontend
        return app.response_class(generate(), content_type='text/event-stream')
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Endpoint: /memory
@app.route('/memory', methods=['GET'])
def get_memory():
    try:
        user_id = request.args.get('user_id', 'default_user')
        memories = get_memories(user_id)
        return jsonify(memories)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# File upload configuration
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Endpoint: /upload
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400

        file.seek(0, os.SEEK_END)  # Move to the end of the file to get its size
        file_size = file.tell()  # Get the file size
        file.seek(0)  # Reset file pointer to the beginning

        if file_size > MAX_FILE_SIZE:
            return jsonify({"error": "File size exceeds limit"}), 400

        file_id = save_file(file)
        return jsonify({"file_id": file_id})
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# Serve frontend
@app.route('/')
def serve_frontend():
    try:
        return send_from_directory('../frontend', 'index.html')
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/<path:filename>')
def serve_static(filename):
    try:
        return send_from_directory('../frontend', filename)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5001)
    except Exception as e:
        print(f"Error starting Flask server: {e}")