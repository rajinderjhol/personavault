const DEFAULT_API_ENDPOINT = "http://localhost:5001";

export default class SettingsWidget {
    constructor(container, apiEndpoint = DEFAULT_API_ENDPOINT) {
        this.modelsLoading = true;
        this.container = this.resolveContainer(container);
        this.apiEndpoint = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
        this.elements = {};
        this.initialize();
    }

    // ========================
    // Core Initialization
    // ========================
    async initialize() {
        try {
            this.renderUI();
            this.initializeUIElements();
            this.bindEvents();
            this.toggleDeploymentType(this.elements.deploymentType.value);
            
            await this.populateModelDropdown();
            await Promise.all([
                this.fetchAndDisplayCurrentModel(),
                this.populatePastSettingsDropdown()
            ]);

            console.log("SettingsWidget initialized");
        } catch (error) {
            console.error("Initialization error:", error);
            this.displayError("Initialization failed. Check console.");
        }
    }

    // ========================
    // UI Elements & Rendering
    // ========================
    renderUI() {
        this.container.innerHTML = `
            <div class="settings-widget">
                <div class="settings-header">
                    <div class="settings-group">
                        <label for="past-settings-selector">Current Settings:</label>
                        <select id="past-settings-selector" class="past-settings-selector">
                            <option value="" disabled selected>Loading...</option>
                        </select>
                    </div>
                    <div class="header-buttons">
                        <button class="create-new-button">Create New</button>
                        <button class="refresh-models-button" title="Refresh models">⟳</button>
                    </div>
                </div>
                <div class="settings-form">
                    <div class="settings-group">
                        <label for="settingNameInput">Setting Name:</label>
                        <input id="settingNameInput" type="text" placeholder="e.g., Medical Assistant Config" required>
                    </div>
                    <div class="new-settings-section">
                        <div class="settings-group">
                            <label for="deploymentTypeDropdown">Deployment Type:</label>
                            <select id="deploymentTypeDropdown">
                                <option value="local">Local</option>
                                <option value="internet">Internet</option>
                                <option value="hybrid">Hybrid</option>
                            </select>
                        </div>
                        <div class="settings-group">
                            <label for="providerDropdown">Provider:</label>
                            <select id="providerDropdown">
                                <option value="Ollama">Ollama</option>
                            </select>
                        </div>
                        <div id="modelDropdownContainer" class="settings-group">
                            <label for="modelDropdown">Model:</label>
                            <select id="modelDropdown">
                            <option value="" disabled selected>${this.modelsLoading ? 'Loading models...' : 'No models available'}</option>
                            </select>
                        </div>
                        <div id="internet-settings-container" class="internet-settings-container hidden">
                            <div class="settings-group">
                                <label for="providerUrl">Provider URL:</label>
                                <input id="providerUrl" type="text" placeholder="https://api.example.com">
                            </div>
                            <div class="settings-group">
                                <label for="apiKey">API Key:</label>
                                <input id="apiKey" type="password" placeholder="••••••••••••">
                            </div>
                            <button type="button" class="test-connection-button">Verify Connection</button>
                        </div>
                        <div class="model-settings-group">
                            <div class="settings-group">
                                <label for="temperature">Temperature:</label>
                                <input id="temperature" type="number" min="0" max="2" step="0.1" value="0.7" required>
                            </div>
                            <div class="settings-group">
                                <label for="maxTokens">Max Tokens:</label>
                                <input id="maxTokens" type="number" min="1" value="100" required>
                            </div>
                            <div class="settings-group">
                                <label for="systemPrompt">System Prompt:</label>
                                <textarea id="systemPrompt" required>You are a helpful assistant.</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="save-settings-btn">Save Configuration</button>
                        <button type="button" class="delete-settings-btn" disabled>Delete Configuration</button>
                    </div>
                </div>
                <div class="loading-spinner hidden"></div>
                <div class="error-message hidden"></div>
                <div class="status-message hidden"></div>
            </div>
        `;
    }

