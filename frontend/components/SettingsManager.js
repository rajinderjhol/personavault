/**
 * SettingsWidget class for managing user settings in the AI Chatbot application.
 * This class handles rendering the settings UI, fetching settings from the database,
 * updating settings, and displaying the current settings at the bottom.
 */
export default class SettingsWidget {
    /**
     * Constructor for the SettingsWidget class.
     * @param {HTMLElement} container - The container element for the settings widget.
     * @param {string} classPrefix - A unique prefix for DOM element classes to avoid conflicts.
     */
    constructor(container, classPrefix = '') {
        this.container = container;
        this.classPrefix = classPrefix;
        this.settings = {
            local: {
                model_name: 'phi:latest',
                temperature: 0.7,
                max_tokens: 100,
                system_prompt: 'You are a helpful assistant.',
                response_format: 'text',
                language: 'en',
            },
            internet: {
                api_key: '',
                model_name: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 100,
                system_prompt: 'You are a helpful assistant.',
                response_format: 'text',
                language: 'en',
            },
        };
    }

    // ========================
    // Initialization Methods
    // ========================

    /**
     * Renders the settings UI inside the container.
     */
    renderUI() {
        this.container.innerHTML = `
            <div class="${this.classPrefix}settings-window">
                <!-- Local AI Settings -->
                <h3>Local AI Settings</h3>
                <label for="${this.classPrefix}local-model-select">Model:</label>
                <select class="${this.classPrefix}local-model-select" id="${this.classPrefix}local-model-select">
                    <option value="phi:latest">Phi: Latest</option>
                    <option value="llama2">Llama 2</option>
                    <option value="mistral">Mistral</option>
                </select>

                <label for="${this.classPrefix}local-temperature">Temperature:</label>
                <input type="number" class="${this.classPrefix}local-temperature" id="${this.classPrefix}local-temperature" min="0" max="1" step="0.1" />

                <label for="${this.classPrefix}local-max-tokens">Max Tokens:</label>
                <input type="number" class="${this.classPrefix}local-max-tokens" id="${this.classPrefix}local-max-tokens" min="1" max="1000" />

                <label for="${this.classPrefix}local-system-prompt">System Prompt:</label>
                <textarea class="${this.classPrefix}local-system-prompt" id="${this.classPrefix}local-system-prompt"></textarea>

                <label for="${this.classPrefix}local-response-format">Response Format:</label>
                <select class="${this.classPrefix}local-response-format" id="${this.classPrefix}local-response-format">
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                </select>

                <label for="${this.classPrefix}local-language">Language:</label>
                <select class="${this.classPrefix}local-language" id="${this.classPrefix}local-language">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                </select>

                <button class="${this.classPrefix}local-save-btn">Save Local Settings</button>

                <!-- Internet AI Settings -->
                <h3>Internet AI Settings</h3>
                <label for="${this.classPrefix}internet-api-key">API Key:</label>
                <input type="text" class="${this.classPrefix}internet-api-key" id="${this.classPrefix}internet-api-key" />

                <label for="${this.classPrefix}internet-model-select">Model:</label>
                <select class="${this.classPrefix}internet-model-select" id="${this.classPrefix}internet-model-select">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="huggingface">Hugging Face</option>
                    <option value="deepseek">DeepSeek</option>
                </select>

                <label for="${this.classPrefix}internet-temperature">Temperature:</label>
                <input type="number" class="${this.classPrefix}internet-temperature" id="${this.classPrefix}internet-temperature" min="0" max="1" step="0.1" />

                <label for="${this.classPrefix}internet-max-tokens">Max Tokens:</label>
                <input type="number" class="${this.classPrefix}internet-max-tokens" id="${this.classPrefix}internet-max-tokens" min="1" max="1000" />

                <label for="${this.classPrefix}internet-system-prompt">System Prompt:</label>
                <textarea class="${this.classPrefix}internet-system-prompt" id="${this.classPrefix}internet-system-prompt"></textarea>

                <label for="${this.classPrefix}internet-response-format">Response Format:</label>
                <select class="${this.classPrefix}internet-response-format" id="${this.classPrefix}internet-response-format">
                    <option value="text">Text</option>
                    <option value="json">JSON</option>
                </select>

                <label for="${this.classPrefix}internet-language">Language:</label>
                <select class="${this.classPrefix}internet-language" id="${this.classPrefix}internet-language">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                </select>

                <button class="${this.classPrefix}internet-save-btn">Save Internet Settings</button>

                <!-- Display Current Settings -->
                <h3>Current Settings</h3>
                <pre class="${this.classPrefix}current-settings"></pre>
            </div>
        `;

        // Bind event listeners after rendering
        this.bindEvents();

        // Load saved settings from the database
        this.loadSettings();
    }

    /**
     * Binds event listeners for the settings widget.
     */
    bindEvents() {
        // Local AI Settings Save Button
        const localSaveButton = this.container.querySelector(`.${this.classPrefix}local-save-btn`);
        if (localSaveButton) {
            localSaveButton.addEventListener('click', () => this.handleSaveSettings('local'));
        }

        // Internet AI Settings Save Button
        const internetSaveButton = this.container.querySelector(`.${this.classPrefix}internet-save-btn`);
        if (internetSaveButton) {
            internetSaveButton.addEventListener('click', () => this.handleSaveSettings('internet'));
        }
    }

