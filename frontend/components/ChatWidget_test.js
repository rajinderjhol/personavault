export default class ChatWidgetTest {
    constructor(selector, endpoint) {
        this.selector = selector;
        this.endpoint = endpoint; // Ollama API endpoint
        this.init();
    }

    /**
     * Initialize the chat widget.
     */
    init() {
        console.log('Initializing chat widget...');

        // Get references to DOM elements
        this.chatWindow = document.querySelector(`${this.selector} .chat-window`);
        this.chatInput = document.querySelector(`${this.selector} .chat-input`);
        this.sendButton = document.querySelector(`${this.selector} .send-btn`);

        // Check if required elements exist
        if (!this.chatWindow || !this.chatInput || !this.sendButton) {
            console.error('Required DOM elements not found. Check your HTML structure.');
            return;
        }

        // Attach event listener to the send button
        this.sendButton.addEventListener('click', async () => {
            await this.handleSendMessage();
        });

        console.log('Chat widget initialized successfully.');
    }

    /**
     * Handle sending a message to the Ollama API.
     */
    async handleSendMessage() {
        const message = this.chatInput.value.trim();

        // Check if the message is empty
        if (!message) {
            this.displayError('Message cannot be empty.');
            return;
        }

        console.log('Sending message:', message);

        try {
            // Send the message directly to the Ollama API
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama2', // Replace with your desired model
                    prompt: message,
                    stream: false, // Set to true for streaming responses
                }),
            });

            console.log('Response status:', response.status);

            // Handle non-OK responses
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            // Parse the response and display it
            const data = await response.json();
            console.log('Response data:', data);
            this.displayMessage(data.response);

            // Clear the input field after sending the message
            this.chatInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error.message);
            this.displayError(error.message);
        }
    }

    /**
     * Display a message in the chat window.
     * @param {string} message - The message to display.
     */
    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        this.chatWindow.appendChild(messageElement);

        // Scroll to the bottom of the chat window
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }

    /**
     * Display an error message in the chat window.
     * @param {string} errorMessage - The error message to display.
     */
    displayError(errorMessage) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = `Error: ${errorMessage}`;
        this.chatWindow.appendChild(errorElement);

        // Scroll to the bottom of the chat window
        this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    }
}