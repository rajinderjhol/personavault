// main.js
// Purpose: Main JavaScript file for AI Chatbot application
// Includes full authentication flow with registration support

// ========================
// Global Variables
// ========================
let isAuthenticated = false;
let currentTheme = 'light';

// Import widgets
import SettingsWidget from './components/SettingsWidget.js';
import ChatWidget from './ChatWidget.js';
import AgentWidget from './components/AgentWidget.js';


// theme selector 
document.addEventListener('DOMContentLoaded', function() {
    const themeSelect = document.getElementById('theme-select');

    if (!themeSelect) return; // Prevent errors if element doesn't exist

    // Load saved theme from localStorage, default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelect.value = savedTheme;

    // Update theme when dropdown changes
    themeSelect.addEventListener('change', function() {
        const selectedTheme = this.value;
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('theme', selectedTheme);
    });
});



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
    try {
        console.log(`[applyTheme] Applying theme: ${theme}`);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);

        if (isAuthenticated) {
            const response = await customFetch('https://localhost:5001/save-theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme }),
                credentials: 'include',
            });

            if (!response.ok) {
                console.warn('[applyTheme] Theme sync failed with server');
            }
        }
    } catch (error) {
        console.error('[applyTheme] Error:', error);
    }
}

async function initializeTheme() {
    try {
        let savedTheme = localStorage.getItem('selectedTheme');
        console.log(`[initializeTheme] Local storage theme: ${savedTheme}`);

        if (isAuthenticated) {
            const response = await customFetch('https://localhost:5001/get-theme', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.data;
                savedTheme = data.theme || savedTheme;
                console.log(`[initializeTheme] Server theme: ${data.theme}`);
            }
        }

        const theme = savedTheme || 'light';
        applyTheme(theme);
        const themeSelect = document.querySelector('.theme-select');
        if (themeSelect) themeSelect.value = theme;
    } catch (error) {
        console.error('[initializeTheme] Error:', error);
    }
}