    /**
     * Handles saving the settings for a specific type (local or internet).
     * @param {string} type - The type of settings to save ('local' or 'internet').
     */
    async handleSaveSettings(type) {
        const settings = this.getSettings(type);
        this.settings[type] = settings;
    
        try {
            await this.saveSettingsToDB(type, settings);
            console.log(`${type} settings saved:`, settings);
    
            // Update UniObjectHolder with the latest settings
            UniObjectHolder.setObject('aiSettings', { ...this.settings.local, ...this.settings.internet });
    
            this.displayCurrentSettings();
        } catch (error) {
            console.error(`Error saving ${type} settings:`, error);
        }
    }

    /**
     * Loads settings from the database and applies them to the UI.
     */
    async loadSettings() {
        try {
            const localSettings = await this.fetchSettingsFromDB('local');
            const internetSettings = await this.fetchSettingsFromDB('internet');
    
            this.settings.local = localSettings;
            this.settings.internet = internetSettings;
    
            // Update UniObjectHolder with the latest settings
            UniObjectHolder.setObject('aiSettings', { ...localSettings, ...internetSettings });
    
            this.applySettings('local', localSettings);
            this.applySettings('internet', internetSettings);
    
            this.displayCurrentSettings();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }


    /**
     * Applies the given settings to the UI.
     * @param {string} type - The type of settings to apply ('local' or 'internet').
     * @param {Object} settings - The settings to apply.
     */
    applySettings(type, settings) {
        const inputs = {
            'model-select': settings.model_name,
            'temperature': settings.temperature,
            'max-tokens': settings.max_tokens,
            'top-p': settings.top_p,
            'system-prompt': settings.system_prompt,
            'response-format': settings.response_format,
            'language': settings.language,
        };
    
        // Only add 'api-key' for internet settings
        if (type === 'internet') {
            inputs['api-key'] = settings.api_key;
        }
    
        Object.entries(inputs).forEach(([id, value]) => {
            const input = this.container.querySelector(`.${this.classPrefix}${type}-${id}`);
            if (input) {
                if (input.tagName === 'SELECT') {
                    const option = input.querySelector(`option[value="${value}"]`);
                    if (option) {
                        option.selected = true;
                    }
                } else if (input.tagName === 'TEXTAREA') {
                    input.value = value;
                } else {
                    input.value = value;
                }
                console.log(`Applied setting: ${type}-${id} = ${value}`); // Log applied settings
            } else {
                console.warn(`Input element not found for ${type}-${id}`);
            }
        });
    }

    /**
     * Retrieves the current settings from the UI.
     * @param {string} type - The type of settings to retrieve ('local' or 'internet').
     * @returns {Object} - The current settings.
     */
    getSettings(type) {
        const inputs = {
            'model-select': 'value',
            'temperature': 'value',
            'max-tokens': 'value',
            'system-prompt': 'value',
            'response-format': 'value',
            'language': 'value',
            'api-key': 'value', // Only for internet settings
        };

        const settings = {};
        Object.entries(inputs).forEach(([id, prop]) => {
            const input = this.container.querySelector(`.${this.classPrefix}${type}-${id}`);
            if (input) {
                if (id === 'temperature') {
                    settings[id.replace('-', '_')] = parseFloat(input[prop]);
                } else if (id === 'max-tokens') {
                    settings[id.replace('-', '_')] = parseInt(input[prop], 10);
                } else if (id === 'model-select') {
                    settings['model_name'] = input[prop];
                } else {
                    settings[id.replace('-', '_')] = input[prop];
                }
            }
        });

        return settings;
    }

    /**
     * Displays the current settings at the bottom of the widget.
     */
    displayCurrentSettings() {
        const currentSettingsElement = this.container.querySelector(`.${this.classPrefix}current-settings`);
        if (currentSettingsElement) {
            currentSettingsElement.textContent = JSON.stringify(this.settings, null, 2);
        }
    }

    /**
     * Fetches settings from the database (backend implementation).
     * @param {string} type - The type of settings to fetch ('local' or 'internet').
     * @returns {Promise<Object>} - The fetched settings.
     */
    async fetchSettingsFromDB(type) {
        try {
            const response = await fetch(`https://localhost:5001/api/ai-settings?type=${type}`, {
                headers: {
                    'Authorization': localStorage.getItem('session_id'),
                },
            });
    
            if (!response.ok) {
                throw new Error('Failed to fetch AI settings');
            }
    
            const data = await response.json();
            console.log('Fetched settings from backend:', data);
    
            // Handle array response (backend returns an array of settings)
            if (Array.isArray(data) && data.length > 0) {
                return data[0]; // Return the first item in the array
            } else {
                return {}; // Return an empty object if no settings are found
            }
        } catch (error) {
            console.error(`Error fetching ${type} settings:`, error);
            throw error;
        }
    }

    async saveSettingsToDB(type, settings) {
        try {
            const response = await fetch('https://localhost:5001/ai-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': localStorage.getItem('session_id'),
                },
                body: JSON.stringify({ type, settings }),
            });
    
            if (!response.ok) {
                throw new Error('Failed to save AI settings');
            }
        } catch (error) {
            console.error(`Error saving ${type} settings:`, error);
            throw error;
        }
    }

    /**
     * Saves settings to the database (mock implementation).
     * @param {string} type - The type of settings to save ('local' or 'internet').
     * @param {Object} settings - The settings to save.
     * @returns {Promise<void>}
     */
    async saveSettingsToDB(type, settings) {
        // Mock API call to save settings
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Settings saved to DB (${type}):`, settings);
                resolve();
            }, 500);
        });
    }
}