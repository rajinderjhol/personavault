import PayloadBuilder from './PayloadBuilder.js';

// Constants
const DEFAULT_API_ENDPOINT = "https://localhost:5001"; // Backend API endpoint

/**
 * SettingsWidget class for managing AI settings configuration.
 */
export default class SettingsWidget {
    /**
     * Initializes the SettingsWidget.
     * @param {string|HTMLElement} container - The container element or selector.
     * @param {string} [apiEndpoint=DEFAULT_API_ENDPOINT] - The backend API endpoint.
     */
    constructor(container, apiEndpoint = DEFAULT_API_ENDPOINT) {
        this.container = this.resolveContainer(container);
        this.apiEndpoint = apiEndpoint;
        this.initialize();
    }

    // ========================
    // Initialization
    // ========================

    /**
     * Initializes the widget.
     */
    initialize() {
        try {
            this.renderUI();
            this.initializeUIElements();
            this.bindEvents();
            this.fetchAndDisplayCurrentModel(); // Fetch and display the current model
            this.populateModelDropdown(); // Populate the model dropdown
            this.populatePastSettingsDropdown(); // Populate past settings dropdown

            if (process.env.NODE_ENV === 'development') {
                console.log('SettingsWidget initialized successfully.');
            }
        } catch (error) {
            console.error('Error initializing SettingsWidget:', error);
            this.displayError('Failed to initialize settings widget. Please try again.');
        }
    }

    /**
     * Resolves the container element.
     * @param {string|HTMLElement} container - The container element or selector.
     * @returns {HTMLElement} - The resolved container element.
     * @throws {Error} - If the container is invalid or not found.
     */
    resolveContainer(container) {
        if (typeof container === 'string') {
            const element = document.querySelector(container);
            if (!element) throw new Error(`Container not found: ${container}`);
            return element;
        }
        if (container instanceof HTMLElement) return container;
        throw new Error('Invalid container type');
    }

    // ========================
    // UI Rendering
    // ========================

    /**
     * Renders the settings widget UI.
     */
    renderUI() {
        this.container.innerHTML = '';
        const widget = document.createElement('div');
        widget.className = 'settings-widget';

        // Header Section
        widget.appendChild(this.createHeaderSection());

        // Main Form
        const form = document.createElement('div');
        form.className = 'settings-form';
        form.appendChild(this.createNameInput());

        // Settings Form Section
        const settingsForm = this.createSettingsForm();
        settingsForm.classList.add('hidden'); // Hidden by default
        form.appendChild(settingsForm);

        form.appendChild(this.createSaveButton());
        form.appendChild(this.createDeleteButton());
        widget.appendChild(form);

        this.container.appendChild(widget);
    }

    /**
     * Creates the header section.
     * @returns {HTMLElement} - The header section.
     */
    createHeaderSection() {
        const header = document.createElement('div');
        header.className = 'settings-header';
        header.appendChild(this.createPastSettingsDropdown());
        header.appendChild(this.createNewButton());
        return header;
    }

    /**
     * Creates the settings form section.
     * @returns {HTMLElement} - The settings form section.
     */
    createSettingsForm() {
        const formSection = document.createElement('div');
        formSection.className = 'new-settings-section';

        const title = document.createElement('h3');
        title.className = 'settings-section-title';
        title.textContent = 'Configuration Details';
        formSection.appendChild(title);

        formSection.appendChild(this.createDeploymentDropdown());
        formSection.appendChild(this.createProviderDropdown());
        formSection.appendChild(this.createModelDropdownContainer());
        formSection.appendChild(this.createInternetSettings());
        formSection.appendChild(this.createModelSettings());

        return formSection;
    }

    /**
     * Creates the past settings dropdown.
     * @returns {HTMLElement} - The dropdown container.
     */
    createPastSettingsDropdown() {
        const container = document.createElement('div');
        container.className = 'settings-group';

        const label = document.createElement('label');
        label.textContent = 'Current Settings:';
        container.appendChild(label);

        this.pastSettingsDropdown = document.createElement('select');
        this.pastSettingsDropdown.className = 'past-settings-selector';
        container.appendChild(this.pastSettingsDropdown);

        return container;
    }

    /**
     * Creates the "Create New" button.
     * @returns {HTMLElement} - The button element.
     */
    createNewButton() {
        const button = document.createElement('button');
        button.className = 'create-new-button';
        button.textContent = 'Create New';
        return button;
    }