    initializeUIElements() {
        const getElement = (selector) => this.container.querySelector(selector);
        
        this.elements = {
            pastSettings: getElement('#past-settings-selector'),
            settingName: getElement('#settingNameInput'),
            deploymentType: getElement('#deploymentTypeDropdown'),
            provider: getElement('#providerDropdown'),
            modelDropdown: getElement('#modelDropdown'),
            modelDropdownContainer: getElement('#modelDropdownContainer'),
            internetSettings: getElement('#internet-settings-container'),
            temperature: getElement('#temperature'),
            maxTokens: getElement('#maxTokens'),
            systemPrompt: getElement('#systemPrompt'),
            providerUrl: getElement('#providerUrl'),
            apiKey: getElement('#apiKey'),
            testConnection: getElement('.test-connection-button'),
            saveButton: getElement('.save-settings-btn'),
            deleteButton: getElement('.delete-settings-btn'),
            createNewButton: getElement('.create-new-button'),
            refreshModelsButton: getElement('.refresh-models-button'),
            loadingSpinner: getElement('.loading-spinner'),
            errorMessage: getElement('.error-message'),
            statusMessage: getElement('.status-message')
        };
    }

    // ========================
    // Event Handling
    // ========================
    bindEvents() {
        this.elements.deploymentType.addEventListener('change', (e) => 
            this.toggleDeploymentType(e.target.value));
        
        this.elements.testConnection.addEventListener('click', () => 
            this.testConnectionHandler());
        
        this.elements.saveButton.addEventListener('click', () => 
            this.saveSettings());
        
        this.elements.deleteButton.addEventListener('click', () => 
            this.deleteSettings());
        
        this.elements.createNewButton.addEventListener('click', () => 
            this.createNewConfiguration());
        
        this.elements.refreshModelsButton.addEventListener('click', () => 
            this.populateModelDropdown());
        
        this.elements.pastSettings.addEventListener('change', (e) => {
            this.elements.deleteButton.disabled = !e.target.value;
            this.loadPastSettings(e.target.value);
        });
    }

