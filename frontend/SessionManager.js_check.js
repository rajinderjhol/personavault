// main.js
// Purpose: Main JavaScript file for AI Chatbot application
// Includes full authentication flow with registration support

// ========================
// Global Variables
// ========================
let isAuthenticated = false;
let settingsWidget;
let chatWidget;
let agentWidget;
let currentTheme = 'light';

// Import widgets
import SettingsManager from './components/SettingsManager.js';
import SettingsWidget from './components/SettingsWidget.js';
import ChatWidget from './ChatWidget.js';
import WebSocketManager from './components/WebSocketManager.js';
import UniObjectHolder from './components/UniObjectHolder.js';
import AgentWidget from './components/AgentWidget.js';
import PayloadBuilder from './components/PayloadBuilder.js';

// Initialize UniObjectHolder
const uniObjectHolder = new UniObjectHolder();

// ========================
// Utility Functions
// ========================
function disableButton(button, text = 'Processing...') {
    if (button) {
        button.disabled = true;
        button.textContent = text;
    }
}

function enableButton(button, text = 'Submit') {
    if (button) {
        button.disabled = false;
        button.textContent = text;
    }
}

function displayError(message, element) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function clearError(element) {
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}

// ========================
// Theme Management
// ========================
async function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('selectedTheme', theme);

    if (isAuthenticated) {
        try {
            await customFetch('https://localhost:5001/save-theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme }),
                credentials: 'include'
            });
        } catch (error) {
            console.error('Theme save error:', error);
        }
    }
}

async function initializeTheme() {
    let savedTheme = localStorage.getItem('selectedTheme');
    
    if (isAuthenticated) {
        try {
            const response = await customFetch('https://localhost:5001/get-theme', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                savedTheme = data.theme || savedTheme;
            }
        } catch (error) {
            console.error('Theme fetch error:', error);
        }
    }

    const theme = savedTheme || 'light';
    applyTheme(theme);
    document.querySelector('.theme-select').value = theme;
}

// ========================
// Custom Fetch Wrapper
// ========================
async function customFetch(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// ========================
// Session Management
// ========================
// --- Enhanced Session Validation ---
async function validateSession() {
    try {
        const response = await customFetch('https://localhost:5001/validate-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            isAuthenticated = false;
            return;
        }

        const data = await response.json();
        isAuthenticated = data.valid;
        
        if (isAuthenticated) {
            await initializeTheme();
            await initializeWidgets();
        }
    } catch (error) {
        console.error('Session validation error:', error);
        isAuthenticated = false;
    } finally {
        renderUI();
    }
}



// --- Enhanced Logout Handler ---
async function clearSession() {
    try {
        await customFetch('https://localhost:5001/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        // Clear client-side state
        isAuthenticated = false;
        document.cookie = 'session_id=; Path=/; Domain=localhost; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        localStorage.removeItem('selectedTheme');
        
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        renderUI();
    }
}

// ========================
// UI Rendering
// ========================
function createLoginForm() {
    const container = document.getElementById('login-form-container');
    container.innerHTML = `
        <form id="login-form">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
            <div class="error-message" style="display: none"></div>
        </form>
    `;
}

function createRegistrationForm() {
    const container = document.getElementById('register-form-container');
    container.innerHTML = `
        <form id="register-form">
            <input type="text" id="reg-username" placeholder="Username" required>
            <input type="email" id="reg-email" placeholder="Email" required>
            <input type="password" id="reg-password" placeholder="Password" required>
            <button type="submit">Create Account</button>
            <div class="error-message" style="display: none"></div>
        </form>
    `;
    container.style.display = 'block';
    document.getElementById('login-form-container').style.display = 'none';
}

function renderUI() {
    // Clear all authenticated UI elements completely
    const clearContainers = () => {
        const containers = [
            'chat-widget-container',
            'settings-widget-container',
            'agent-widget-container'
        ];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = ''; // Clear any existing content
                container.style.display = 'none'; // Ensure hidden
            }
        });
    };

    const nav = document.querySelector('.navigation');
    const registerLink = document.querySelector('.show-register');
    const loginLink = document.querySelector('.show-register');
    const logoutLink = document.querySelector('.logout-link');

    if (nav) {
        nav.style.display = 'block';
        // Always reset to default states first
        registerLink.style.display = 'block';
        loginLink.style.display = 'block';
        logoutLink.style.display = 'none';
        
        // Then apply authentication state
        if (isAuthenticated) {
            registerLink.style.display = 'none';
            loginLink.style.display = 'none';
            logoutLink.style.display = 'block';
        }
    }

    const loginContainer = document.getElementById('login-form-container');
    if (loginContainer) {
        loginContainer.style.display = isAuthenticated ? 'none' : 'block';
        // Clear previous login form if exists
        if (!isAuthenticated && !document.getElementById('login-form')) {
            loginContainer.innerHTML = ''; // Clear potential old forms
            createLoginForm();
        }
    }

    if (!isAuthenticated) {
        clearContainers();
        // Force remove any lingering authenticated elements
        document.querySelectorAll('.authenticated-only').forEach(el => el.remove());
    } else {
        // Initialize authenticated UI elements
        document.getElementById('chat-widget-container').style.display = 'block';
        document.getElementById('settings-widget-container').style.display = 'block';
        document.getElementById('agent-widget-container').style.display = 'block';
    }
}

