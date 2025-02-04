import PayloadBuilder from './components/PayloadBuilder.js';

// Constants for logging and API endpoints
const LOG_PREFIX = '[ChatWidget]';
const CHAT_ENDPOINT = '/api/ollama/chat';
const SEARCH_ENDPOINT = '/api/ollama/search-memories';
const AI_SETTINGS_ENDPOINT = '/api/ollama/settings/current';

export default class ChatWidget {
    /**
     * Initializes the ChatWidget.
     * @param {string|HTMLElement} container - The container selector or DOM element.
     * @param {string} apiEndpoint - The backend API endpoint.
     * @param {PayloadBuilder} payloadBuilder - The PayloadBuilder instance.
     * @param {Object} uniObjectHolder - The UniObjectHolder instance.
     */
    constructor(container, apiEndpoint, payloadBuilder = new PayloadBuilder(), uniObjectHolder) {
        try {
            console.log(`${LOG_PREFIX} Initializing ChatWidget...`);

            // Handle both selector string and DOM element
            if (typeof container === 'string') {
                this.container = document.querySelector(container); // Use querySelector for selector strings
            } else if (container instanceof HTMLElement) {
                this.container = container; // Use the DOM element directly
            } else {
                throw new Error('Invalid container provided. Expected a selector string or DOM element.');
            }

            // Validate container existence
            if (!this.container) {
                throw new Error('Container not found.');
            }

            this.apiEndpoint = apiEndpoint;
            this.payloadBuilder = payloadBuilder; // Ensure this is initialized
            this.uniObjectHolder = uniObjectHolder;

            // Initialize state
            this.isInitialized = false;
            this.widgetVisible = false; // Track the visibility of the widget
            this.stopStreaming = false; // Flag to stop streaming

            // Cache for AI settings
            this.cachedAISettings = this.getCachedAISettings(); // Load cached settings
            this.lastUpdated = null; // Track the last updated timestamp

            // Dynamically render the chat widget UI
            this.renderChatWidget();

            // Initialize UI elements
            this.initializeUIElements();

            // Bind event listeners
            this.bindEvents();

            // Track the last bot message element
            this.lastBotMessage = null;

            // Listen for settings updates
            this.listenForSettingsUpdates();

            console.log(`${LOG_PREFIX} ChatWidget initialized successfully.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error initializing ChatWidget:`, error);
            this.displayError('Failed to initialize chat widget. Please try again.');
        }
    }

    // ========================
    // UI Rendering Methods
    // ========================

    /**
     * Renders the chat widget UI.
     */
    renderChatWidget() {
        try {
            console.log(`${LOG_PREFIX} Rendering chat widget UI...`);

            // Clear the container
            this.container.innerHTML = '';

            // Create the chat widget structure
            const chatWidget = document.createElement('div');
            chatWidget.className = 'chat-widget';

            // Chat window
            const chatWindow = document.createElement('div');
            chatWindow.className = 'chat-window';
            chatWidget.appendChild(chatWindow);

            // Chat controls
            const chatControls = document.createElement('div');
            chatControls.className = 'chat-controls';

            // Chat input
            const chatInput = document.createElement('input');
            chatInput.type = 'text';
            chatInput.className = 'chat-input';
            chatInput.placeholder = 'Type a message...';
            chatControls.appendChild(chatInput);

            // Send button
            const sendButton = document.createElement('button');
            sendButton.className = 'send-btn';
            sendButton.textContent = 'Send';
            chatControls.appendChild(sendButton);

            // Stop button
            const stopButton = document.createElement('button');
            stopButton.className = 'stop-btn';
            stopButton.textContent = 'Stop';
            chatControls.appendChild(stopButton);

            // Search button
            const searchButton = document.createElement('button');
            searchButton.className = 'search-btn';
            searchButton.textContent = 'Search';
            chatControls.appendChild(searchButton);

            chatWidget.appendChild(chatControls);

            // Loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = 'Loading...';
            chatWidget.appendChild(loadingIndicator);

            // Typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            typingIndicator.textContent = 'Bot is typing...';
            chatWidget.appendChild(typingIndicator);

            // Error message
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            chatWidget.appendChild(errorMessage);

            // Footer to display payload settings
            const footer = document.createElement('div');
            footer.className = 'footer';
            footer.textContent = 'Payload: No settings loaded';
            chatWidget.appendChild(footer);

            // Append the chat widget to the container
            this.container.appendChild(chatWidget);

            // Store the button references
            this.sendButton = sendButton;
            this.stopButton = stopButton;
            this.searchButton = searchButton;
            this.footer = footer;

            console.log(`${LOG_PREFIX} Chat widget UI rendered successfully.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error rendering chat widget UI:`, error);
            this.displayError('Failed to render chat widget UI. Please try again.');
        }
    }

