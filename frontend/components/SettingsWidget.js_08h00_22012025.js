import PayloadBuilder from './PayloadBuilder.js';
import UniObjectHolder from './UniObjectHolder.js';

export default class SettingsWidget {
    constructor(container, prefix) {
        this.container = container;
        this.prefix = prefix;
        this.payloadBuilder = new PayloadBuilder();
        this.uniObjectHolder = new UniObjectHolder();
        this.settings = {
            local: {
                model_name: 'phi:latest',
                temperature: 0.7,
                max_tokens: 100,
                top_p: 0.9,
                system_prompt: 'You are a helpful assistant.',
                response_format: 'json',
                language: 'en',
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
                user_context: '',
            },
            internet: {
                model_name: 'phi:latest',
                temperature: 0.7,
                max_tokens: 100,
                top_p: 0.9,
                system_prompt: 'You are a helpful assistant.',
                response_format: 'json',
                language: 'en',
                api_key: '',
                api_endpoint: '',
                presence_penalty: 0.0,
                frequency_penalty: 0.0,
                user_context: '',
            },
        };
        this.isSettingsVisible = true;
    }

    async init() {
        console.log('Initializing SettingsWidget...');
        this.renderUI();
        await this.handleUpdateSettings();
        console.log('[SettingsWidget] Widget initialized.');
    }

    renderUI() {
        console.log('Rendering SettingsWidget UI...');
        this.container.innerHTML = '';

        const settingsWidget = document.createElement('div');
        settingsWidget.className = `${this.prefix}settings-widget`;
        settingsWidget.style.overflowY = 'auto';
        settingsWidget.style.maxHeight = '60vh';
        settingsWidget.style.border = '2px solid red';
        settingsWidget.style.padding = '10px';
        settingsWidget.style.backgroundColor = '#f0f0f0';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = this.isSettingsVisible ? 'Close AI Settings' : 'Open AI Settings';
        toggleButton.className = `${this.prefix}toggle-settings-btn`;
        toggleButton.addEventListener('click', () => this.toggleSettingsVisibility());
        settingsWidget.appendChild(toggleButton);

        const modelDropdownContainer = document.createElement('div');
        modelDropdownContainer.id = 'modelDropdownContainer';
        settingsWidget.appendChild(modelDropdownContainer);

        const historyDropdownContainer = document.createElement('div');
        historyDropdownContainer.id = 'historyDropdownContainer';
        settingsWidget.appendChild(historyDropdownContainer);

        const settingsGroupsContainer = document.createElement('div');
        settingsGroupsContainer.id = 'settingsGroupsContainer';
        settingsWidget.appendChild(settingsGroupsContainer);

        const localSettingsForm = this.createSettingsForm('local');
        settingsGroupsContainer.appendChild(localSettingsForm);

        const saveSettingsButton = document.createElement('button');
        saveSettingsButton.textContent = 'Save AI Settings';
        saveSettingsButton.className = `${this.prefix}save-settings-btn`;
        saveSettingsButton.addEventListener('click', () => this.saveAISettings());
        settingsWidget.appendChild(saveSettingsButton);

        this.container.appendChild(settingsWidget);
        this.populateHistoryDropdown();
        console.log('[SettingsWidget] UI rendered successfully.');
    }

    toggleSettingsVisibility() {
        this.isSettingsVisible = !this.isSettingsVisible;
        const settingsGroupsContainer = this.container.querySelector('#settingsGroupsContainer');
        const toggleButton = this.container.querySelector(`.${this.prefix}toggle-settings-btn`);

        if (settingsGroupsContainer && toggleButton) {
            settingsGroupsContainer.style.display = this.isSettingsVisible ? 'block' : 'none';
            toggleButton.textContent = this.isSettingsVisible ? 'Close AI Settings' : 'Open AI Settings';
        }
    }

