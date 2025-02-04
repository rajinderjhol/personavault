// PayloadBuilder.js
// This class is responsible for building payloads for various requests in the application.
// It handles AI settings management, payload construction for chat, search, settings, authentication, and logging.

export default class PayloadBuilder {
    /**
     * Initializes the PayloadBuilder instance.
     * - Sets the API endpoint for the backend.
     * - Loads AI settings on initialization.
     * - Listens for settings update events.
     */
    constructor() {
        this.cachedSettings = null; // Cache for AI settings
        this.apiEndpoint = 'https://localhost:5001'; // Backend API endpoint (adjust for production)
        this.loadSettings(); // Load settings on initialization
        this.listenForUpdates(); // Listen for settings updates
    }

    // ========================
    // AI Settings Management
    // ========================

    /**
     * Loads AI settings from the backend and caches them.
     * @throws {Error} If the settings cannot be fetched or parsed.
     */
    async loadSettings() {
        try {
            console.log('Fetching AI settings from backend...');
            const response = await fetch(`${this.apiEndpoint}/ai-settings`, {
                method: 'GET',
                credentials: 'include', // Include credentials for authenticated requests
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch AI settings: HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('AI settings fetched from backend:', data);

            // Cache the settings for future use
            this.cachedSettings = data;
            console.log('AI settings cached successfully:', this.cachedSettings);
        } catch (error) {
            console.error('Error loading AI settings:', error);
            throw error; // Propagate the error for handling upstream
        }
    }

    /**
     * Listens for settings update events and reloads the cache when triggered.
     */
    listenForUpdates() {
        document.addEventListener('settingsUpdated', () => {
            console.log('Settings updated event detected. Reloading settings...');
            this.loadSettings(); // Reload settings when an update event is detected
        });
    }

    // ========================
    // Payload Building Methods
    // ========================

    /**
     * Builds a payload for saving AI settings.
     * @param {Object} settings - The AI settings to save.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the settings object is invalid.
     */
    buildAISettingsPayload(settings) {
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings provided. Expected an object.');
        }

        const payload = {
            deployment: settings.deployment || 'local', // Default to 'local'
            provider: settings.provider || 'Ollama', // Default to 'Ollama'
            settings: {
                model_name: settings.model_name || 'phi:latest', // Default model
                provider_type: settings.provider || 'Ollama', // Default provider type
                temperature: this.validateTemperature(settings.temperature), // Validate temperature
                max_tokens: this.validateMaxTokens(settings.max_tokens), // Validate max tokens
                top_p: this.validateTopP(settings.top_p), // Validate top-p
                system_prompt: settings.system_prompt || 'You are a helpful assistant.', // Default system prompt
                response_format: settings.response_format || 'text', // Default response format
                language: settings.language || 'en', // Default language
                api_key: settings.api_key || '', // Optional API key (ensure it's not logged)
                api_endpoint: settings.api_endpoint || '', // Optional API endpoint
            },
        };

        console.log('AI settings payload built:', { ...payload, settings: { ...payload.settings, api_key: '*****' } }); // Mask API key in logs
        return payload;
    }

    /**
     * Builds a payload for chat requests.
     * @param {string} message - The user's message.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the message is invalid or AI settings are not loaded.
     */
    buildChatPayload(message) {
        if (!message || typeof message !== 'string') {
            throw new Error('Invalid message provided. Expected a non-empty string.');
        }

        if (!this.cachedSettings) {
            throw new Error('AI settings not loaded. Please try again.');
        }

        console.log('Building chat payload with cached settings:', this.cachedSettings);

        const payload = {
            deployment: this.cachedSettings.deployment_type || 'local', // Default to 'local'
            provider: this.cachedSettings.provider_name || 'Ollama', // Default to 'Ollama'
            model: this.cachedSettings.model_name || 'phi:latest', // Default model
            messages: [{ role: 'user', content: message }],
            temperature: this.validateTemperature(this.cachedSettings.temperature), // Validate temperature
            max_tokens: this.validateMaxTokens(this.cachedSettings.max_tokens), // Validate max tokens
            top_p: this.validateTopP(this.cachedSettings.top_p), // Validate top-p
            system_prompt: this.cachedSettings.system_prompt || 'You are a helpful assistant.', // Default system prompt
            response_format: this.cachedSettings.response_format || 'text', // Default response format
            language: this.cachedSettings.language || 'en', // Default language
            presence_penalty: this.cachedSettings.presence_penalty || 0.0, // Default presence penalty
            frequency_penalty: this.cachedSettings.frequency_penalty || 0.0, // Default frequency penalty
            user_context: this.cachedSettings.user_context || '', // Default user context
        };

        console.log('Chat payload built:', payload);
        return payload;
    }

    /**
     * Builds a payload for searching memories or data.
     * @param {string} query - The search query.
     * @param {Object} [options] - Additional options for the payload.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the query is invalid.
     */
    buildSearchPayload(query, options = {}) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid query provided. Expected a non-empty string.');
        }

