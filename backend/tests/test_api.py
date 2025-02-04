import pytest
from app import create_app  # Replace with your actual app creation method
from flask import jsonify

@pytest.fixture
def client():
    app = create_app()  # Create your Flask app instance here
    with app.test_client() as client:
        yield client

def test_get_current_settings(client):
    # Define the user ID and session ID
    user_id = 1
    session_id = "264e380a-6f63-416a-a8ca-2f3a2ec86cfd"
    
    # Simulate the GET request with the necessary headers and cookie
    response = client.get(
        "/api/ollama/settings/current",
        headers={"Content-Type": "application/json"},
        cookies={"session_id": session_id},  # Simulate the session cookie
        json={"user_id": user_id}
    )

    # Check if the response status code is 200 (OK) or 500 (Internal Server Error)
    assert response.status_code == 200  # or 500, depending on your expected behavior

    # Optionally, check the response JSON content if you expect specific fields
    response_json = response.get_json()
    if response.status_code == 200:
        assert "settings" in response_json  # Replace "settings" with the actual expected key
    else:
        assert "error" in response_json
        assert response_json["error"] == "Failed to retrieve settings"
