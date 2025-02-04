import PayloadBuilder from './components/PayloadBuilder.js';

export default class ChatWidget {
    /**
     * Initializes the ChatWidget.
     * @param {string|HTMLElement} container - The container selector or DOM element.
     * @param {string} apiEndpoint - The backend API endpoint.
     * @param {string} websocketEndpoint - The WebSocket endpoint.
     * @param {PayloadBuilder} payloadBuilder - The PayloadBuilder instance.
     * @param {Object} uniObjectHolder - The UniObjectHolder instance.
     */
    constructor(container, apiEndpoint, websocketEndpoint, payloadBuilder = new PayloadBuilder(), uniObjectHolder) {
        try {
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
            this.websocketEndpoint = websocketEndpoint;
            this.payloadBuilder = payloadBuilder; // Ensure this is initialized
            this.uniObjectHolder = uniObjectHolder;

            // Initialize WebSocket and backend connections only when the button is clicked
            this.isInitialized = false;
            this.widgetVisible = false; // Track the visibility of the widget
            this.websocket = null; // WebSocket instance
            this.reconnectAttempts = 0; // Track WebSocket reconnection attempts
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

            console.log('ChatWidget initialized successfully.');
        } catch (error) {
            console.error('Error initializing ChatWidget:', error);
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
            chatWidget.appendChild(footer); // Append footer to the chatWidget

            // Append the chat widget to the container
            this.container.appendChild(chatWidget);

            // Create the start/stop button
            const startStopButton = document.createElement('button');
            startStopButton.className = 'start-stop-btn';
            startStopButton.textContent = 'Start Websocket Chat';
            chatWidget.appendChild(startStopButton);

            // Store the button references
            this.startStopButton = startStopButton;
            this.sendButton = sendButton;
            this.stopButton = stopButton;
            this.searchButton = searchButton;
            this.footer = footer;

            console.log('Chat widget UI rendered successfully.');
        } catch (error) {
            console.error('Error rendering chat widget UI:', error);
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
            this.chatWindow = this.container.querySelector('.chat-window');
            this.chatInput = this.container.querySelector('.chat-input');
            this.sendButton = this.container.querySelector('.send-btn');
            this.stopButton = this.container.querySelector('.stop-btn');
            this.searchButton = this.container.querySelector('.search-btn');
            this.loadingIndicator = this.container.querySelector('.loading-indicator');
            this.typingIndicator = this.container.querySelector('.typing-indicator');
            this.errorMessage = this.container.querySelector('.error-message');
            this.footer = this.container.querySelector('.footer');

            console.log('UI elements initialized successfully.');
        } catch (error) {
            console.error('Error initializing UI elements:', error);
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
            // Start/Stop button
            this.startStopButton.addEventListener('click', () => this.toggleWidget());

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

            console.log('Event listeners bound successfully.');
        } catch (error) {
            console.error('Error binding event listeners:', error);
            this.displayError('Failed to bind event listeners. Please try again.');
        }
    }

    // ========================
    // Settings Update Handling
    // ========================

    /**
     * Listens for settings update events.
     */
    listenForSettingsUpdates() {
        document.addEventListener('settingsUpdated', () => {
            console.log('Settings updated. Refreshing payload...');
            this.refreshPayload();
        });
    }

    /**
     * Refreshes the payload and updates the footer.
     */
    async refreshPayload() {
        try {
            // Fetch the latest AI settings
            const settings = await this.fetchAISettings();

            // Update the cached settings
            this.cachedAISettings = settings;
            this.lastUpdated = new Date();

            // Update the footer
            this.updateFooter(settings);

            console.log('Payload refreshed with latest settings.');
        } catch (error) {
            console.error('Error refreshing payload:', error);
            this.displayError('Failed to refresh payload. Please try again.');
        }
    }

    /**
     * Updates the footer with the latest settings and timestamp.
     * @param {Object} settings - The AI settings.
     */
    updateFooter(settings) {
        if (this.footer) {
            const settingsName = settings.name || 'Default Settings';
            const lastUpdated = this.lastUpdated ? `Last updated: ${this.formatTimeSince(this.lastUpdated)} ago` : 'Never updated';
            this.footer.textContent = `Payload: ${settingsName} | ${lastUpdated}`;
        }
    }

