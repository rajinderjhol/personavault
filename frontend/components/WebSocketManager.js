class WebSocketManager {
    /**
     * Constructor for the WebSocketManager class.
     * @param {string} websocketEndpoint - The WebSocket endpoint (e.g., 'ws://localhost:5003').
     * @param {function} onMessageCallback - Callback function for handling incoming messages.
     * @param {function} onActiveUsersCallback - Callback function for handling active users updates.
     */
    constructor(websocketEndpoint, onMessageCallback, onActiveUsersCallback) {
        this.websocketEndpoint = websocketEndpoint || 'ws://localhost:5003'; // Default to port 5003
        this.onMessageCallback = onMessageCallback;
        this.onActiveUsersCallback = onActiveUsersCallback;
        this.websocket = null;
        this.retryInterval = 5000; // Default retry interval (5 seconds)
        this.maxRetryAttempts = 3; // Default max retry attempts
        this.retryAttempts = 0;
        this.isConnected = false;

        // Initialize the WebSocket connection
        this.connect();
    }

    /**
     * Establishes a WebSocket connection.
     */
    connect() {
        this.websocket = new WebSocket(this.websocketEndpoint);

        // Event handler for when the connection is opened
        this.websocket.onopen = () => {
            console.log('WebSocket connection established.');
            this.isConnected = true;
            this.retryAttempts = 0; // Reset retry attempts on successful connection
        };

        // Event handler for incoming messages
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                this.onMessageCallback(data.sender, data.content);
            } else if (data.type === 'activeUsers') {
                this.onActiveUsersCallback(data.activeUsers);
            }
        };

        // Event handler for connection errors
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
            this.handleConnectionFailure();
        };

        // Event handler for when the connection is closed
        this.websocket.onclose = () => {
            console.log('WebSocket connection closed.');
            this.isConnected = false;
            this.handleConnectionFailure();
        };
    }

    /**
     * Handles WebSocket connection failures and attempts to reconnect.
     */
    handleConnectionFailure() {
        if (this.retryAttempts < this.maxRetryAttempts) {
            this.retryAttempts++;
            console.log(`Attempting to reconnect (${this.retryAttempts}/${this.maxRetryAttempts})...`);
            setTimeout(() => this.connect(), this.retryInterval);
        } else {
            console.error('Max retry attempts reached. Unable to establish WebSocket connection.');
        }
    }

    /**
     * Sends a message through the WebSocket connection.
     * @param {string} message - The message to send.
     */
    sendMessage(message) {
        if (this.isConnected && this.websocket) {
            this.websocket.send(JSON.stringify({ type: 'message', content: message }));
        } else {
            console.error('WebSocket is not connected. Message not sent.');
        }
    }

    /**
     * Requests the list of active users from the server.
     */
    requestActiveUsers() {
        if (this.isConnected && this.websocket) {
            this.websocket.send(JSON.stringify({ type: 'getActiveUsers' }));
        } else {
            console.error('WebSocket is not connected. Active users request not sent.');
        }
    }

    /**
     * Sets the retry interval for reconnection attempts.
     * @param {number} interval - The retry interval in milliseconds.
     */
    setRetryInterval(interval) {
        this.retryInterval = interval;
    }

    /**
     * Sets the maximum number of retry attempts for reconnection.
     * @param {number} maxAttempts - The maximum number of retry attempts.
     */
    setMaxRetryAttempts(maxAttempts) {
        this.maxRetryAttempts = maxAttempts;
    }

    /**
     * Returns the current WebSocket connection status.
     * @returns {boolean} - True if connected, false otherwise.
     */
    getConnectionStatus() {
        return this.isConnected;
    }

    /**
     * Disconnects the WebSocket connection.
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.isConnected = false;
            console.log('WebSocket connection disconnected.');
        }
    }
}

// Export the WebSocketManager class for use in other modules
export default WebSocketManager;