// ========================
// Widget Initialization
// ========================
async function initializeWidgets() {
    if (!isAuthenticated) return; // Only initialize widgets if authenticated

    try {
        settingsWidget = new SettingsWidget(
            document.getElementById('settings-widget-container'),
            'https://localhost:5001'
        );

        chatWidget = new ChatWidget(
            '#chat-widget-container',
            'https://localhost:5001',
            'ws://localhost:5002',
            new PayloadBuilder(),
            new UniObjectHolder()
        );

        agentWidget = new AgentWidget(
            document.getElementById('agent-widget-container')
        );

        uniObjectHolder.setObject('settingsWidget', settingsWidget);
        uniObjectHolder.setObject('chatWidget', chatWidget);
        uniObjectHolder.setObject('agentWidget', agentWidget);

    } catch (error) {
        console.error('Widget initialization error:', error);
    }
}

// ========================
// Auth Handlers
// ========================
// --- Enhanced Login Handler ---
async function handleLogin(username, password) {
    const button = document.querySelector('#login-form button');
    const errorEl = document.querySelector('#login-form .error-message');
    
    try {
        disableButton(button);
        const response = await customFetch('https://localhost:5001/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'  // Crucial for cookies
        });

        if (response.ok) {
            await validateSession();  // Force revalidation
        } else {
            displayError('Invalid credentials', errorEl);
        }
    } catch (error) {
        displayError('Login failed', errorEl);
    } finally {
        enableButton(button);
    }
}



async function handleRegistration(username, email, password) {
    const button = document.querySelector('#register-form button');
    const errorEl = document.querySelector('#register-form .error-message');
    
    try {
        disableButton(button);
        const response = await customFetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });

        if (response.ok) {
            // Force session validation after registration
            await validateSession();
            window.location.reload(); // Full state reset
        } else {
            const errorData = await response.json();
            displayError(errorData.error || 'Registration failed', errorEl);
        }
    } catch (error) {
        displayError('Connection error', errorEl);
    } finally {
        enableButton(button);
    }
}

// ========================
// Event Listeners
// ========================
document.addEventListener('DOMContentLoaded', () => {
    validateSession();
    initializeTheme();

    document.addEventListener('submit', (e) => {
        if (e.target.id === 'login-form') {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            handleLogin(username, password);
        }

        if (e.target.id === 'register-form') {
            e.preventDefault();
            const username = document.getElementById('reg-username').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            handleRegistration(username, email, password);
        }
    });

    document.querySelector('.logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
    });

    document.querySelector('.show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        createRegistrationForm();
    });

    document.querySelector('.theme-select')?.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
});

// Global error handler
window.onerror = (message, source, lineno) => {
    console.error(`Error: ${message} at ${source}:${lineno}`);
    const errorEl = document.createElement('div');
    errorEl.className = 'global-error';
    errorEl.textContent = 'Application error occurred. Please refresh.';
    document.body.prepend(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
};