    /**
     * Creates the setting name input field.
     * @returns {HTMLElement} - The input container.
     */
    createNameInput() {
        const container = document.createElement('div');
        container.className = 'settings-group';

        const label = document.createElement('label');
        label.textContent = 'Setting Name:';
        container.appendChild(label);

        this.settingNameInput = document.createElement('input');
        this.settingNameInput.type = 'text';
        this.settingNameInput.placeholder = 'e.g., Medical Assistant Config';
        container.appendChild(this.settingNameInput);

        return container;
    }

    /**
     * Creates the deployment type dropdown.
     * @returns {HTMLElement} - The dropdown container.
     */
    createDeploymentDropdown() {
        const container = document.createElement('div');
        container.className = 'settings-group';

        const label = document.createElement('label');
        label.textContent = 'Deployment Type:';
        container.appendChild(label);

        this.deploymentTypeDropdown = document.createElement('select');
        this.deploymentTypeDropdown.innerHTML = `
            <option value="local">Local</option>
            <option value="internet">Internet</option>
        `;
        container.appendChild(this.deploymentTypeDropdown);

        return container;
    }

    /**
     * Creates the provider dropdown.
     * @returns {HTMLElement} - The dropdown container.
     */
    createProviderDropdown() {
        const container = document.createElement('div');
        container.className = 'settings-group';

        const label = document.createElement('label');
        label.textContent = 'Provider:';
        container.appendChild(label);

        this.providerDropdown = document.createElement('select');
        this.providerDropdown.innerHTML = `<option value="Ollama">Ollama</option>`;
        container.appendChild(this.providerDropdown);

        return container;
    }

    /**
     * Creates the model dropdown container.
     * @returns {HTMLElement} - The model dropdown container.
     */
    createModelDropdownContainer() {
        const container = document.createElement('div');
        container.className = 'model-dropdown-container hidden';

        const label = document.createElement('label');
        label.textContent = 'Model:';
        label.htmlFor = 'modelDropdown';
        container.appendChild(label);

        this.modelDropdownContainer = document.createElement('div');
        container.appendChild(this.modelDropdownContainer);

        return container;
    }

    /**
     * Creates the internet settings section.
     * @returns {HTMLElement} - The internet settings container.
     */
    createInternetSettings() {
        this.internetSettingsContainer = document.createElement('div');
        this.internetSettingsContainer.className = 'internet-settings-container hidden';

        // Provider URL
        const urlGroup = document.createElement('div');
        urlGroup.className = 'settings-group';
        urlGroup.innerHTML = `
            <label>Provider URL:</label>
            <input type="text" id="providerUrl" placeholder="https://api.example.com">
        `;

        // API Key
        const keyGroup = document.createElement('div');
        keyGroup.className = 'settings-group';
        keyGroup.innerHTML = `
            <label>API Key:</label>
            <input type="password" id="apiKey" placeholder="••••••••••••">
        `;

        // Test Button
        this.testConnectionButton = document.createElement('button');
        this.testConnectionButton.className = 'test-connection-button';
        this.testConnectionButton.textContent = 'Verify Connection';

        this.internetSettingsContainer.append(urlGroup, keyGroup, this.testConnectionButton);
        return this.internetSettingsContainer;
    }

    /**
     * Creates the model settings section.
     * @returns {HTMLElement} - The model settings container.
     */
    createModelSettings() {
        const container = document.createElement('div');
        container.className = 'model-settings-group';

        // Temperature
        const tempGroup = document.createElement('div');
        tempGroup.className = 'settings-group';
        tempGroup.innerHTML = `
            <label>Temperature:</label>
            <input type="number" id="temperature" value="0.7" step="0.1">
        `;

        // Max Tokens
        const tokensGroup = document.createElement('div');
        tokensGroup.className = 'settings-group';
        tokensGroup.innerHTML = `
            <label>Max Tokens:</label>
            <input type="number" id="maxTokens" value="100">
        `;

        // System Prompt
        const promptGroup = document.createElement('div');
        promptGroup.className = 'settings-group';
        promptGroup.innerHTML = `
            <label>System Prompt:</label>
            <textarea id="systemPrompt">You are a helpful assistant.</textarea>
        `;

        container.append(tempGroup, tokensGroup, promptGroup);
        return container;
    }

    /**
     * Creates the save button.
     * @returns {HTMLElement} - The button element.
     */
    createSaveButton() {
        const button = document.createElement('button');
        button.className = 'save-settings-btn';
        button.textContent = 'Save Configuration';
        return button;
    }

    /**
     * Creates the delete button.
     * @returns {HTMLElement} - The button element.
     */
    createDeleteButton() {
        const button = document.createElement('button');
        button.className = 'delete-settings-btn';
        button.textContent = 'Delete Configuration';
        return button;
    }