    createSettingsForm(type) {
        const form = document.createElement('div');
        form.className = `${this.prefix}${type}-settings-form`;

        const fields = [
            { id: 'temperature', label: 'Temperature', type: 'range', min: 0.0, max: 1.0, step: 0.1, description: ': Adjusts how creative or random the responses are. Higher values mean more variety, lower values are more predictable.' },
            { id: 'max-tokens', label: 'Max Tokens', type: 'number', min: 1, max: 4000, description: ': Sets the limit on how long the response can be.' },
            { id: 'top-p', label: 'Top-P', type: 'range', min: 0.0, max: 1.0, step: 0.1, description: ': Controls how diverse the responses are by limiting or expanding the range of possible word choices.' },
            { id: 'system-prompt', label: 'System Prompt', type: 'textarea', description: ': Allows you to set the tone or instructions for how the model should behave.' },
            { id: 'response-format', label: 'Response Format', type: 'select', options: ['default', 'text', 'json', 'markdown'], description: ': Choose the format of the response (e.g., plain text, JSON, or markdown)' },
            { id: 'language', label: 'Language', type: 'select', options: ['all', 'en', 'es', 'fr', 'de'], description: ': Select the language for the response.' },
            { id: 'presence-penalty', label: 'Presence Penalty', type: 'range', min: 0.0, max: 2.0, step: 0.1, description: ': Discourages the model from repeating words it has already used.' },
            { id: 'frequency-penalty', label: 'Frequency Penalty', type: 'range', min: 0.0, max: 2.0, step: 0.1, description: ': Reduces the likelihood of commonly used words appearing repeatedly in the response.' },
            { id: 'user-context', label: 'User Context', type: 'textarea', description: ': Additional context or instructions for the model.' },
        ];

        fields.forEach((field) => {
            const fieldContainer = document.createElement('div');
            fieldContainer.className = `${this.prefix}${type}-field`;

            const label = document.createElement('label');
            label.textContent = field.label;
            label.htmlFor = `${this.prefix}${type}-${field.id}`;
            fieldContainer.appendChild(label);

            const description = document.createElement('span');
            description.className = `${this.prefix}field-description`;
            description.textContent = field.description;
            fieldContainer.appendChild(description);

            let input;
            switch (field.type) {
                case 'range':
                    input = document.createElement('input');
                    input.type = 'range';
                    input.min = field.min;
                    input.max = field.max;
                    input.step = field.step || 0.1;
                    input.value = field.default || (field.min + field.max) / 2;
                    break;

                case 'number':
                    input = document.createElement('input');
                    input.type = 'number';
                    input.min = field.min;
                    input.max = field.max;
                    input.value = field.default || field.min;
                    break;

                case 'textarea':
                    input = document.createElement('textarea');
                    input.value = field.default || '';
                    break;

                case 'select':
                    input = document.createElement('select');
                    field.options.forEach((option) => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        input.appendChild(optionElement);
                    });
                    break;

                default:
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = field.default || '';
                    break;
            }

            input.id = `${this.prefix}${type}-${field.id}`;
            fieldContainer.appendChild(input);

            if (field.type === 'range') {
                const valueDisplay = document.createElement('span');
                valueDisplay.className = `${this.prefix}slider-value`;
                valueDisplay.textContent = input.value;
                fieldContainer.appendChild(valueDisplay);

                input.addEventListener('input', () => {
                    valueDisplay.textContent = input.value;
                });
            }

            form.appendChild(fieldContainer);
        });