    // ========================
    // Initialization Methods
    // ========================

    /**
     * Initializes UI elements.
     */
    initializeUIElements() {
        try {
            console.log(`${LOG_PREFIX} Initializing UI elements...`);

            this.chatWindow = this.container.querySelector('.chat-window');
            this.chatInput = this.container.querySelector('.chat-input');
            this.sendButton = this.container.querySelector('.send-btn');
            this.stopButton = this.container.querySelector('.stop-btn');
            this.searchButton = this.container.querySelector('.search-btn');
            this.loadingIndicator = this.container.querySelector('.loading-indicator');
            this.typingIndicator = this.container.querySelector('.typing-indicator');
            this.errorMessage = this.container.querySelector('.error-message');
            this.footer = this.container.querySelector('.footer');

            // Initialize the footer
            this.updateFooter('Initializing payload from database');

            console.log(`${LOG_PREFIX} UI elements initialized successfully.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error initializing UI elements:`, error);
            this.displayError('Failed to initialize UI elements. Please try again.');
        }
    }

    // ========================
    // Event Binding Methods
    // ========================

    /**
     * Binds event listeners.
     */
    bindEvents() {
        try {
            console.log(`${LOG_PREFIX} Binding event listeners...`);

            // Send button
            if (this.sendButton) {
                this.sendButton.addEventListener('click', () => this.handleSendMessage());
            }

            // Stop button
            if (this.stopButton) {
                this.stopButton.addEventListener('click', () => {
                    this.stopStreaming = true;
                    this.sendButton.classList.remove('hidden');
                    this.stopButton.classList.add('hidden');
                });
            }

            // Search button
            if (this.searchButton) {
                this.searchButton.addEventListener('click', () => this.handleSearch());
            }

            // Chat input (Enter key)
            if (this.chatInput) {
                this.chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleSendMessage();
                    }
                });
            }

            console.log(`${LOG_PREFIX} Event listeners bound successfully.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error binding event listeners:`, error);
            this.displayError('Failed to bind event listeners. Please try again.');
        }
    }

    // ========================
    // Message Handling Methods
    // ========================

    /**
     * Handles sending a chat message.
     */
    async handleSendMessage() {
        try {
            console.log(`${LOG_PREFIX} Handling send message...`);

            const message = this.chatInput?.value.trim();
            if (!message) {
                this.displayError('Message cannot be empty.');
                return;
            }

            this.toggleLoading(true);
            this.toggleTyping(true);
            this.disableInput(true);

            // Fetch the latest AI settings
            const settings = await this.fetchAISettings();
            console.log(`${LOG_PREFIX} Fetched AI settings:`, settings);

            // Construct the payload using PayloadBuilder
            const payload = this.payloadBuilder.buildChatPayload(message, settings);
            console.log(`${LOG_PREFIX} Payload built:`, payload);

            // Send the payload to the backend API
            console.log(`${LOG_PREFIX} Sending payload to backend API...`);
            const response = await this.makeApiRequest(CHAT_ENDPOINT, 'POST', payload);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            // Add the user's message to the chat window
            this.addMessage('user', message);

            // Process the streaming response from backend API
            await this.processStreamingResponse(response);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error sending message:`, error);
            this.displayError('Failed to send message. Please try again.');
        } finally {
            this.toggleLoading(false);
            this.toggleTyping(false);
            this.disableInput(false);
            this.chatInput.value = ''; // Clear the input field
            this.sendButton.classList.remove('hidden');
            this.stopButton.classList.add('hidden');
            this.stopStreaming = false; // Reset the stop flag
        }
    }

    /**
     * Processes the streaming response from the backend API.
     * @param {Response} response - The fetch response object.
     */
    async processStreamingResponse(response) {
        console.log(`${LOG_PREFIX} Processing streaming response...`);

        const reader = response.body.getReader();
        let buffer = '';
        let aiResponse = '';

        while (true) {
            if (this.stopStreaming) {
                console.log(`${LOG_PREFIX} Streaming stopped by user.`);
                break; // Stop streaming if the flag is set
            }

            const { done, value } = await reader.read();
            if (done) {
                console.log(`${LOG_PREFIX} Streaming response complete.`);
                break;
            }

            const chunk = new TextDecoder().decode(value);
            buffer += chunk;

            // Split buffer into complete JSON objects
            const jsonObjects = buffer.split('\n').filter(line => line.trim() !== '');
            buffer = jsonObjects.pop() || ''; // Save incomplete chunk for next iteration

            for (const json of jsonObjects) {
                try {
                    const response = JSON.parse(json);
                    const messageContent = response.message?.content || '';

                    // Check if the response is done (indicated by the "done" field)
                    if (response.done) {
                        console.log(`${LOG_PREFIX} Streaming response done.`);
                        // Reset the last bot message tracking
                        this.lastBotMessage = null;
                        continue; // Skip further processing for this chunk
                    }

                    // If there's no last bot message, create a new one
                    if (!this.lastBotMessage) {
                        console.log(`${LOG_PREFIX} Creating new bot message.`);
                        this.addMessage('bot', messageContent);
                        // Store the newly created bot message element
                        const botMessages = this.chatWindow.querySelectorAll('.bot-message');
                        this.lastBotMessage = botMessages[botMessages.length - 1];
                    } else {
                        console.log(`${LOG_PREFIX} Appending to last bot message.`);
                        // Append the new content to the last bot message
                        this.lastBotMessage.textContent += messageContent;
                    }

                    // Auto-scroll to the latest message
                    this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
                } catch (error) {
                    console.error(`${LOG_PREFIX} Error parsing JSON chunk:`, error);
                }
            }
        }

        console.log(`${LOG_PREFIX} Final AI response:`, aiResponse);
    }

    // ========================
    // Helper Methods
    // ========================

    /**
     * Adds a message to the chat window.
     * @param {string} sender - The sender of the message ('user' or 'bot').
     * @param {string} content - The content of the message.
     */
    addMessage(sender, content) {
        try {
            if (this.chatWindow) {
                console.log(`${LOG_PREFIX} Adding ${sender} message: ${content}`);
                const messageElement = document.createElement('div');
                messageElement.className = `message ${sender}-message`;
                messageElement.textContent = `${sender}: ${content}`;
                this.chatWindow.appendChild(messageElement);
                this.chatWindow.scrollTop = this.chatWindow.scrollHeight; // Auto-scroll to the latest message
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding message:`, error);
        }
    }

    /**
     * Displays an error message.
     * @param {string} message - The error message.
     */
    displayError(message) {
        try {
            if (this.errorMessage) {
                console.log(`${LOG_PREFIX} Displaying error: ${message}`);
                this.errorMessage.textContent = message;
                this.errorMessage.classList.remove('hidden');
                setTimeout(() => this.errorMessage.classList.add('hidden'), 5000); // Hide after 5 seconds
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error displaying error message:`, error);
        }
    }

    /**
     * Toggles loading indicator visibility.
     * @param {boolean} show - Whether to show the indicator.
     */
    toggleLoading(show) {
        try {
            if (this.loadingIndicator) {
                console.log(`${LOG_PREFIX} Toggling loading indicator: ${show}`);
                this.loadingIndicator.classList.toggle('hidden', !show);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error toggling loading indicator:`, error);
        }
    }

    /**
     * Toggles typing indicator visibility.
     * @param {boolean} show - Whether to show the indicator.
     */
    toggleTyping(show) {
        try {
            if (this.typingIndicator) {
                console.log(`${LOG_PREFIX} Toggling typing indicator: ${show}`);
                this.typingIndicator.classList.toggle('hidden', !show);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error toggling typing indicator:`, error);
        }
    }

    /**
     * Disables or enables chat input and buttons.
     * @param {boolean} disable - Whether to disable the input and buttons.
     */
    disableInput(disable) {
        try {
            if (this.chatInput && this.sendButton && this.stopButton && this.searchButton) {
                console.log(`${LOG_PREFIX} Disabling input: ${disable}`);
                this.chatInput.disabled = disable;
                this.sendButton.disabled = disable;
                this.stopButton.disabled = disable;
                this.searchButton.disabled = disable;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error disabling input:`, error);
        }
    }

    /**
     * Handles search functionality.
     */
    async handleSearch() {
        try {
            console.log(`${LOG_PREFIX} Handling search...`);

            const query = this.chatInput?.value.trim();
            if (!query) {
                this.displayError('Search query cannot be empty.');
                return;
            }

            this.toggleLoading(true);
            this.disableInput(true);

            // Send search request to the backend /search-memories endpoint
            console.log(`${LOG_PREFIX} Sending search request...`);
            const response = await this.makeApiRequest(SEARCH_ENDPOINT, 'POST', { query });

            const data = await response.json();
            if (data.results) {
                console.log(`${LOG_PREFIX} Search results:`, data.results);
                this.addMessage('bot', `Search results: ${data.results.join(', ')}`);
            } else {
                console.log(`${LOG_PREFIX} No search results found.`);
                this.addMessage('bot', 'No results found.');
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error searching:`, error);
            this.displayError('Error during search. Please try again.');
        } finally {
            this.toggleLoading(false);
            this.disableInput(false);
        }
    }

    /**
     * Gets cached AI settings from local storage.
     */
    getCachedAISettings() {
        const cachedSettings = localStorage.getItem('cachedAISettings');
        console.log(`${LOG_PREFIX} Retrieved cached AI settings:`, cachedSettings);
        return cachedSettings ? JSON.parse(cachedSettings) : null;
    }

    /**
     * Saves AI settings to local storage.
     */
    saveAISettingsToCache(settings) {
        console.log(`${LOG_PREFIX} Saving AI settings to cache:`, settings);
        localStorage.setItem('cachedAISettings', JSON.stringify(settings));
    }

    /**
     * Fetches AI settings from the backend.
     */
    async fetchAISettings() {
        try {
            console.log(`${LOG_PREFIX} Fetching AI settings from backend...`);
            this.updateFooter('Initializing payload from database'); // Update footer to show initialization

            const response = await this.makeApiRequest(AI_SETTINGS_ENDPOINT, 'GET');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const settings = await response.json();
            console.log(`${LOG_PREFIX} AI settings fetched:`, settings);

            // Update footer with the loaded settings
            const settingsName = settings.profile_name || 'Default Settings';
            this.updateFooter(`Setting Name = ${settingsName} is loaded`);

            return {
                deployment_type: settings.deployment_type || 'local',
                provider_name: settings.provider_type || 'Ollama',
                model_name: settings.model_name || 'phi:latest',
                temperature: settings.temperature || 0.7,
                max_tokens: settings.max_tokens || 100,
                top_p: settings.top_p || 0.9,
                system_prompt: settings.system_prompt || 'You are a helpful assistant.',
                response_format: settings.response_format || 'text',
                language: settings.language || 'en',
                presence_penalty: settings.presence_penalty || 0.0,
                frequency_penalty: settings.frequency_penalty || 0.0,
                user_context: settings.user_context || '',
            };
        } catch (error) {
            console.error(`${LOG_PREFIX} Error fetching AI settings:`, error);
            this.updateFooter('Error initializing payload'); // Update footer to show error
            throw error;
        }
    }

    /**
     * Updates the footer with the latest settings and timestamp.
     * @param {string} message - The message to display in the footer.
     */
    updateFooter(message) {
        if (this.footer) {
            this.footer.textContent = `Payload: ${message}`;
        }
    }

    /**
     * Listens for settings update events.
     */
    listenForSettingsUpdates() {
        document.addEventListener('settingsUpdated', () => {
            console.log(`${LOG_PREFIX} Settings updated. Refreshing payload...`);
            this.refreshPayload();
        });
    }

    /**
     * Refreshes the payload and updates the footer.
     */
    async refreshPayload() {
        try {
            console.log(`${LOG_PREFIX} Refreshing payload...`);
            this.updateFooter('Initializing payload from database'); // Update footer to show initialization

            // Fetch the latest AI settings
            const settings = await this.fetchAISettings();

            // Update the cached settings
            this.cachedAISettings = settings;
            this.lastUpdated = new Date();

            // Update the footer with the loaded settings
            const settingsName = settings.profile_name || 'Default Settings';
            this.updateFooter(`Setting Name = ${settingsName} is loaded`);

            console.log(`${LOG_PREFIX} Payload refreshed with latest settings.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error refreshing payload:`, error);
            this.updateFooter('Error initializing payload'); // Update footer to show error
            this.displayError('Failed to refresh payload. Please try again.');
        }
    }

    /**
     * Makes an API request with credentials included.
     * @param {string} endpoint - The API endpoint.
     * @param {string} method - The HTTP method (e.g., 'GET', 'POST').
     * @param {Object} body - The request body (optional).
     * @returns {Promise<Response>} - The fetch response.
     */
    async makeApiRequest(endpoint, method, body = null) {
        const response = await fetch(`${this.apiEndpoint}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : null,
            credentials: 'include', // Ensure cookies are included
        });

        if (response.status === 401) {
            // Handle unauthorized (e.g., redirect to login)
            window.location.href = '/login';
            throw new Error('Unauthorized: Redirecting to login.');
        }

        return response;
    }
}