    /**
     * Formats the time since the last update.
     * @param {Date} timestamp - The timestamp of the last update.
     * @returns {string} - The formatted time string.
     */
    formatTimeSince(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
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
            const message = this.chatInput?.value.trim();
            if (!message) {
                this.displayError('Message cannot be empty.');
                return;
            }

            this.toggleLoading(true);
            this.toggleTyping(true);

            // Fetch the latest AI settings
            const settings = await this.fetchAISettings();

            // Construct the payload using PayloadBuilder
            const payload = this.payloadBuilder.buildChatPayload(message, settings);

            console.log('Sending payload to Ollama API:', payload);

            // Send the payload to the Ollama API
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            // Add the user's message to the chat window
            this.addMessage('user', message);

            // Process the streaming response from Ollama API
            await this.processStreamingResponse(response);

        } catch (error) {
            console.error('Error sending message:', error);
            this.displayError('Failed to send message. Please try again.');
        } finally {
            this.toggleLoading(false);
            this.toggleTyping(false);
            this.chatInput.value = ''; // Clear the input field
            this.sendButton.classList.remove('hidden');
            this.stopButton.classList.add('hidden');
            this.stopStreaming = false; // Reset the stop flag
        }
    }

    /**
     * Fetches AI settings from the backend.
     */
    async fetchAISettings() {
        try {
            const response = await fetch(`${this.apiEndpoint}/ai-settings?type=local`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const settings = await response.json();

            return {
                deployment_type: settings.deployment_type || 'local',
                provider_name: settings.provider_name || 'Ollama',
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
            console.error('Error fetching AI settings:', error);
            throw error;
        }
    }

    /**
     * Clears the cached AI settings.
     */
    clearAISettingsCache() {
        this.cachedAISettings = null;
        localStorage.removeItem('cachedAISettings');
        console.log('AI settings cache cleared.');
    }

    /**
     * Processes the streaming response from the Ollama API.
     * @param {Response} response - The fetch response object.
     */
    async processStreamingResponse(response) {
        const reader = response.body.getReader();
        let aiResponse = '';

        while (true) {
            if (this.stopStreaming) {
                break; // Stop streaming if the flag is set
            }

            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            aiResponse += chunk;

            // Update the chat window with the streaming response
            this.updateBotMessage(chunk);
        }

        console.log('Final AI response:', aiResponse);
    }

    /**
     * Updates the bot's message in the chat window as new chunks arrive.
     * @param {string} chunk - The chunk of the bot's message.
     */
    updateBotMessage(chunk) {
        try {
            if (this.chatWindow) {
                // Split the chunk into individual JSON objects
                const jsonObjects = chunk.split('\n').filter(line => line.trim() !== '');

                for (const json of jsonObjects) {
                    const response = JSON.parse(json);
                    const messageContent = response.message?.content || '';

                    // Check if the response is done (indicated by the "done" field)
                    if (response.done) {
                        // Reset the last bot message tracking
                        this.lastBotMessage = null;
                        continue; // Skip further processing for this chunk
                    }

                    // If there's no last bot message, create a new one
                    if (!this.lastBotMessage) {
                        this.addMessage('bot', messageContent);
                        // Store the newly created bot message element
                        const botMessages = this.chatWindow.querySelectorAll('.bot-message');
                        this.lastBotMessage = botMessages[botMessages.length - 1];
                    } else {
                        // Append the new content to the last bot message
                        this.lastBotMessage.textContent += messageContent;
                    }

                    // Auto-scroll to the latest message
                    this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
                }
            }
        } catch (error) {
            console.error('Error updating bot message:', error);
        }
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
                const messageElement = document.createElement('div');
                messageElement.className = `message ${sender}-message`;
                messageElement.textContent = `${sender}: ${content}`;
                this.chatWindow.appendChild(messageElement);
                this.chatWindow.scrollTop = this.chatWindow.scrollHeight; // Auto-scroll to the latest message
            }
        } catch (error) {
            console.error('Error adding message:', error);
        }
    }

    /**
     * Displays an error message.
     * @param {string} message - The error message.
     */
    displayError(message) {
        try {
            if (this.errorMessage) {
                this.errorMessage.textContent = message;
                this.errorMessage.classList.remove('hidden');
                setTimeout(() => this.errorMessage.classList.add('hidden'), 5000); // Hide after 5 seconds
            }
        } catch (error) {
            console.error('Error displaying error message:', error);
        }
    }

    /**
     * Toggles loading indicator visibility.
     * @param {boolean} show - Whether to show the indicator.
     */
    toggleLoading(show) {
        try {
            if (this.loadingIndicator) {
                this.loadingIndicator.classList.toggle('hidden', !show);
            }
        } catch (error) {
            console.error('Error toggling loading indicator:', error);
        }
    }

    /**
     * Toggles typing indicator visibility.
     * @param {boolean} show - Whether to show the indicator.
     */
    toggleTyping(show) {
        try {
            if (this.typingIndicator) {
                this.typingIndicator.classList.toggle('hidden', !show);
            }
        } catch (error) {
            console.error('Error toggling typing indicator:', error);
        }
    }

    /**
     * Handles search functionality.
     */
    async handleSearch() {
        try {
            if (!this.widgetVisible) {
                this.displayError('Please start the chat widget first.');
                return;
            }

            const query = this.chatInput?.value.trim();
            if (!query) {
                this.displayError('Search query cannot be empty.');
                return;
            }

            this.toggleLoading(true);

            // Send search request to the backend /search-memories endpoint
            const response = await fetch(`${this.apiEndpoint}/search-memories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            const data = await response.json();
            if (data.results) {
                this.addMessage('bot', `Search results: ${data.results.join(', ')}`);
            } else {
                this.addMessage('bot', 'No results found.');
            }
        } catch (error) {
            console.error('Error searching:', error);
            this.displayError('Error during search. Please try again.');
        } finally {
            this.toggleLoading(false);
        }
    }

    /**
     * Gets cached AI settings from local storage.
     */
    getCachedAISettings() {
        const cachedSettings = localStorage.getItem('cachedAISettings');
        return cachedSettings ? JSON.parse(cachedSettings) : null;
    }

    /**
     * Saves AI settings to local storage.
     */
    saveAISettingsToCache(settings) {
        localStorage.setItem('cachedAISettings', JSON.stringify(settings));
    }
}