        return form;
    }

    async handleUpdateSettings() {
        try {
            this.showLoadingIndicator();
            await this.populateModelDropdown();
            const settings = await this.fetchAISettings();
            this.applyAISettings(settings);
            await this.populateHistoryDropdown();
            console.log('[SettingsWidget] Settings updated successfully.');
            this.displaySuccess('Settings updated successfully.');
        } catch (error) {
            console.error('[SettingsWidget] Error updating settings:', error);
            this.displayError('Failed to update settings. Please try again.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    async fetchAISettings() {
        try {
            const response = await fetch('https://localhost:5001/ai-settings?type=local', {
                credentials: 'include',
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch AI settings: ${response.statusText}`);
            }

            const settings = await response.json();
            console.log('[SettingsWidget] Fetched AI settings:', settings);
            return settings;
        } catch (error) {
            console.error('[SettingsWidget] Error fetching AI settings:', error);
            throw error;
        }
    }

    async populateModelDropdown() {
        const modelDropdownContainer = this.container.querySelector('#modelDropdownContainer');
        if (!modelDropdownContainer) {
            console.error('[SettingsWidget] Model dropdown container not found.');
            return;
        }

        modelDropdownContainer.innerHTML = '';

        const modelLabel = document.createElement('label');
        modelLabel.textContent = 'Locally Installed: Available AI Models';
        modelLabel.style.display = 'block';
        modelLabel.style.marginBottom = '10px';
        modelLabel.style.fontWeight = 'bold';
        modelDropdownContainer.appendChild(modelLabel);

        try {
            const response = await fetch('http://localhost:11434/api/tags', {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch available models from Ollama API.');
            }

            const data = await response.json();
            console.log('[SettingsWidget] Ollama API response:', data);

            const availableModels = data.models.map((model) => model.name);
            console.log('[SettingsWidget] Available models:', availableModels);

            const settingsResponse = await fetch('https://localhost:5001/ai-settings?type=local', {
                credentials: 'include',
                method: 'GET',
            });

            if (!settingsResponse.ok) {
                throw new Error('Failed to fetch AI settings.');
            }

            const settings = await settingsResponse.json();
            const selectedModel = settings.model_name || 'phi:latest';

            const modelDropdown = document.createElement('select');
            modelDropdown.id = 'modelDropdown';
            modelDropdown.className = `${this.prefix}model-dropdown`;

            availableModels.forEach((model) => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                if (model === selectedModel) {
                    option.selected = true;
                }
                modelDropdown.appendChild(option);
            });

            modelDropdownContainer.appendChild(modelDropdown);
            console.log('[SettingsWidget] Model dropdown populated successfully.');
        } catch (error) {
            console.error('[SettingsWidget] Error populating model dropdown:', error);
            this.displayError('Failed to load models. Please try again.');
        }
    }

    async populateHistoryDropdown() {
        const historyDropdownContainer = this.container.querySelector('#historyDropdownContainer');
        if (!historyDropdownContainer) {
            console.error('[SettingsWidget] History dropdown container not found.');
            return;
        }

        historyDropdownContainer.innerHTML = '';

        const historyLabel = document.createElement('label');
        historyLabel.textContent = 'Used models: History';
        historyLabel.style.display = 'block';
        historyLabel.style.marginBottom = '10px';
        historyLabel.style.fontWeight = 'bold';
        historyDropdownContainer.appendChild(historyLabel);

        try {
            const response = await fetch('https://localhost:5001/past-ai-settings', {
                credentials: 'include',
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch past AI settings.');
            }

            const pastSettings = await response.json();
            console.log('[SettingsWidget] Fetched past AI settings:', pastSettings);

            const historyDropdown = document.createElement('select');
            historyDropdown.id = 'historyDropdown';
            historyDropdown.className = `${this.prefix}history-dropdown`;

            pastSettings.forEach((setting) => {
                const option = document.createElement('option');
                option.value = setting.model_name;
                option.textContent = `${setting.model_name} (${new Date(setting.created_at).toLocaleString()})`;
                historyDropdown.appendChild(option);
            });

            historyDropdown.addEventListener('change', (event) => {
                const selectedModel = event.target.value;
                const modelSettings = pastSettings.find((setting) => setting.model_name === selectedModel);
                if (modelSettings) {
                    this.applySettings('local', modelSettings);
                }
            });

            historyDropdownContainer.appendChild(historyDropdown);
            console.log('[SettingsWidget] History dropdown populated successfully.');
        } catch (error) {
            console.error('[SettingsWidget] Error populating history dropdown:', error);
            this.displayError('Failed to load past models. Please try again.');
        }
    }

    async saveAISettings() {
        try {
            this.showLoadingIndicator();
            const settings = this.getCurrentSettings();

            const payload = {
                type: 'local',
                settings: {
                    model_name: this.container.querySelector('#modelDropdown').value,
                    temperature: settings.temperature,
                    max_tokens: settings.max_tokens,
                    top_p: settings.top_p,
                    system_prompt: settings.system_prompt,
                    response_format: settings.response_format,
                    language: settings.language,
                    presence_penalty: settings.presence_penalty,
                    frequency_penalty: settings.frequency_penalty,
                    user_context: settings.user_context,
                },
            };

            const response = await fetch('https://localhost:5001/ai-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to save AI settings.');
            }

            console.log('[SettingsWidget] AI settings saved successfully.');
            this.displaySuccess('AI settings saved successfully.');
            await this.populateHistoryDropdown();
        } catch (error) {
            console.error('[SettingsWidget] Error saving AI settings:', error);
            this.displayError('Failed to save AI settings. Please try again.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    getCurrentSettings() {
        const settings = {
            temperature: parseFloat(this.container.querySelector(`#${this.prefix}local-temperature`).value),
            max_tokens: parseInt(this.container.querySelector(`#${this.prefix}local-max-tokens`).value),
            top_p: parseFloat(this.container.querySelector(`#${this.prefix}local-top-p`).value),
            system_prompt: this.container.querySelector(`#${this.prefix}local-system-prompt`).value,
            response_format: this.container.querySelector(`#${this.prefix}local-response-format`).value,
            language: this.container.querySelector(`#${this.prefix}local-language`).value,
            presence_penalty: parseFloat(this.container.querySelector(`#${this.prefix}local-presence-penalty`).value),
            frequency_penalty: parseFloat(this.container.querySelector(`#${this.prefix}local-frequency-penalty`).value),
            user_context: this.container.querySelector(`#${this.prefix}local-user-context`).value,
        };

        return settings;
    }

    applySettings(type, settings) {
        const inputs = {
            'temperature': settings.temperature || this.settings[type]?.temperature,
            'max-tokens': settings.max_tokens || this.settings[type]?.max_tokens,
            'top-p': settings.top_p || this.settings[type]?.top_p,
            'system-prompt': settings.system_prompt || this.settings[type]?.system_prompt,
            'response-format': settings.response_format || this.settings[type]?.response_format,
            'language': settings.language || this.settings[type]?.language,
            'presence-penalty': settings.presence_penalty || this.settings[type]?.presence_penalty,
            'frequency-penalty': settings.frequency_penalty || this.settings[type]?.frequency_penalty,
            'user-context': settings.user_context || this.settings[type]?.user_context,
        };

        Object.entries(inputs).forEach(([id, value]) => {
            const input = this.container.querySelector(`#${this.prefix}${type}-${id}`);
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
            }
        });
    }

    applyAISettings(settings) {
        try {
            if (!settings) {
                console.warn('No AI settings provided. Skipping application.');
                return;
            }

            const temperatureInput = this.container.querySelector(`#${this.prefix}local-temperature`);
            const maxTokensInput = this.container.querySelector(`#${this.prefix}local-max-tokens`);
            const topPInput = this.container.querySelector(`#${this.prefix}local-top-p`);
            const systemPromptInput = this.container.querySelector(`#${this.prefix}local-system-prompt`);
            const responseFormatInput = this.container.querySelector(`#${this.prefix}local-response-format`);
            const languageInput = this.container.querySelector(`#${this.prefix}local-language`);
            const presencePenaltyInput = this.container.querySelector(`#${this.prefix}local-presence-penalty`);
            const frequencyPenaltyInput = this.container.querySelector(`#${this.prefix}local-frequency-penalty`);
            const userContextInput = this.container.querySelector(`#${this.prefix}local-user-context`);

            if (temperatureInput) temperatureInput.value = settings.temperature || 0.7;
            if (maxTokensInput) maxTokensInput.value = settings.max_tokens || 100;
            if (topPInput) topPInput.value = settings.top_p || 0.9;
            if (systemPromptInput) systemPromptInput.value = settings.system_prompt || 'You are a helpful assistant.';
            if (responseFormatInput) responseFormatInput.value = settings.response_format || 'text';
            if (languageInput) languageInput.value = settings.language || 'en';
            if (presencePenaltyInput) presencePenaltyInput.value = settings.presence_penalty || 0.0;
            if (frequencyPenaltyInput) frequencyPenaltyInput.value = settings.frequency_penalty || 0.0;
            if (userContextInput) userContextInput.value = settings.user_context || '';

            console.log('[SettingsWidget] AI settings applied successfully.');
        } catch (error) {
            console.error('[SettingsWidget] Error applying AI settings:', error);
            this.displayError('Failed to apply AI settings. Please try again.');
        }
    }

    displayError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = `${this.prefix}error-message`;
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.color = 'red';

        this.container.appendChild(errorElement);

        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    displaySuccess(message) {
        const successElement = document.createElement('div');
        successElement.className = `${this.prefix}success-message`;
        successElement.textContent = message;
        successElement.style.display = 'block';
        successElement.style.color = 'green';

        this.container.appendChild(successElement);

        setTimeout(() => {
            successElement.remove();
        }, 3000);
    }

    showLoadingIndicator() {
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = `${this.prefix}loading-indicator`;
        loadingIndicator.textContent = 'Loading...';
        loadingIndicator.style.display = 'block';
        this.container.appendChild(loadingIndicator);
    }

    hideLoadingIndicator() {
        const loadingIndicator = this.container.querySelector(`.${this.prefix}loading-indicator`);
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
}