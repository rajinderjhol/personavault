export default class ChatEventHandler {
    /**
     * Constructor for the ChatEventHandler class.
     * @param {Object} chatWidget - The chat widget instance.
     * @param {Object} chatSessionManagement - The chat session management instance.
     * @param {Object} chatUIManager - The chat UI manager instance.
     */
    constructor(chatWidget, chatSessionManagement, chatUIManager) {
        this.chatWidget = chatWidget;
        this.chatSessionManagement = chatSessionManagement;
        this.chatUIManager = chatUIManager;
    }

    /**
     * Sets up event listeners for the chat widget.
     * @param {Object} options - Configuration options for event listeners.
     * @param {string} options.enterKeyPayloadType - The payload type to use when the Enter key is pressed (default: 'full').
     */
    setupEventListeners(options = {}) {
        const { enterKeyPayloadType = 'full' } = options;

        // Get references to the buttons and input field
        const send1Btn = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}send1-btn`);
        const send2Btn = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}send2-btn`);
        const send3Btn = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}send3-btn`);
        const chatInput = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}chat-input`);

        // Add event listeners if the elements exist
        if (send1Btn) {
            send1Btn.addEventListener('click', () => this.handleSendMessage('no-structure'));
        } else {
            console.warn('Send1 button not found. Event listener not added.');
        }

        if (send2Btn) {
            send2Btn.addEventListener('click', () => this.handleSendMessage('minimal'));
        } else {
            console.warn('Send2 button not found. Event listener not added.');
        }

        if (send3Btn) {
            send3Btn.addEventListener('click', () => this.handleSendMessage('full'));
        } else {
            console.warn('Send3 button not found. Event listener not added.');
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendMessage(enterKeyPayloadType);
                }
            });
        } else {
            console.warn('Chat input field not found. Event listener not added.');
        }

        // Add event listener for model selection changes
        const modelSelect = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}model-select`);
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.handleModelChange(e.target.value);
            });
        } else {
            console.warn('Model select element not found. Event listener not added.');
        }
    }

    /**
     * Handles sending a message with the specified payload type.
     * @param {string} payloadType - The type of payload to send ('no-structure', 'minimal', 'full').
     */
    async handleSendMessage(payloadType) {
        try {
            const chatInput = this.chatWidget.container.querySelector(`.${this.chatWidget.idPrefix}chat-input`);
            const message = chatInput.value;
    
            let payload;
            switch (payloadType) {
                case 'no-structure':
                    payload = this.payloadBuilder.buildChatPayload(message);
                    break;
                case 'minimal':
                    payload = this.payloadBuilder.buildChatPayload(message, { system_prompt: 'You are a helpful assistant.' });
                    break;
                case 'full':
                    payload = this.payloadBuilder.buildChatPayload(message, {
                        system_prompt: 'You are a helpful assistant.',
                        temperature: 0.7,
                        max_tokens: 100,
                    });
                    break;
                default:
                    throw new Error('Invalid payload type.');
            }
    
            await this.chatWidget.sendMessage(payload);
        } catch (error) {
            console.error('Error sending message:', error);
            this.chatUIManager.displayError('Failed to send message. Please try again.');
        }
    }


    /**
     * Handles changes to the model selection.
     * @param {string} modelName - The name of the selected model.
     */
    async handleModelChange(modelName) {
        try {
            const sessionId = localStorage.getItem('session_id');
            if (!sessionId) {
                throw new Error('You are not logged in. Please log in.');
            }

            // Update the model name in the backend
            const response = await fetch(`https://localhost:5001/update-model`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': sessionId,
                },
                body: JSON.stringify({ model_name: modelName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update model.');
            }

            // Update the model name in the UI
            this.chatUIManager.updateModelName(modelName);
        } catch (error) {
            console.error('Error updating model:', error);
            this.chatUIManager.displayError('Failed to update model. Please try again.');
        }
    }
}