import os
import re

# Define the paths to the files
backend_path = "backend/app.py"
frontend_paths = [
    "frontend/main.js",
    "frontend/ChatWidget.js",
    "frontend/components/SettingsWidget.js",
    "frontend/components/MessageStorageManager.js",
    "frontend/components/ChatSessionManagement.js"
]

# Function to update the backend (app.py)
def update_backend(file_path):
    with open(file_path, "r") as file:
        content = file.read()

    # Update the /login endpoint to set an httpOnly cookie
    login_endpoint = re.sub(
        r'return jsonify\(\{"session_id": session_id, "expires_at": expires_at.isoformat\(\)\}\)',
        '''# Set an httpOnly cookie with the session ID
        response = jsonify({"status": "success"})
        response.set_cookie(
            key='session_id',
            value=session_id,
            expires=expires_at,
            httponly=True,
            secure=True,  # Use secure cookies in production
            samesite='Strict'
        )
        return response''',
        content
    )

    # Update the /logout endpoint to clear the httpOnly cookie
    logout_endpoint = re.sub(
        r'return jsonify\(\{"status": "success"\}\)',
        '''response = jsonify({"status": "success"})
        response.set_cookie('session_id', '', expires=0)  # Clear the cookie
        return response''',
        login_endpoint
    )

    with open(file_path, "w") as file:
        file.write(logout_endpoint)

    print("Updated {} to use httpOnly cookies.".format(file_path))

# Function to update frontend files
def update_frontend(file_path):
    with open(file_path, "r") as file:
        content = file.read()

    # Remove localStorage usage for session_id
    content = re.sub(
        r'localStorage\.(getItem|setItem|removeItem)\(\'session_id\'\)',
        '// Cookies are handled by the backend',
        content
    )

    # Remove Authorization header and add credentials: 'include'
    content = re.sub(
        r"'Authorization': localStorage\.getItem\('session_id'\)",
        "",
        content
    )
    content = re.sub(
        r"fetch\(\s*['\"](.*?)['\"],\s*\{",
        r"fetch('\1', {\n        credentials: 'include',  // Include cookies in the request",
        content
    )

    with open(file_path, "w") as file:
        file.write(content)

    print("Updated {} to use cookies.".format(file_path))

# Main function to run the updates
def main():
    # Update the backend
    if os.path.exists(backend_path):
        update_backend(backend_path)
    else:
        print("Backend file not found: {}".format(backend_path))

    # Update the frontend files
    for path in frontend_paths:
        if os.path.exists(path):
            update_frontend(path)
        else:
            print("Frontend file not found: {}".format(path))

    print("All updates completed.")

# Run the script
if __name__ == "__main__":
    main()