#!/bin/bash

# Define project directory
PROJECT_DIR="/Users/raj/Documents/software/personavault"

# Create project folder
mkdir -p "$PROJECT_DIR/backend"
mkdir -p "$PROJECT_DIR/frontend"
mkdir -p "$PROJECT_DIR/backend/memory_db"
mkdir -p "$PROJECT_DIR/backend/uploads"

# Navigate to the backend folder
cd "$PROJECT_DIR/backend"

# Create backend files
cat > app.py <<EOL
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
import uuid
from memory_manager import save_memory, get_memories
from file_manager import save_file

app = Flask(__name__)
CORS(app)

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

        # Simulate AI response using Ollama API
        ai_response = "This is a sample AI response based on your input: " + user_input

        # Save memory
        memory_id = save_memory(user_id, 'chat', user_input, 'general')

        return jsonify({"response": ai_response, "memory_id": memory_id})
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

# Endpoint: /upload
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

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

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error starting Flask server: {e}")
EOL

cat > memory_manager.py <<EOL
import sqlite3
import uuid

def save_memory(user_id, memory_type, content, tags):
    try:
        memory_id = str(uuid.uuid4())
        conn = sqlite3.connect("memory_db/personavault.db")
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO memories (id, user_id, memory_type, content, tags)
            VALUES (?, ?, ?, ?, ?)
        ''', (memory_id, user_id, memory_type, content, tags))
        conn.commit()
        conn.close()
        return memory_id
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

def get_memories(user_id):
    try:
        conn = sqlite3.connect("memory_db/personavault.db")
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM memories WHERE user_id = ?', (user_id,))
        memories = cursor.fetchall()
        conn.close()
        return memories
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
EOL

cat > file_manager.py <<EOL
import os
import uuid

def save_file(file):
    try:
        file_id = str(uuid.uuid4())
        file_path = os.path.join("uploads", file_id + "_" + file.filename)
        os.makedirs("uploads", exist_ok=True)
        file.save(file_path)
        return file_id
    except Exception as e:
        print(f"Error saving file: {e}")
        raise
EOL

cat > requirements.txt <<EOL
Flask==2.3.2
Flask-CORS==3.0.10
uuid==1.30
EOL

# Navigate to the frontend folder
cd "$PROJECT_DIR/frontend"

# Create frontend files
cat > index.html <<EOL
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PersonaVault</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <div class="sidebar left-sidebar">
            <button id="toggle-left">☰</button>
            <ul>
                <li><a href="#">Chat History</a></li>
                <li><a href="#">Settings</a></li>
                <li><a href="#">Help</a></li>
            </ul>
        </div>
        <div class="chat-interface">
            <div id="chat-window"></div>
            <div class="input-area">
                <input type="text" id="chat-input" placeholder="Type a message...">
                <button id="send-btn">Send</button>
            </div>
        </div>
        <div class="sidebar right-sidebar">
            <button id="toggle-right">☰</button>
            <div class="profile">
                <h3>User Profile</h3>
                <p>Name: John Doe</p>
            </div>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>
EOL

cat > styles.css <<EOL
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #1e1e1e;
    color: #ffffff;
}

.container {
    display: flex;
    height: 100vh;
}

.sidebar {
    width: 250px;
    background-color: #2d2d2d;
    padding: 10px;
    transition: width 0.3s;
}

.sidebar.collapsed {
    width: 50px;
}

.chat-interface {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #1e1e1e;
}

#chat-window {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
}

.input-area {
    display: flex;
    padding: 10px;
    background-color: #2d2d2d;
}

#chat-input {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 5px;
    margin-right: 10px;
}

#send-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    background-color: #4CAF50;
    color: white;
    cursor: pointer;
}

#send-btn:hover {
    background-color: #45a049;
}
EOL

cat > script.js <<EOL
document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage('user', message);
            chatInput.value = '';
            fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, user_id: 'default_user' })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                addMessage('ai', data.response);
            })
            .catch(error => {
                console.error('Error:', error);
                addMessage('error', 'Failed to send message. Please try again.');
            });
        }
    }

    function addMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : sender === 'error' ? 'error-message' : 'ai-message';
        messageDiv.textContent = message;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});
EOL

# Navigate back to the backend folder
cd "$PROJECT_DIR/backend"

# Set up virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Initialize the database
python3 app.py &
BACKEND_PID=$!

# Wait for the backend to start
sleep 5

# Open the frontend in the default browser
open "$PROJECT_DIR/frontend/index.html"

# Stop the backend process when the script exits
trap "kill $BACKEND_PID" EXIT