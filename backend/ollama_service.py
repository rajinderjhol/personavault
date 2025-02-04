"""
Ollama Service Module

This module provides API endpoints for managing AI model settings and configurations
within a Flask application. It integrates with the Ollama API and includes features
for saving, retrieving, and managing AI settings profiles.
"""

from flask import Blueprint, request, jsonify, current_app
import requests
from auth import session_required
from extensions import db
from models import AISetting
import logging
from datetime import datetime

# Create a logger instance
logging.basicConfig(filename='backend.log', level=logging.DEBUG)


# Create Blueprint for Ollama-related routes
ollama_bp = Blueprint('ollama', __name__)


def validate_payload(payload: dict) -> None:
    print("Starting payload validation:", payload)  # Debugging
    
    # Define valid values for provider_type and deployment_type
    valid_provider_types = ['Ollama', 'Internet', 'Hybrid']
    valid_deployment_types = ['local', 'internet', 'hybrid']
    
    # Required fields check
    required_fields = ['profile_name', 'deployment_type', 'model_name']
    for field in required_fields:
        if field not in payload:
            print(f"ERROR: Missing required field: {field}")  # Debugging
            raise ValueError(f"Missing required field: {field}")
        else:
            print(f"✅ Field '{field}' found: {payload[field]}")  # Debugging
    
    # Handle provider_type if missing but provider exists
    if 'provider' in payload and 'provider_type' not in payload:
        print(f"⚠️ 'provider_type' missing, using 'provider': {payload['provider']}")  # Debugging
        payload['provider_type'] = payload['provider']
    
    # Validate provider_type
    if payload.get('provider_type') not in valid_provider_types:
        print(f"ERROR: Invalid provider_type: {payload.get('provider_type')}")  # Debugging
        raise ValueError(f"Invalid provider_type: {payload.get('provider_type')}")
    else:
        print(f"✅ Valid provider_type: {payload['provider_type']}")  # Debugging
    
    # Validate deployment_type
    if payload.get('deployment_type') not in valid_deployment_types:
        print(f"ERROR: Invalid deployment_type: {payload.get('deployment_type')}")  # Debugging
        raise ValueError(f"Invalid deployment_type: {payload.get('deployment_type')}")
    else:
        print(f"✅ Valid deployment_type: {payload['deployment_type']}")  # Debugging
    
    # Additional check for 'internet' deployment
    if payload['deployment_type'] == 'internet':
        if not payload.get('api_key') or not payload.get('api_endpoint'):
            print("ERROR: API credentials required for cloud deployment")  # Debugging
            raise ValueError("API credentials required for cloud deployment")
        else:
            print("✅ API credentials provided for cloud deployment")  # Debugging
    
    print("✅ Payload validation successful!")  # Debugging


# ############


def save_ai_settings(user_id: int, payload: dict) -> tuple:
    """
    Save AI settings to the database.
    
    Args:
        user_id (int): ID of the user saving the settings
        payload (dict): AI configuration settings to save
        
    Returns:
        tuple: (result dictionary, HTTP status code)
    """
    try:
        print("Saving AI settings for user:", user_id)  # Debugging
        validate_payload(payload)
        
        # Deactivate all other settings for this user. Ensure only one setting is active at a time by deactivating previous settings when saving a new one
        AISetting.query.filter_by(user_id=user_id, is_active=True).update({'is_active': False})

        new_setting = AISetting(
            user_id=user_id,
            profile_name=payload['profile_name'],
            provider_type=payload['provider_type'],
            deployment_type=payload['deployment_type'],
            model_name=payload['model_name'],
            model_description=payload.get('model_description', ''),
            api_key_enc=payload.get('api_key', ''),
            api_endpoint=payload.get('api_endpoint', ''),
            temperature=payload.get('temperature', 0.7),
            max_tokens=payload.get('max_tokens', 100),
            top_p=payload.get('top_p', 0.9),
            system_prompt=payload.get('system_prompt', ''),
            response_format=payload.get('response_format', ''),
            language=payload.get('language', ''),
            is_active=payload.get('is_active', True),
            embedding_model=payload.get('embedding_model', ''),
            fallback_model_name=payload.get('fallback_model_name', ''),
            fallback_provider_type=payload.get('fallback_provider_type', ''),
            presence_penalty=payload.get('presence_penalty', 0.0),
            frequency_penalty=payload.get('frequency_penalty', 0.0),
            user_context=payload.get('user_context', ''),
            privacy_level=payload.get('privacy_level', ''),
            tags=payload.get('tags', ''),
            expiry_days=payload.get('expiry_days', 0),
            provider_name=payload.get('provider_name', '')
        )

        db.session.add(new_setting)
        db.session.commit()
        print(f"Settings saved successfully: {new_setting.id}")  # Debugging
        return {"status": "success", "id": new_setting.id}, 200

    except ValueError as ve:
        db.session.rollback()
        current_app.logger.warning(f"Validation error for user {user_id}: {str(ve)}")
        return {"error": str(ve)}, 400
    except Exception as e:
        print("Error saving settings:", str(e))  # Debugging
        db.session.rollback()
        current_app.logger.error(f"Database error for user {user_id}: {str(e)}")
        return {"error": "Failed to save settings"}, 500

        

