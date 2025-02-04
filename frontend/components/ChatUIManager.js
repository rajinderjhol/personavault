/**
 * ChatUIManager class for handling UI rendering in the chat widget.
 * This class is responsible for creating and managing the chat interface,
 * including the chat window, input fields, buttons, and error messages.
 */
export default class ChatUIManager {
    /**
     * Constructor for the ChatUIManager class.
     * @param {string} containerSelector - The selector of the container element for the chat widget.
     * @param {string} classPrefix - A unique prefix for DOM element classes to avoid conflicts.
     * @param {Object} options - Configuration options for the UI (optional).
     */
    constructor(containerSelector, classPrefix, options = {}) {
        // Validate the container
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            console.error(`Error: Container with selector "${containerSelector}" not found.`);
            throw new Error(`Container with selector "${containerSelector}" not found.`);
        }

        this.classPrefix = classPrefix;

        // Default options
        this.options = {
            widgetTitle: 'AI Chatbot',
            connectionStatusText: 'Checking connection...',
            defaultModel: 'default-model',
            searchPlaceholder: 'Search memories...',
            searchButtonText: 'Search',
            personalityOptions: [
                { value: 'formal', text: 'Formal' },
                { value: 'casual', text: 'Casual' },
                { value: 'humorous', text: 'Humorous' },
            ],
            languageOptions: [
                { value: 'en-US', text: 'English' },
                { value: 'es-ES', text: 'Spanish' },
                { value: 'fr-FR', text: 'French' },
            ],
            ...options, // Override defaults with provided options
        };

        // Initialize the UI
        this.renderUI();

