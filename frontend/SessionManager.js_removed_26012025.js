export default class SessionManager {
    constructor() {
        this.sessionId = localStorage.getItem('sessionId'); // Load session ID from localStorage
    }

    // Set the current session ID
    setSessionId(sessionId) {
        this.sessionId = sessionId;
        localStorage.setItem('sessionId', sessionId); // Save session ID to localStorage
    }

    // Get the current session ID
    getSessionId() {
        return this.sessionId;
    }

    // Clear the current session ID
    clearSessionId() {
        this.sessionId = null;
        localStorage.removeItem('sessionId'); // Remove session ID from localStorage
    }
}


async function handleLogin(username, password) {
    const button = document.querySelector('#login-form button');
    const errorEl = document.querySelector('#login-form .error-message');

    try {
        console.log('[handleLogin] Starting login process');
        disableButton(button);
        clearError(errorEl);

        const response = await customFetch('https://localhost:5001/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            console.log('[handleLogin] Successful, validating session');
            await validateSession();
        } else {
            displayError(response.error || 'Invalid credentials', errorEl);
            console.warn('[handleLogin] Failed:', response);
        }
    } catch (error) {
        displayError('Connection failed', errorEl);
        console.error('[handleLogin] Error:', error);
    } finally {
        enableButton(button);
    }
}