def fetch_current_settings(user_id: int) -> tuple:
    """
    Retrieve the currently active AI settings for a user.
    
    Args:
        user_id (int): ID of the user to fetch settings for
        
    Returns:
        tuple: (settings dictionary, HTTP status code)
    """
    try:
        print(f"Fetching settings for user {user_id}")  # Debugging
        setting = AISetting.query.filter_by(
            user_id=user_id, 
            is_active=True
        ).order_by(AISetting.created_at.desc()).first()

        if setting:
            print(f"Found setting: {setting.profile_name}")  # Debugging
            return {
                'id': setting.id,
                'profile_name': setting.profile_name,
                'provider_type': setting.provider_type,
                'model_name': setting.model_name,
                'temperature': setting.temperature,
                'max_tokens': setting.max_tokens,
                'system_prompt': setting.system_prompt,
                'api_endpoint': setting.api_endpoint
            }, 200

        # Return default settings if none found
        print("No active settings found")  # Debugging
        return {
            "id": None,
            "profile_name": "Default Profile",
            "provider_type": "Ollama",
            "model_name": "default",
            "temperature": 0.7,
            "max_tokens": 100,
            "system_prompt": "",
        }, 200

    except Exception as e:
        print(f"Database error: {str(e)}")  # Debugging
        current_app.logger.error(f"Database error for user {user_id}: {str(e)}")
        return {"error": "Failed to fetch settings"}, 500


def delete_ai_settings(user_id: int, setting_id: int) -> tuple:
    """
    Delete a specific AI settings entry.
    
    Args:
        user_id (int): ID of the user owning the settings
        setting_id (int): ID of the settings entry to delete
        
    Returns:
        tuple: (result dictionary, HTTP status code)
    """
    try:
        setting = AISetting.query.filter_by(
            id=setting_id, 
            user_id=user_id
        ).first()

        if not setting:
            return {"error": "Setting not found"}, 404

        db.session.delete(setting)
        db.session.commit()
        return {"status": "success"}, 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Delete error for user {user_id}: {str(e)}")
        return {"error": "Failed to delete settings"}, 500


# get models ---- 
@ollama_bp.route('/ollama/models', methods=['GET'])
@session_required
def get_models(user_id: int):
    try:
        # Add explicit timeout and better error handling
        response = requests.get(
            "http://localhost:11434/api/tags",
            timeout=3
        )
        response.raise_for_status()

        installed_models = response.json().get('models', [])
        if not installed_models:
            return jsonify({"error": "No models installed", "models": []}), 200

        model_list = [{
            "model_name": model['name'],
            "provider_type": "Ollama",
            "description": model.get('details', {}).get('family', 'Local model')
        } for model in installed_models]

        return jsonify({"models": model_list}), 200

    except requests.exceptions.ConnectionError:
        current_app.logger.error("Ollama service unreachable. Is it running?")
        return jsonify({
            "error": "Ollama service not running",
            "solution": "1. Install Ollama\n2. Run 'ollama serve'",
            "models": []
        }), 503
    except Exception as e:
        current_app.logger.error(f"Model fetch error: {str(e)}")
        return jsonify({"error": str(e), "models": []}), 500



@ollama_bp.route('/ollama/settings', methods=['POST'])
@session_required
def save_settings(user_id: int):
    """
    Endpoint for saving new AI settings configuration.
    
    Request Body:
        JSON object containing AI settings parameters
        
    Returns:
        JSON response with operation result
    """
    try:
        payload = request.get_json()
        result, status_code = save_ai_settings(user_id, payload)
        return jsonify(result), status_code
    except Exception as e:
        current_app.logger.error(f"Save settings error for user {user_id}: {str(e)}")
        return jsonify({"error": "Invalid request format"}), 400




