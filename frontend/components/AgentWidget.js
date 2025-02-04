export default class AgentWidget {
    /**
     * Constructor for the AgentWidget class.
     * @param {string|HTMLElement} container - The CSS selector for the container element or the DOM element itself.
     */
    constructor(container) {
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
            console.error('Error: Container not found.');
            throw new Error('Container not found.');
        }

  
        // Initialize the agent widget
        this.init();
    }

    // ========================
    // Initialization Methods
    // ========================

    /**
     * Initializes the agent widget.
     */
    init() {
        console.log('Initializing AgentWidget...');
        try {
            // Render the UI
            this.renderUI();
        } catch (error) {
            console.error('Error during AgentWidget initialization:', error);
            this.displayError('AgentWidget initialization failed. Please refresh the page and try again.');
        }
    }

    // ========================
    // UI Rendering Methods
    // ========================

    /**
     * Renders the agent widget UI.
     */
    renderUI() {
        this.clearContainer();

        // Render agent avatar
        this.renderAgentAvatar();

        // Render agent info
        this.renderAgentInfo();
    }

    /**
     * Renders the agent's avatar.
     */
    renderAgentAvatar() {
        const agentAvatar = document.createElement('div');
        agentAvatar.className = 'agent-avatar';
        agentAvatar.textContent = '🤖'; // Example avatar
        this.container.appendChild(agentAvatar);
    }

    /**
     * Renders the agent's info (name and status).
     */
    renderAgentInfo() {
        const agentInfo = document.createElement('div');
        agentInfo.className = 'agent-info';
        this.container.appendChild(agentInfo);

        const agentName = document.createElement('h3');
        agentName.textContent = 'PersonaVault'; // Example name
        agentInfo.appendChild(agentName);

        const agentStatus = document.createElement('p');
        agentStatus.textContent = 'Status: Online'; // Example status
        agentInfo.appendChild(agentStatus);
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Displays an error message in the UI.
     * @param {string} message - The error message to display.
     */
    displayError(message) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = message;
        this.container.appendChild(errorMessage);
    }

    /**
     * Clears the container's content.
     */
    clearContainer() {
        this.container.innerHTML = '';
    }
}