// ========================
// Enhanced Fetch Wrapper
// ========================
async function customFetch(url, options = {}) {
    const startTime = Date.now();
    try {
        console.log(`[customFetch] START: ${url}`, {
            method: options.method || 'GET',
            credentials: 'include',  // Ensure credentials are included
        });

        const response = await fetch(url, {
            ...options,
            credentials: 'include',  // Ensure credentials are included
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const responseTime = Date.now() - startTime;
        console.log(`[customFetch] RESPONSE: ${url} (${response.status}) in ${responseTime}ms`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[customFetch] ERROR: ${url} - ${errorText}`);

            // Handle 401 Unauthorized (session expired)
            if (response.status === 401) {
                handleSessionInvalidation();
            }

            return { ok: false, status: response.status, error: errorText };
        }

        const data = await response.json();
        return { ok: true, data, status: response.status };
    } catch (error) {
        console.error(`[customFetch] NETWORK ERROR: ${url} - ${error.message}`);
        return { ok: false, error: error.message };
    }
}






// ========================
// Session Management
// ========================
async function validateSession() {
    try {
        console.log('[validateSession] Initiating session validation');

        const response = await customFetch('https://localhost:5001/validate-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        console.log('[validateSession] Response:', response);

        if (!response.ok) {
            console.warn('[validateSession] Session validation failed', response);
            handleSessionInvalidation();
            return;
        }

        const { data } = response;
        console.log('[validateSession] Session data:', data);

        isAuthenticated = data.isAuthenticated;
        currentTheme = data.theme || 'light';

        if (isAuthenticated) {
            await applyTheme(currentTheme);
            await initializeWidgets(data.widgets || []);
        }

        renderUI(data);
    } catch (error) {
        console.error('[validateSession] Critical error:', error);
        handleSessionInvalidation();
    }
}

// Handles session invalidation
function handleSessionInvalidation() {
    console.log('[handleSessionInvalidation] Invalidating session');
    isAuthenticated = false;
    localStorage.removeItem('isAuthenticated');
    document.cookie = 'session_id=; Path=/; Domain=localhost; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    renderUI({ isAuthenticated: false });
}

// Handles session logout
async function handleLogout() {
    try {
        const response = await customFetch('https://localhost:5001/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            console.log('[handleLogout] Logout successful');
            handleSessionInvalidation();
        } else {
            console.warn('[handleLogout] Logout failed:', response);
        }
    } catch (error) {
        console.error('[handleLogout] Error:', error);
    }
}

// Validates the session periodically
async function validateSessionPeriodically() {
    try {
        const response = await customFetch('https://localhost:5001/validate-session', {
            method: 'POST',
            credentials: 'include',
        });

        if (response.ok) {
            const { isAuthenticated, theme, widgets } = response.data;
            isAuthenticated = isAuthenticated; // Update global authentication state
            renderUI({ isAuthenticated, theme, widgets });
        } else {
            handleSessionInvalidation(); // Invalidate session if validation fails
        }
    } catch (error) {
        console.error('[validateSessionPeriodically] Error:', error);
        handleSessionInvalidation();
    }
}

// ========================
// UI Rendering
// ========================
function createLoginForm() {
    const container = document.getElementById('login-form-container');
    if (!container) {
        console.error('[createLoginForm] Container missing');
        return;
    }

    container.innerHTML = `
        <form id="login-form">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Login</button>
            <div class="error-message" style="display: none"></div>
        </form>
    `;
    container.style.display = 'block';
}

function createRegistrationForm() {
    const container = document.getElementById('register-form-container');
    if (!container) {
        console.error('[createRegistrationForm] Container missing');
        return;
    }

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

// Renders the UI based on the state
function renderUI(state) {
    console.log('[renderUI] State:', state);

    // Navigation State
    const navElements = {
        showLogin: state.showLogin ?? !state.isAuthenticated,
        showRegister: state.showRegister ?? !state.isAuthenticated,
        showLogout: state.showLogout ?? state.isAuthenticated,
    };

    console.log('[renderUI] Navigation State:', navElements);

    // Show navigation if login or register is visible
    const navigation = document.querySelector('.navigation');
    if (navigation) {
        navigation.style.display = navElements.showLogin || navElements.showRegister ? 'block' : 'none';
    }

    // Update Navigation
    const updateElement = (selector, shouldShow) => {
        const el = document.querySelector(selector);
        if (el) {
            console.log(`[renderUI] Updating ${selector}: ${shouldShow ? 'show' : 'hide'}`);
            el.style.display = shouldShow ? 'block' : 'none';
        } else {
            console.error(`[renderUI] Element not found: ${selector}`);
        }
    };

    updateElement('.show-login', navElements.showLogin);
    updateElement('.show-register', navElements.showRegister);
    updateElement('.logout-link', navElements.showLogout);

    // Widget Management
    const widgetContainers = {
        chat: document.getElementById('chat-widget-container'),
        settings: document.getElementById('settings-widget-container'),
        agent: document.getElementById('agent-widget-container'),
    };

    Object.entries(widgetContainers).forEach(([name, container]) => {
        if (!container) {
            console.error(`[renderUI] ${name} container missing`);
            return;
        }

        const shouldShow = state.isAuthenticated ? (state.widgets || []).includes(name) : name === 'chat';
        console.log(`[renderUI] Widget ${name}: ${shouldShow ? 'show' : 'hide'}`);
        container.style.display = shouldShow ? 'block' : 'none';
    });
}

// ========================
// Widget Initialization
// ========================
async function initializeWidgets(widgets) {
    // Early return if not authenticated or no widgets provided
    if (!isAuthenticated || !widgets) {
        console.warn('[initializeWidgets] Skipping widget init - not authenticated or no widgets');
        return;
    }

    // Ensure widgets is an array
    if (typeof widgets === 'string') {
        try {
            // Parse the string into an array (e.g., if widgets is a JSON string)
            widgets = JSON.parse(widgets);
        } catch (error) {
            console.error('[initializeWidgets] Failed to parse widgets:', error);
            return;
        }
    }

    // Check if widgets is an array after parsing
    if (!Array.isArray(widgets)) {
        console.error('[initializeWidgets] Widgets is not an array:', widgets);
        return;
    }

    // Early return if the array is empty
    if (!widgets.length) {
        console.warn('[initializeWidgets] No widgets to initialize');
        return;
    }

    console.log('[initializeWidgets] Initializing widgets:', widgets);

    try {
        // Fetch widget configuration from the backend
        const widgetConfig = await customFetch('https://localhost:5001/widget-config');

        if (!widgetConfig.ok) {
            throw new Error('Failed to load widget config');
        }

        // Initialize each widget
        widgets.forEach((widget) => {
            try {
                switch (widget) {
                    case 'settings':
                        new SettingsWidget(
                            document.getElementById('settings-widget-container'),
                            'https://localhost:5001',
                            widgetConfig.data.settings
                        );
                        break;

                    case 'chat':
                        new ChatWidget(
                            '#chat-widget-container',
                            'https://localhost:5001',
                            'ws://localhost:5002',
                            widgetConfig.data.chat
                        );
                        break;

                    case 'agent':
                        new AgentWidget(
                            document.getElementById('agent-widget-container'),
                            widgetConfig.data.agent
                        );
                        break;

                    default:
                        console.warn(`[initializeWidgets] Unknown widget: ${widget}`);
                }
            } catch (error) {
                console.error(`[initializeWidgets] Widget ${widget} init error:`, error);
                displayError(`Failed to initialize ${widget} widget. Please try again.`, document.getElementById(`${widget}-widget-container`));
            }
        });
    } catch (error) {
        console.error('[initializeWidgets] Widget initialization failed:', error);
        displayError('Failed to initialize widgets. Please try again.', document.getElementById('widget-container'));
    }
}

// ========================
// Auth Handlers
// ========================
async function handleLogin(username, password) {
    const button = document.querySelector('#login-form button');
    const errorEl = document.querySelector('#login-form .error-message');

    try {
        console.log('[handleLogin] Starting login process');
        disableButton(button);
        clearError(errorEl);

        const response = await customFetch('https://localhost:5001/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
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

async function handleRegistration(username, email, password) {
    const button = document.querySelector('#register-form button');
    const errorEl = document.querySelector('#register-form .error-message');

    try {
        console.log('[handleRegistration] Starting registration process');
        disableButton(button);
        clearError(errorEl);

        const response = await customFetch('https://localhost:5001/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        });

        if (response.ok) {
            console.log('[handleRegistration] Successful, validating session');
            await validateSession();
        } else {
            displayError(response.error || 'Registration failed', errorEl);
            console.warn('[handleRegistration] Failed:', response);
        }
    } catch (error) {
        displayError('Connection failed', errorEl);
        console.error('[handleRegistration] Error:', error);
    } finally {
        enableButton(button);
    }
}

// ========================
// Event Listeners
// ========================
function initializeEventListeners() {
    // Form Submissions
    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'login-form') {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            if (username && password) await handleLogin(username, password);
        }

        if (e.target.id === 'register-form') {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            if (username && email && password) await handleRegistration(username, email, password);
        }
    });

    // Navigation
    document.querySelector('.logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleSessionInvalidation();
    });

    document.querySelector('.show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        createRegistrationForm();
    });

    document.querySelector('.show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        createLoginForm();
    });

    // Theme Selector
    document.querySelector('.theme-select')?.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
}

// ========================
// Application Bootstrap
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Application] Initializing...');

    try {
        // Add a small delay to ensure the cookie is processed
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        await validateSession(); // Now validate the session
        await initializeTheme();
        initializeEventListeners();

        // Validate session periodically (e.g., every 5 minutes)
        setInterval(validateSessionPeriodically, 5 * 60 * 1000); // 5 minutes
    } catch (error) {
        console.error('[Application] Initialization error:', error);
        document.body.innerHTML = '<h1>Application Failed to Load</h1>';
    }
});

// Global Error Handling
window.onerror = (message, source, lineno, colno, error) => {
    console.error(`[Global Error] ${message} at ${source}:${lineno}:${colno}`, error);

    const errorEl = document.createElement('div');
    errorEl.className = 'global-error';
    errorEl.innerHTML = `
        <h3>Application Error</h3>
        <p>${error?.message || message}</p>
        <button onclick="location.reload()">Reload</button>
    `;

    document.body.prepend(errorEl);
};