    // ========================
    // Core Functionality
    // ========================
    async saveSettings() {
        const isInternet = this.elements.deploymentType.value === 'internet';
        const isHybrid = this.elements.deploymentType.value === 'hybrid';

        try {
            // Validation
            if (!this.elements.settingName.value.trim()) {
                throw new Error('Setting name is required');
            }
            // Model Validation
            const deploymentType = this.elements.deploymentType.value;
            if (deploymentType !== 'internet' && !this.elements.modelDropdown.value) {
                throw new Error('Model selection is required');
            }
            // Internet Settings Validation
            if ((isInternet || isHybrid) && !this.validateInternetSettings()) {
                return;
            }

            this.setLoading(true);

            // payload construction
            const payload = {
                profile_name: this.elements.settingName.value.trim(),
                deployment_type: this.elements.deploymentType.value,
                provider_type: this.elements.provider.value, // Ensure this matches the backend's expected field name
                model_name: this.elements.modelDropdown.value,
                temperature: parseFloat(this.elements.temperature.value),
                max_tokens: parseInt(this.elements.maxTokens.value, 10),
                system_prompt: this.elements.systemPrompt.value.trim(),
                api_endpoint: (isInternet || isHybrid) ? this.elements.providerUrl.value.trim() : '',
                api_key: (isInternet || isHybrid) ? this.elements.apiKey.value.trim() : ''
            };
            if (isInternet || isHybrid) {
                payload.api_endpoint = this.elements.providerUrl.value.trim();
                payload.api_key = this.elements.apiKey.value.trim();
            }

            console.log("Saving payload:", payload);  // Debugging

            // API call
            const response = await fetch(`${this.apiEndpoint}/api/ollama/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save settings');
            }

            this.displayStatus('Settings saved successfully');
            await this.populatePastSettingsDropdown();
            this.createNewConfiguration();

        } catch (error) {
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    // ======================== 
    validateInternetSettings() {
        const urlValue = this.elements.providerUrl.value.trim();
        
        if (!urlValue) {
            this.displayError('Provider URL is required');
            return false;
        }

        try {
            new URL(urlValue);
        } catch {
            this.displayError('Invalid Provider URL format');
            return false;
        }

        if (!this.elements.apiKey.value.trim()) {
            this.displayError('API Key is required');
            return false;
        }

        return true;
    }

    async deleteSettings() {
        const selectedId = this.elements.pastSettings.value;
        if (!selectedId || !confirm('Are you sure you want to delete this configuration?')) return;

        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.apiEndpoint}/api/ollama/settings/${selectedId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to delete settings');

            this.displayStatus('Configuration deleted successfully');
            await this.populatePastSettingsDropdown();
            this.createNewConfiguration();

        } catch (error) {
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    // ========================
    // Data Management
    // ========================
    async populateModelDropdown() {
        try {
            const response = await fetch(`${this.apiEndpoint}/api/ollama/models`, {
                credentials: 'include'
            });
    
            // Add HTTP error handling
            if (response.status === 404) {
                throw new Error('Models endpoint not found - Check backend routes');
            }
            if (response.status >= 500) {
                throw new Error('Backend service unavailable');
            }
            if (response.status === 503) {
                throw new Error('Ollama service unavailable - Ensure Ollama is running');
            }
    
            const data = await response.json();
            
            // Add this critical line to actually populate the dropdown with models
            this.elements.modelDropdown.innerHTML = data.models
                .map(m => `<option value="${m.model_name}">${m.model_name}</option>`)
                .join('');
    
            if (!data.models || data.models.length === 0) {
                this.displayError('No models available - Add models first');
                this.elements.modelDropdown.innerHTML = `
                    <option value="" disabled>
                        No models found. Install models via Ollama
                    </option>
                `;
                return;
            }
    
            this.modelsLoading = false;
        } catch (error) {
            // Improved error logging
            console.error('Model loading failed:', error);
            this.displayError(error.message);
            this.elements.modelDropdown.innerHTML = `
                <option value="" disabled>
                    ${error.message} - Check console for details
                </option>
            `;
            this.modelsLoading = false;
        }
    }

    // ========================
    async fetchAndDisplayCurrentModel() {
        try {
            console.log("Fetching current settings...");  // Debugging
            const response = await fetch(`${this.apiEndpoint}/api/ollama/settings/current`, {
                credentials: 'include'
            });
    
            // Handle 404 as empty state rather than error
            if (response.status === 404) {
                console.log('No current settings found - using defaults');
                this.setDefaultValues();
                return;
            }
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch current settings');
            }
    
            const data = await response.json();
            
            // Handle empty response
            if (!data || !data.model_name) {
                console.warn('Received empty current settings - using defaults');
                this.setDefaultValues();
                return;
            }
    
            // Apply settings
            this.elements.modelDropdown.value = data.model_name;
            this.elements.deploymentType.value = data.deployment_type || 'local';
            this.elements.provider.value = data.provider_type || 'Ollama';
            this.elements.providerUrl.value = data.api_endpoint || '';
            this.toggleDeploymentType(data.deployment_type || 'local');
            this.elements.temperature.value = data.temperature ?? 0.7;
            this.elements.maxTokens.value = data.max_tokens ?? 100;
            this.elements.systemPrompt.value = data.system_prompt ?? 'You are a helpful assistant.';
    
        } catch (error) {
            // Only show error if it's not a "not found" case
            if (!error.message.includes('404')) {
                this.displayError(error.message);
            }
            this.setDefaultValues();
        }
    }
    
    // Add this new method to your class
    setDefaultValues() {
        this.elements.deploymentType.value = 'local';
        this.elements.provider.value = 'Ollama';
        this.elements.temperature.value = 0.7;
        this.elements.maxTokens.value = 100;
        this.elements.systemPrompt.value = 'You are a helpful assistant.';
        this.toggleDeploymentType('local');
    }


// ========================

async populatePastSettingsDropdown() {
    try {
        const response = await fetch(`${this.apiEndpoint}/api/ollama/settings/past`, {
            method: 'GET',
            credentials: 'include'
        });

        console.log(await response.text()); // Debug the response

        if (!response.ok) {
            throw new Error(`Failed to load history. Status: ${response.status}`);
        }

        const pastSettings = await response.json();

        if (!Array.isArray(pastSettings) || pastSettings.length === 0) {
            this.elements.pastSettings.innerHTML = `<option value="" disabled>No saved configurations yet</option>`;
            this.elements.deleteButton.disabled = true;
            return;
        }

        this.elements.pastSettings.innerHTML = pastSettings
            .map(s => `<option value="${s.id}">${s.profile_name}</option>`)
            .join('');

        this.elements.deleteButton.disabled = false;

    } catch (error) {
        console.error('Settings history load failed:', error);
        this.displayError(`Settings history: ${error.message}`);
        this.elements.pastSettings.innerHTML = `<option value="" disabled>Error loading history</option>`;
        this.elements.deleteButton.disabled = true;
    }
}



// ========================



    // ========================
    // Connection Testing
    // ========================
    async testConnectionHandler() {
        try {
            if (!this.validateInternetSettings()) return;
            const response = await fetch(`${this.apiEndpoint}/ollama/test-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_endpoint: this.elements.providerUrl.value,
                    api_key: this.elements.apiKey.value
                }),
                credentials: 'include'
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Connection failed');
            this.displayStatus('Connection successful!');
        } catch (error) {
            this.displayError(`Connection test failed: ${error.message}`);
        }
    }

    // ========================
    // UI Utilities
    // ========================
    setLoading(isLoading) {
        if (!this.elements.loadingSpinner) return;
        
        this.elements.loadingSpinner.classList.toggle('hidden', !isLoading);
        this.container.querySelectorAll('button, input, select')
            .forEach(el => el.disabled = isLoading);
    }

    displayError(message) {
        if (!this.elements.errorMessage) return;
        
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    displayStatus(message) {
        if (!this.elements.statusMessage) return;
        
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.classList.remove('hidden');
        setTimeout(() => {
            this.elements.statusMessage.classList.add('hidden');
        }, 3000);
    }

    toggleDeploymentType(type) {
        const showInternetSettings = ['internet', 'hybrid'].includes(type);
        const hideModelDropdown = type === 'internet';

        if (this.elements.internetSettings && this.elements.modelDropdownContainer) {
            this.elements.modelDropdown.required = type !== 'internet';
            this.elements.internetSettings.classList.toggle('hidden', !showInternetSettings);
            this.elements.modelDropdownContainer.classList.toggle('hidden', hideModelDropdown);
        }
    }

    // ========================
    // Form Management
    // ========================
    createNewConfiguration() {
        this.elements.deploymentType.value = 'local'; 
        this.elements.settingName.value = '';
        this.elements.modelDropdown.value = '';
        this.populateFormWithSettings({});
        this.displayStatus('New configuration ready');
        this.toggleDeploymentType('local');
    }

    async loadPastSettings() {
        try {
            this.setLoading(true);
    
            const response = await fetch(`${this.apiEndpoint}/api/ollama/settings/past`, {
                method: 'GET',
                credentials: 'include', // Sends cookies
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error(`Failed to load settings: ${response.statusText}`);
            }
    
            const settings = await response.json();
            this.populateFormWithSettings(settings);
    
        } catch (error) {
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }
    

    populateFormWithSettings(settings = {}) {
        this.elements.settingName.value = settings.profile_name || '';
        this.elements.temperature.value = settings.temperature || 0.7;
        this.elements.maxTokens.value = settings.max_tokens || 100;
        this.elements.systemPrompt.value = settings.system_prompt || '';
        this.elements.deploymentType.value = settings.deployment_type || 'local';
        this.elements.providerUrl.value = settings.api_endpoint || '';
        this.elements.apiKey.value = '';
        this.toggleDeploymentType(settings.deployment_type || 'local');
        
        if (settings.model_name) {
            this.elements.modelDropdown.value = settings.model_name;
        }
    }

    // ========================
    // Utility Methods
    // ========================
    resolveContainer(container) {
        if (typeof container === "string") {
            const element = document.querySelector(container);
            if (!element) throw new Error(`Container not found: ${container}`);
            return element;
        }
        if (container instanceof HTMLElement) return container;
        throw new Error("Invalid container type");
    }
}