@ollama_bp.route('/ollama/settings/current', methods=['GET'])
@session_required
def get_current_settings_route(user_id: int):
    """
    Endpoint to retrieve the current active AI settings.
    
    Returns:
        JSON response with current settings or defaults
    """
    try:
        print(f"Fetching current settings for user {user_id}")  # Debugging
        setting, status_code = fetch_current_settings(user_id)
        print(f"Settings fetched: {setting}")  # Debugging
        return jsonify(setting), status_code
    except Exception as e:
        current_app.logger.error(f"Settings fetch error for user {user_id}: {str(e)}")
        print(f"Error fetching settings: {str(e)}")  # Debugging
        return jsonify({"error": "Failed to retrieve settings"}), 500

# get past settings ----- 

@ollama_bp.route('/ollama/settings/past', methods=['GET'])
@session_required
def get_past_settings(user_id: int):
    try:
        print(f"Fetching past settings for user {user_id}")  # Debugging
        settings = AISetting.query.filter_by(
            user_id=user_id
        ).order_by(AISetting.created_at.desc()).all()
        
        if not settings:
            print(f"No past settings found for user {user_id}")  # Debugging
            return jsonify([]), 200  # Return empty list instead of error

        settings_list = [{
            "id": s.id,
            "profile_name": s.profile_name or "Unnamed Profile",
            "created_at": s.created_at.isoformat() if s.created_at else "Unknown"
        } for s in settings]

        print(f"Returning {len(settings_list)} past settings for user {user_id}")  # Debugging
        return jsonify(settings_list), 200

    except Exception as e:
        print(f"Error fetching past settings for user {user_id}: {str(e)}")  # Debugging
        return jsonify({"error": "Failed to retrieve history"}), 500


        
# get settings by id ----
@ollama_bp.route('/ollama/settings/<int:setting_id>', methods=['GET'])
@session_required
def get_setting(user_id: int, setting_id: int):
    try:
        setting = AISetting.query.filter_by(id=setting_id, user_id=user_id).first()
        if not setting:
            return jsonify({"error": "Setting not found"}), 404
        return jsonify({
            "id": setting.id,
            "profile_name": setting.profile_name,
            "deployment_type": setting.deployment_type,
            "provider_type": setting.provider_type,
            "model_name": setting.model_name,
            "temperature": setting.temperature,
            "max_tokens": setting.max_tokens,
            "system_prompt": setting.system_prompt,
            "api_endpoint": setting.api_endpoint
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



def test_connection(api_endpoint: str, api_key: str) -> tuple:
    try:
        # Example: Test OpenAI-like API
        headers = {"Authorization": f"Bearer {api_key}"}
        test_payload = {"messages": [{"role": "user", "content": "Hi"}]}
        response = requests.post(
            f"{api_endpoint}/chat/completions",
            headers=headers,
            json=test_payload,
            timeout=5
        )
        response.raise_for_status()
        return {"status": "Connection successful"}, 200
    except Exception as e:
        return {"error": str(e)}, 500





@ollama_bp.route('/ollama/test-connection', methods=['POST'])
@session_required
def test_api_connection(user_id: int):
    """
    Endpoint to test connectivity to AI provider API.
    
    Request Body:
        JSON object containing api_endpoint and api_key
        
    Returns:
        JSON response with test results
    """
    try:
        data = request.get_json()
        result, status_code = test_connection(
            data.get('api_endpoint'),
            data.get('api_key')
        )
        return jsonify(result), status_code
    except Exception as e:
        current_app.logger.error(f"Connection test error for user {user_id}: {str(e)}")
        return jsonify({"error": "Connection test failed"}), 500


# chat service
#  endpoint for chat completion
@ollama_bp.route('/ollama/chat', methods=['POST'])
@session_required
def chat_completion(user_id: int):
    try:
        data = request.get_json()
        # Add Ollama API call here
        response = requests.post(
            "http://localhost:11434/api/chat",
            json=data,
            stream=True
        )
        return Response(response.iter_content(chunk_size=None), mimetype='application/json')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#  search endpoint
@ollama_bp.route('/ollama/search-memories', methods=['POST'])
@session_required
def search_memories(user_id: int):
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        # Add your actual search implementation here
        # Example mock response:
        return jsonify({
            "results": [
                f"Memory result 1 for {query}",
                f"Memory result 2 for {query}"
            ],
            "query": query,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500