        const payload = {
            query: query.trim(),
            timestamp: new Date().toISOString(), // Add a timestamp for tracking
            ...options, // Include any additional options
        };

        console.log('Search payload built:', payload);
        return payload;
    }

    /**
     * Builds a payload for updating user settings.
     * @param {Object} settings - The settings to update.
     * @param {Object} [options] - Additional options for the payload.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the settings object is invalid.
     */
    buildSettingsPayload(settings, options = {}) {
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings provided. Expected an object.');
        }

        const payload = {
            settings: {
                ...settings, // Include all settings
            },
            timestamp: new Date().toISOString(), // Add a timestamp for tracking
            ...options, // Include any additional options
        };

        console.log('Settings payload built:', payload);
        return payload;
    }

    /**
     * Builds a payload for authentication requests (e.g., login or registration).
     * @param {string} username - The user's username.
     * @param {string} password - The user's password.
     * @param {Object} [options] - Additional options for the payload.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the username or password is invalid.
     */
    buildAuthPayload(username, password, options = {}) {
        if (!username || typeof username !== 'string') {
            throw new Error('Invalid username provided. Expected a non-empty string.');
        }
        if (!password || typeof password !== 'string') {
            throw new Error('Invalid password provided. Expected a non-empty string.');
        }

        const payload = {
            username: username.trim(),
            password: password.trim(), // Note: Passwords should be hashed before sending in a real application
            ...options, // Include any additional options
        };

        console.log('Authentication payload built:', { ...payload, password: '*****' }); // Mask password in logs
        return payload;
    }

    /**
     * Builds a payload for logging user actions or events.
     * @param {string} action - The action or event to log.
     * @param {Object} [metadata] - Additional metadata for the action.
     * @returns {Object} The constructed payload.
     * @throws {Error} If the action is invalid.
     */
    buildLogPayload(action, metadata = {}) {
        if (!action || typeof action !== 'string') {
            throw new Error('Invalid action provided. Expected a non-empty string.');
        }

        const payload = {
            action: action.trim(),
            timestamp: new Date().toISOString(), // Add a timestamp for tracking
            ...metadata, // Include any additional metadata
        };

        console.log('Log payload built:', payload);
        return payload;
    }

    // ========================
    // Validation Helpers
    // ========================

    /**
     * Validates the temperature value.
     * @param {number} temperature - The temperature value.
     * @returns {number} The validated temperature.
     * @throws {Error} If the temperature is invalid.
     */
    validateTemperature(temperature) {
        if (temperature === undefined || temperature === null) {
            return 0.7; // Default temperature
        }
        if (typeof temperature !== 'number' || temperature < 0 || temperature > 1) {
            throw new Error('Invalid temperature. Expected a number between 0 and 1.');
        }
        return temperature;
    }

    /**
     * Validates the max_tokens value.
     * @param {number} maxTokens - The max_tokens value.
     * @returns {number} The validated max_tokens.
     * @throws {Error} If the max_tokens is invalid.
     */
    validateMaxTokens(maxTokens) {
        if (maxTokens === undefined || maxTokens === null) {
            return 100; // Default max tokens
        }
        if (typeof maxTokens !== 'number' || maxTokens <= 0) {
            throw new Error('Invalid max_tokens. Expected a positive number.');
        }
        return maxTokens;
    }

    /**
     * Validates the top_p value.
     * @param {number} topP - The top_p value.
     * @returns {number} The validated top_p.
     * @throws {Error} If the top_p is invalid.
     */
    validateTopP(topP) {
        if (topP === undefined || topP === null) {
            return 0.9; // Default top-p
        }
        if (typeof topP !== 'number' || topP < 0 || topP > 1) {
            throw new Error('Invalid top_p. Expected a number between 0 and 1.');
        }
        return topP;
    }
}