import { ChatWidget } from './components/ChatWidget.js';
import { SettingsWidget } from './components/SettingsWidget.js';
import { AgentWidget } from './components/AgentWidget.js';
import { ErrorMessage } from './components/ErrorMessage.js';
import { fetchModels } from './utils/api.js';

document.addEventListener('DOMContentLoaded', () => {
    const apiEndpoint = 'https://localhost:5001';

    // Initialize Components
    const chatWidget = new ChatWidget('chat-widget-container', apiEndpoint);
    const settingsWidget = new SettingsWidget('settings-widget-container');
    const agentWidget = new AgentWidget('agent-widget-container');
    const errorMessage = new ErrorMessage('error-message');

    // Fetch models and populate dropdown
    fetchModels(apiEndpoint)
        .then(data => {
            const modelSelect = document.getElementById('model-select');
            modelSelect.innerHTML = data.models.map(model => `
                <option value="${model}">${model}</option>
            `).join('');
        })
        .catch(error => errorMessage.show(`Error fetching models: ${error.message}`));
});