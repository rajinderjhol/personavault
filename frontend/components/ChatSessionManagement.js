import ErrorHandler from './ErrorHandler.js';




/**
 * ChatSessionManagement class for handling session-related functionality.
 * This class manages session creation, joining, and updating the active users panel.
 */
//export default class ChatSessionManagement {
    /**
     * Constructor for the ChatSessionManagement class.
     * @param {string} apiEndpoint - The base URL of the API endpoint.
     * @param {string} classPrefix - A unique prefix for DOM element classes to avoid conflicts.
     */
   // constructor(apiEndpoint, classPrefix) {
    //    this.apiEndpoint = apiEndpoint;
   //     this.classPrefix = classPrefix;
   // }

   export default class ChatSessionManagement {
    constructor(apiEndpoint, classPrefix) {
        this.apiEndpoint = apiEndpoint;
        this.classPrefix = classPrefix;
        this.errorHandler = new ErrorHandler(document.querySelector('.error-container'), 'chat-');
    }

    // ========================
    // Session Management Methods
    // ========================

    /**
     * Creates a new session.
     * @param {string} sessionName - The name of the session to create.
     * @returns {Promise<string>} - A promise that resolves to the session ID.
     * @throws {Error} - If the session creation fails.
     */
    async createSession(sessionName) {
        try {
            const response = await fetch(`https://localhost:5001/api/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_name: sessionName }),
            });

            if (!response.ok) {
                const errorMessage = await this.getErrorMessage(response);
                this.errorHandler.displayError(`Failed to create session: ${errorMessage}`);
                throw new Error(`Failed to create session: ${errorMessage}`);
            }

            const data = await response.json();
            return data.session_id;
        } catch (error) {
            this.errorHandler.logError('Error creating session:', error);
            throw error;
        }
    }
}




    /**
     * Joins an existing session.
     * @param {string} sessionId - The ID of the session to join.
     * @returns {Promise<Array>} - A promise that resolves to the list of active users.
     * @throws {Error} - If joining the session fails.
     */
    async joinSession(sessionId) {
        if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('Invalid session ID. Session ID must be a non-empty string.');
        }

        try {
            const response = await fetch(`${this.apiEndpoint}/join-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId }),
            });

            if (!response.ok) {
                const errorMessage = await this.getErrorMessage(response);
                throw new Error(`Failed to join session: ${errorMessage}`);
            }

            const data = await response.json();

            if (!Array.isArray(data.active_users)) {
                throw new Error('Invalid response from server: active_users is missing or not an array.');
            }

            return data.active_users; // Return the list of active users
        } catch (error) {
            console.error('Error joining session:', error);
            throw new Error(`Failed to join session: ${error.message}`);
        }
    }

    /**
     * Updates the active users panel in the UI.
     * @param {Array} activeUsers - The list of active users.
     * @param {HTMLElement} container - The container element where the active users panel is rendered.
     */
    updateActiveUsersPanel(activeUsers, container) {
        if (!container || !(container instanceof HTMLElement)) {
            console.error('Invalid container element provided.');
            return;
        }

        const activeUsersList = container.querySelector(`.${this.classPrefix}active-users-list`);
        if (!activeUsersList) {
            console.error('Active users list element not found in the container.');
            return;
        }

        // Clear the existing list
        activeUsersList.innerHTML = '';

        // Add each active user to the list
        if (Array.isArray(activeUsers)) {
            activeUsers.forEach((user) => {
                if (user && typeof user.name === 'string' && typeof user.role === 'string') {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${user.name} (${user.role})`;
                    activeUsersList.appendChild(listItem);
                } else {
                    console.warn('Invalid user object in activeUsers array:', user);
                }
            });
        } else {
            console.error('activeUsers is not an array.');
        }
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Displays an error message in the UI.
     * @param {string} message - The error message to display.
     * @param {HTMLElement} container - The container element where the error message should be displayed.
     */
    displayError(message, container) {
        if (!container || !(container instanceof HTMLElement)) {
            console.error('Invalid container element provided.');
            return;
        }

        const errorMessage = container.querySelector(`.${this.classPrefix}error-message`);
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        } else {
            console.error('Error message element not found in the container.');
        }
    }

    /**
     * Clears the error message in the UI.
     * @param {HTMLElement} container - The container element where the error message is displayed.
     */
    clearError(container) {
        if (!container || !(container instanceof HTMLElement)) {
            console.error('Invalid container element provided.');
            return;
        }

        const errorMessage = container.querySelector(`.${this.classPrefix}error-message`);
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
        } else {
            console.error('Error message element not found in the container.');
        }
    }

    /**
     * Extracts an error message from the response.
     * @param {Response} response - The fetch response object.
     * @returns {Promise<string>} - A promise that resolves to the error message.
     */
    async getErrorMessage(response) {
        try {
            const errorData = await response.json();
            return errorData.message || errorData.error || response.statusText;
        } catch (error) {
            return response.statusText;
        }
    }
}