        // Initialize error handler
        this.errorHandler = new ErrorHandler(this.container, this.classPrefix);
    }

    // ========================
    // Core Methods
    // ========================

    /**
     * Clears the container's content.
     */
    clearContainer() {
        this.container.innerHTML = '';
    }

    /**
     * Renders the chat widget UI.
     */
    renderUI() {
        this.clearContainer();
        this.renderWidgetTitle();
        this.renderSessionControls();
        this.renderModelDisplay();
        this.renderSearchBar();
        this.renderChatWindow();
        this.renderChatInputContainer();
        this.renderSettingsContainer();
        this.renderErrorMessage();
    }

    /**
     * Renders the widget title with connection status.
     */
    renderWidgetTitle() {
        const widgetTitle = document.createElement('div');
        widgetTitle.className = 'widget-title';
        widgetTitle.textContent = this.options.widgetTitle || 'Chat Widget';
        this.container.appendChild(widgetTitle);

        // Add connection status indicator
        this.connectionStatus = document.createElement('span');
        this.connectionStatus.className = `${this.classPrefix}connection-status`;
        this.connectionStatus.textContent = ` (${this.options.connectionStatusText})`;
        widgetTitle.appendChild(this.connectionStatus);
    }

    /**
     * Renders session controls (Create Session, Join Session, Active Users).
     */
    renderSessionControls() {
        const sessionControls = document.createElement('div');
        sessionControls.className = 'session-controls';
        this.container.appendChild(sessionControls);

        // Create Session button
        this.renderButton(sessionControls, `${this.classPrefix}create-session-btn`, 'Create Session');

        // Join Session button
        this.renderButton(sessionControls, `${this.classPrefix}join-session-btn`, 'Join Session');

        // Active Users panel
        this.renderActiveUsersPanel(sessionControls);
    }

    /**
     * Renders a button.
     * @param {HTMLElement} parent - The parent element.
     * @param {string} className - The button class.
     * @param {string} text - The button text.
     */
    renderButton(parent, className, text) {
        if (!parent || !(parent instanceof HTMLElement)) {
            console.error('Invalid parent element provided.');
            return;
        }

        const button = document.createElement('button');
        button.className = className;
        button.textContent = text;
        parent.appendChild(button);
    }

    /**
     * Renders the active users panel.
     * @param {HTMLElement} parent - The parent element.
     */
    renderActiveUsersPanel(parent) {
        if (!parent || !(parent instanceof HTMLElement)) {
            console.error('Invalid parent element provided.');
            return;
        }

        const activeUsersPanel = document.createElement('div');
        activeUsersPanel.className = `${this.classPrefix}active-users-panel`;
        parent.appendChild(activeUsersPanel);

        const activeUsersHeader = document.createElement('h3');
        activeUsersHeader.textContent = 'Active Users';
        activeUsersPanel.appendChild(activeUsersHeader);

        const activeUsersList = document.createElement('ul');
        activeUsersList.className = `${this.classPrefix}active-users-list`;
        activeUsersPanel.appendChild(activeUsersList);
    }

    /**
     * Renders the model display.
     */
    renderModelDisplay() {
        const modelDisplay = document.createElement('div');
        modelDisplay.className = 'model-display';
        modelDisplay.textContent = 'Current Model: ';
        const modelSpan = document.createElement('span');
        modelSpan.className = `${this.classPrefix}current-model`;
        modelSpan.textContent = this.options.defaultModel;
        modelDisplay.appendChild(modelSpan);
        this.container.appendChild(modelDisplay);
    }

    /**
     * Renders the search bar.
     */
    renderSearchBar() {
        const searchBar = document.createElement('div');
        searchBar.className = 'search-bar';
        this.container.appendChild(searchBar);

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = `${this.classPrefix}search-input`;
        searchInput.placeholder = this.options.searchPlaceholder;
        searchBar.appendChild(searchInput);

        this.renderButton(searchBar, `${this.classPrefix}search-btn`, this.options.searchButtonText);
    }

    /**
     * Renders the chat window.
     */
    renderChatWindow() {
        const chatWindow = document.createElement('div');
        chatWindow.className = `${this.classPrefix}chat-window`;
        this.container.appendChild(chatWindow);
    }

    /**
     * Renders the chat input container.
     */
    renderChatInputContainer() {
        const chatInputContainer = document.createElement('div');
        chatInputContainer.className = 'chat-input-container';
        this.container.appendChild(chatInputContainer);

        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.className = `${this.classPrefix}chat-input`;
        chatInput.placeholder = 'Type your message...';
        chatInputContainer.appendChild(chatInput);

        // Send button
        const sendButton = document.createElement('button');
        sendButton.className = `${this.classPrefix}send-btn`;
        sendButton.textContent = 'Send';
        chatInputContainer.appendChild(sendButton);

        // Typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = `${this.classPrefix}typing-indicator`;
        typingIndicator.textContent = 'Typing...';
        typingIndicator.style.display = 'none';
        chatInputContainer.appendChild(typingIndicator);
    }

    /**
     * Renders the settings container.
     */
    renderSettingsContainer() {
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'settings-container';
        this.container.appendChild(settingsContainer);

        // Personality dropdown
        this.renderDropdown(settingsContainer, `${this.classPrefix}personality-select`, this.options.personalityOptions);

        // Language dropdown
        this.renderDropdown(settingsContainer, `${this.classPrefix}language-select`, this.options.languageOptions);
    }

    /**
     * Renders a dropdown (select) element.
     * @param {HTMLElement} parent - The parent element.
     * @param {string} className - The class of the dropdown.
     * @param {Array} options - The options to populate the dropdown with.
     */
    renderDropdown(parent, className, options) {
        if (!parent || !(parent instanceof HTMLElement)) {
            console.error('Invalid parent element provided.');
            return;
        }

        const select = document.createElement('select');
        select.className = className;
        options.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            select.appendChild(optionElement);
        });
        parent.appendChild(select);
    }

    /**
     * Renders the error message container.
     */
    renderErrorMessage() {
        const errorMessage = document.createElement('div');
        errorMessage.className = `${this.classPrefix}error-message`;
        this.container.appendChild(errorMessage);
    }

    // ========================
    // Message Handling Methods
    // ========================

    /**
     * Adds a message to the chat window.
     * @param {string} sender - The sender of the message ('user' or 'bot').
     * @param {string} content - The content of the message.
     */
    addMessage(sender, content) {
        const chatWindow = this.container.querySelector(`.${this.classPrefix}chat-window`);
        if (!chatWindow) {
            console.error('Chat window not found.');
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        messageElement.textContent = `${sender}: ${content}`;
        chatWindow.appendChild(messageElement);

        // Scroll to the bottom of the chat window
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    /**
     * Displays an error message in the error container.
     * @param {string} message - The error message to display.
     */
    displayError(message) {
        const errorMessage = this.container.querySelector(`.${this.classPrefix}error-message`);
        if (!errorMessage) {
            console.error('Error message container not found.');
            return;
        }

        errorMessage.textContent = message;
        errorMessage.style.display = 'block';

        // Hide the error message after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    /**
     * Show the typing indicator.
     */
    showTypingIndicator() {
        const typingIndicator = this.container.querySelector(`.${this.classPrefix}typing-indicator`);
        if (typingIndicator) {
            typingIndicator.style.display = 'block';
        }
    }

    /**
     * Hide the typing indicator.
     */
    hideTypingIndicator() {
        const typingIndicator = this.container.querySelector(`.${this.classPrefix}typing-indicator`);
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }
}