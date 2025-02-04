

# ollama_service.py

import requests
from flask import jsonify

# Ollama API base URL
OLLAMA_API_BASE_URL = "http://localhost:11434"

def fetch_models():
    """
    Fetch available models from the Ollama server.
    
    Returns:
        - Response from the Ollama server.
    """
    try:
        response = requests.get(f"{OLLAMA_API_BASE_URL}/api/tags", verify=False)
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()
    except requests.RequestException as e:
        return {"error": str(e)}

def save_ai_settings(user_id, payload):
    """
    Save AI settings to the database.
    
    Args:
        user_id (int): The ID of the user saving the settings.
        payload (dict): The AI settings payload.
    
    Returns:
        - Response indicating success or failure.
    """
    try:
        # Validate payload
        required_fields = ['profile_name', 'model_name', 'provider_type', 'deployment_type']
        if not all(field in payload for field in required_fields):
            return {"error": "Missing required fields"}, 400

        # Save to database (example using SQLite)
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO ai_settings (
                    user_id, profile_name, model_name, provider_type,
                    deployment_type, temperature, max_tokens, system_prompt,
                    api_key_enc, api_endpoint
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                payload['profile_name'],
                payload['model_name'],
                payload['provider_type'],
                payload['deployment_type'],
                payload.get('temperature', 0.7),
                payload.get('max_tokens', 100),
                payload.get('system_prompt', ''),
                payload.get('api_key', ''),
                payload.get('api_endpoint', '')
            ))
            conn.commit()
        
        return {"status": "success"}, 200
    except Exception as e:
        return {"error": str(e)}, 500

def fetch_past_settings(user_id):
    """
    Fetch past AI settings for a user.
    
    Args:
        user_id (int): The ID of the user.
    
    Returns:
        - List of past settings.
    """
    try:
        with sqlite3.connect(DATABASE) as conn:
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
            
            return results, 200
    except Exception as e:
        return {"error": str(e)}, 500

def delete_ai_settings(user_id, setting_id):
    """
    Delete AI settings for a user.
    
    Args:
        user_id (int): The ID of the user.
        setting_id (int): The ID of the setting to delete.
    
    Returns:
        - Response indicating success or failure.
    """
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                DELETE FROM ai_settings 
                WHERE id = ? AND user_id = ?
            ''', (setting_id, user_id))
            conn.commit()
        
        return {"status": "success"}, 200
    except Exception as e:
        return {"error": str(e)}, 500



def send_chat_message(payload):
    """
    Send a chat message to the Ollama server.
    
    Args:
        payload (dict): The chat message payload.
    
    Returns:
        - Response from the Ollama server.
    """
    try:
        response = requests.post(f"{OLLAMA_API_BASE_URL}/api/chat", json=payload, verify=False)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"error": str(e)}

def fetch_model_details(model_name):
    """
    Fetch details about a specific model from the Ollama server.
    
    Args:
        model_name (str): The name of the model.
    
    Returns:
        - Response from the Ollama server.
    """
    try:
        response = requests.get(f"{OLLAMA_API_BASE_URL}/api/models/{model_name}", verify=False)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"error": str(e)}