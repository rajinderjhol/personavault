/**
 * ConnectionManager class for managing the connection to the backend.
 * This class handles checking the connection status, reconnecting, and updating the UI
 * to reflect the connection state.
 */
export default class ConnectionManager {
    /**
     * Constructor for the ConnectionManager class.
     * @param {string} apiEndpoint - The base URL of the API endpoint.
     * @param {HTMLElement} container - The container element where the connection status will be displayed.
     * @param {string} idPrefix - A unique prefix for DOM element IDs to avoid conflicts.
     */
    constructor(apiEndpoint, container, idPrefix = '') {
        this.apiEndpoint = apiEndpoint;
        this.container = container;
        this.idPrefix = idPrefix;

        // Validate container existence
        if (!this.container) {
            console.error('Error: Container element not found.');
            throw new Error('Container element not found.');
        }

        // Initialize the connection status element
        this.initializeConnectionStatusElement();

        // Default connection state
        this.isConnected = false;
        this.retryInterval = 5000; // 5 seconds
    }

    // ========================
    // Initialization Methods
    // ========================

    /**
     * Initializes the connection status element in the UI.
     */
    initializeConnectionStatusElement() {
        // Check if the connection status element already exists
        let connectionStatusElement = this.container.querySelector(`.${this.idPrefix}connection-status`);
        if (!connectionStatusElement) {
            // Create the connection status element if it doesn't exist
            connectionStatusElement = document.createElement('span');
            connectionStatusElement.className = `${this.idPrefix}connection-status`;
            connectionStatusElement.textContent = 'Checking connection...';
            this.container.appendChild(connectionStatusElement);
        }
    }

    // ========================
    // Connection Management Methods
    // ========================

    /**
     * Checks the connection to the backend and updates the UI.
     * @returns {Promise<boolean>} - A promise that resolves to `true` if the connection is successful, otherwise `false`.
     */
    async checkBackendConnection() {
        try {
            const response = await fetch(`${this.apiEndpoint}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                this.updateConnectionStatus(true, 'Connected to backend.');
                return true;
            } else {
                this.updateConnectionStatus(false, 'Failed to connect to backend.');
                return false;
            }
        } catch (error) {
            this.updateConnectionStatus(false, 'Connection error: ' + error.message);
            return false;
        }
    }

    /**
     * Starts a periodic check of the backend connection.
     * If the connection is lost, it will attempt to reconnect at the specified interval.
     */
    startConnectionMonitoring() {
        this.connectionMonitor = setInterval(async () => {
            const isConnected = await this.checkBackendConnection();
            if (!isConnected) {
                console.warn('Connection lost. Attempting to reconnect...');
            }
        }, this.retryInterval);
    }

    /**
     * Stops the periodic connection monitoring.
     */
    stopConnectionMonitoring() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
            this.connectionMonitor = null;
        }
    }

    // ========================
    // UI Update Methods
    // ========================

    /**
     * Updates the connection status in the UI.
     * @param {boolean} isConnected - Whether the connection is active.
     * @param {string} message - The status message to display.
     */
    updateConnectionStatus(isConnected, message) {
        const connectionStatusElement = this.container.querySelector(`.${this.idPrefix}connection-status`);
        if (!connectionStatusElement) {
            console.error('Connection status element not found.');
            return;
        }

        this.isConnected = isConnected;
        connectionStatusElement.textContent = message;

        // Update the color based on the connection status
        if (isConnected) {
            connectionStatusElement.style.color = 'green';
        } else {
            connectionStatusElement.style.color = 'red';
        }
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Sets the retry interval for connection monitoring.
     * @param {number} interval - The retry interval in milliseconds.
     */
    setRetryInterval(interval) {
        if (interval > 0) {
            this.retryInterval = interval;
        } else {
            console.warn('Invalid retry interval. Must be greater than 0.');
        }
    }

    /**
     * Gets the current connection status.
     * @returns {boolean} - `true` if connected, otherwise `false`.
     */
    getConnectionStatus() {
        return this.isConnected;
    }
}