    // ========================
    // Event Handling
    // ========================

    /**
     * Binds event listeners to UI elements.
     */
    bindEvents() {
        this.deploymentTypeDropdown.addEventListener('change', (e) => this.toggleDeploymentType(e.target.value));
        this.providerDropdown.addEventListener('change', (e) => this.toggleModelDropdown(e.target.value));
        this.container.querySelector('.save-settings-btn').addEventListener('click', () => this.saveAISettings());
        this.container.querySelector('.delete-settings-btn').addEventListener('click', () => this.deleteAISettings());
        this.testConnectionButton?.addEventListener('click', () => this.testConnection());
        this.container.querySelector('.create-new-button').addEventListener('click', () => this.resetForm());
    }

    // ========================
    // API Interactions
    // ========================

    /**
     * Fetches available models from the backend.
     * @returns {Promise<string[]>} - An array of model names.
     */
    async fetchModels() {
        try {
            const response = await fetch(`${this.apiEndpoint}/api/ollama/tags`, {
                credentials: 'include', // Include cookies for authenticated requests
            });
    
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }
    
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to fetch models:', error);
            this.displayError('Failed to load available models. Please check your connection or try again later.');
            return []; // Return an empty array as a fallback
        }
    }
 
 
 
    /**
     * Populates the model dropdown with available models.
     */
    async populateModelDropdown() {
        try {
            const models = await this.fetchModels();
            if (models.length === 0) {
                console.warn('No models available or failed to fetch models.');
                this.displayError('No models available. Please check your connection or server configuration.');
            }
            this.updateModelDropdown(models, 'Model dropdown populated successfully.');
        } catch (error) {
            console.error('Model load failed:', error);
            this.displayError('Failed to load available models.');
            this.updateModelDropdown([], 'No models loaded due to an error.');
        }
    }

    

    /**
     * Updates the model dropdown with the provided models.
     * @param {string[]} models - Array of model names.
     * @param {string} successMessage - Message to log upon successful update.
     */
    updateModelDropdown(models, successMessage) {
        this.modelDropdownContainer.innerHTML = ''; // Clear existing content

        if (models.length === 0) {
            const noModelsMessage = document.createElement('p');
            noModelsMessage.textContent = 'No models available.';
            this.modelDropdownContainer.appendChild(noModelsMessage);
        } else {
            const dropdown = this.createModelDropdown(models);
            this.modelDropdownContainer.appendChild(dropdown);
        }

        this.modelDropdownContainer.classList.remove('hidden'); // Ensure the dropdown is visible
        console.log(successMessage);
    }

    /**
     * Creates a dropdown element populated with the provided models.
     * @param {string[]} models - Array of model names.
     * @returns {HTMLSelectElement} - The dropdown element.
     */
    createModelDropdown(models) {
        const dropdown = document.createElement('select');
        dropdown.className = 'model-selector';
        dropdown.id = 'modelDropdown';

        // Add a default "Select a model" option
        dropdown.appendChild(this.createDropdownOption('', 'Select a model'));

        // Add each model as an option
        models.forEach(model => {
            dropdown.appendChild(this.createDropdownOption(model, model));
        });

        return dropdown;
    }

    /**
     * Creates a dropdown option element.
     * @param {string} value - The value of the option.
     * @param {string} text - The display text of the option.
     * @returns {HTMLOptionElement} - The option element.
     */
    createDropdownOption(value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    }

    /**
     * Sends a chat message to the backend.
     * @param {Object} payload - The chat message payload.
     * @returns {Promise<Object>} - The response from the backend.
     */
    async sendChatMessage(payload) {
        try {
            const response = await fetch(`${this.apiEndpoint}/api/ollama/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                credentials: 'include', // Include credentials (cookies)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to send chat message:', error);
            this.displayError('Failed to send chat message. Please try again.');
            return { error: error.message };
        }
    }

    /**
     * Fetches details about a specific model from the backend.
     * @param {string} modelName - The name of the model.
     * @returns {Promise<Object>} - The model details.
     */
    async fetchModelDetails(modelName) {
        try {
            const response = await fetch(`${this.apiEndpoint}/api/ollama/models/${modelName}`, {
                credentials: 'include', // Include credentials (cookies)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch model details:', error);
            this.displayError('Failed to fetch model details. Please try again.');
            return { error: error.message };
        }
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Displays an error message.
     * @param {string} message - The error message to display.
     */
    displayError(message) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = message;
        this.container.appendChild(errorMessage);
        setTimeout(() => errorMessage.remove(), 5000);
    }

    /**
     * Displays a success message.
     * @param {string} message - The success message to display.
     */
    displaySuccess(message) {
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = message;
        this.container.appendChild(successMessage);
        setTimeout(() => successMessage.remove(), 5000);
    }

    // ========================
    // Additional Methods
    // ========================

    /**
     * Initializes UI elements.
     */
    initializeUIElements() {
        try {
            this.providerUrlInput = this.container.querySelector('#providerUrl');
            this.apiKeyInput = this.container.querySelector('#apiKey');
            this.temperatureInput = this.container.querySelector('#temperature');
            this.maxTokensInput = this.container.querySelector('#maxTokens');
            this.systemPromptInput = this.container.querySelector('#systemPrompt');

            // Initialize default state
            this.toggleDeploymentType(this.deploymentTypeDropdown.value);
        } catch (error) {
            console.error('UI initialization failed:', error);
            this.displayError('Failed to initialize UI components');
        }
    }

    /**
     * Toggles the visibility of deployment-specific UI elements.
     * @param {string} type - The deployment type ('local' or 'internet').
     */
    toggleDeploymentType(type) {
        const newSettingsSection = this.container.querySelector('.new-settings-section');
        const modelDropdownContainer = this.container.querySelector('.model-dropdown-container');

        if (type === 'local') {
            newSettingsSection.classList.add('hidden');
            modelDropdownContainer.classList.remove('hidden');
            this.providerUrlInput.value = '';
            this.apiKeyInput.value = '';
        } else if (type === 'internet') {
            newSettingsSection.classList.remove('hidden');
            modelDropdownContainer.classList.add('hidden');
            const modelDropdown = this.container.querySelector('#modelDropdown');
            if (modelDropdown) modelDropdown.value = '';
        }
    }

    /**
     * Toggles the model dropdown based on the selected provider.
     * @param {string} provider - The selected provider.
     */
    async toggleModelDropdown(provider) {
        if (provider === 'Ollama') {
            this.modelDropdownContainer.classList.remove('hidden');
            await this.populateModelDropdown();
        } else {
            this.modelDropdownContainer.classList.add('hidden');
        }
    }

    /**
     * Resets the form to its default state.
     */
    resetForm() {
        this.settingNameInput.value = '';
        this.temperatureInput.value = 0.7;
        this.maxTokensInput.value = 100;
        this.systemPromptInput.value = 'You are a helpful assistant.';
        this.providerUrlInput.value = '';
        this.apiKeyInput.value = '';
        this.deploymentTypeDropdown.value = 'local';
        this.toggleDeploymentType('local');
        this.pastSettingsDropdown.value = '';

        const newSettingsSection = this.container.querySelector('.new-settings-section');
        if (newSettingsSection) {
            newSettingsSection.classList.add('hidden');
        }
    }

    /**
     * Saves the AI settings to the backend.
     */
    async saveAISettings() {
        try {
            const payload = this.buildPayload();
            const response = await fetch(`${this.apiEndpoint}/ai-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ settings: payload }),
                credentials: 'include', // Include credentials (cookies)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Save failed');
            }

            this.displaySuccess('Configuration saved successfully');
            await this.populatePastSettingsDropdown();
        } catch (error) {
            console.error('Save failed:', error);
            this.displayError(error.message || 'Failed to save configuration');
        }
    }

    /**
     * Builds the payload for saving settings.
     * @returns {Object} - The payload object.
     */
    buildPayload() {
        const payload = {
            profile_name: this.settingNameInput.value.trim(),
            deployment: this.deploymentTypeDropdown.value,
            provider: this.providerDropdown.value,
            settings: {
                model_name: this.deploymentTypeDropdown.value === 'local' 
                    ? this.container.querySelector('#modelDropdown')?.value 
                    : null,
                temperature: parseFloat(this.temperatureInput.value),
                max_tokens: parseInt(this.maxTokensInput.value),
                system_prompt: this.systemPromptInput.value,
                api_key: this.apiKeyInput.value,
                api_endpoint: this.providerUrlInput.value
            }
        };
        console.log('Built payload:', payload); // Log the payload for debugging
        return payload;
    }

    /**
     * Validates the payload before saving.
     * @param {Object} payload - The payload to validate.
     * @throws {Error} - If validation fails.
     */
    validatePayload(payload) {
        if (!payload.profile_name) {
            throw new Error('Configuration name is required');
        }
        if (payload.deployment === 'internet' && (!payload.settings.api_key || !payload.settings.api_endpoint)) {
            throw new Error('API credentials required for cloud deployment');
        }
        if (payload.settings.temperature < 0 || payload.settings.temperature > 2) {
            throw new Error('Temperature must be between 0 and 2');
        }
        if (payload.settings.max_tokens <= 0) {
            throw new Error('Max tokens must be greater than 0');
        }
    }

    /**
     * Emits a custom event to notify that settings have been updated.
     */
    emitSettingsUpdated() {
        document.dispatchEvent(new CustomEvent('settingsUpdated'));
    }

    /**
     * Tests the connection to the provider API.
     */
    async testConnection() {
        try {
            const providerUrl = this.providerUrlInput.value.trim();
            const apiKey = this.apiKeyInput.value.trim();

            if (!providerUrl || !apiKey) {
                throw new Error('Provider URL and API key are required');
            }

            const response = await fetch(`${providerUrl}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Connection test failed');
            const data = await response.json();

            if (data.object === 'list') {
                this.displaySuccess('Connection successful');
                return true;
            }
            throw new Error('Unexpected response format');
        } catch (error) {
            console.error('Connection failed:', error);
            this.displayError('Connection test failed: ' + error.message);
            return false;
        }
    }

    /**
     * Deletes the selected AI settings from the backend.
     */
    async deleteAISettings(setting_id) {
        try {
            const response = await fetch(`${this.apiEndpoint}/ai-settings/${setting_id}`, {
                method: 'DELETE',
                credentials: 'include', // Include credentials (cookies)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Delete failed');
            }

            this.displaySuccess('Configuration deleted successfully');
            await this.populatePastSettingsDropdown();
        } catch (error) {
            console.error('Delete failed:', error);
            this.displayError(error.message || 'Failed to delete configuration');
        }
    }

    /**
     * Fetches and displays the current model settings from the backend.
     */
    async fetchAndDisplayCurrentModel() {
        try {
            const response = await fetch(`${this.apiEndpoint}/ai-settings/current`, {
                credentials: 'include', // Include credentials (cookies)
            });
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            const currentModel = await response.json();
            console.log('Fetched current model:', currentModel);

            if (currentModel) {
                this.selectPastSetting(currentModel);
            }
        } catch (error) {
            console.error('Failed to fetch current model:', error);
            this.displayError('Failed to load current model settings.');
        }
    }

    /**
     * Applies the selected past settings to the form.
     * @param {Object} setting - The settings object to apply.
     */
    selectPastSetting(setting) {
        try {
            console.log('Applying past settings:', setting);

            this.settingNameInput.value = setting.profile_name || '';
            this.temperatureInput.value = setting.temperature || 0.7;
            this.maxTokensInput.value = setting.max_tokens || 100;
            this.systemPromptInput.value = setting.system_prompt || '';

            // Update deployment type
            this.deploymentTypeDropdown.value = setting.deployment_type || 'local';
            this.toggleDeploymentType(this.deploymentTypeDropdown.value);

            console.log('Past settings applied successfully.');
        } catch (error) {
            console.error('Error applying past settings:', error);
        }
    }

    /**
     * Populates the past settings dropdown.
     */
    async populatePastSettingsDropdown() {
        try {
            const response = await fetch(`${this.apiEndpoint}/ai-settings`, {
                credentials: 'include', // Include credentials (cookies)
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const pastSettings = await response.json();
            console.log('Populating past settings dropdown with:', pastSettings);

            this.pastSettingsDropdown.innerHTML = '';

            pastSettings.forEach((setting, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = setting.profile_name || `Settings ${index + 1}`;
                this.pastSettingsDropdown.appendChild(option);
            });

            console.log('Past settings dropdown populated successfully.');
        } catch (error) {
            console.error('Failed to populate past settings dropdown:', error);
            this.displayError('Failed to load past settings.');
        }
    }

    /**
     * Toggles the visibility of the "Create New" mode.
     * @param {boolean} isCreateNewMode - Whether to enable or disable create new mode.
     */
    toggleCreateNewMode(isCreateNewMode) {
        const newSettingsSection = this.container.querySelector('.new-settings-section');
        if (isCreateNewMode) {
            if (this.deploymentTypeDropdown.value === 'internet') {
                newSettingsSection.classList.remove('hidden');
            }
            if (this.deploymentTypeDropdown.value === 'local') {
                this.modelDropdownContainer.classList.remove('hidden');
            }
        } else {
            newSettingsSection.classList.add('hidden');
            this.modelDropdownContainer.classList.add('hidden');
        }
    }
}

if (typeof SettingsWidget !== 'undefined') {
    console.log('SettingsWidget successfully loaded.');
} else {
    console.error('SettingsWidget failed to load.');
}