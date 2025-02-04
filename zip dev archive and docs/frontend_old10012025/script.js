"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'http://localhost:5001'; // Backend server URL

    // DOM Elements
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const temperatureInput = document.getElementById('temperature');
    const maxTokensInput = document.getElementById('max-tokens');
    const topPInput = document.getElementById('top-p');
    const tagsInput = document.getElementById('tags');
    const privacySelect = document.getElementById('privacy');
    const systemPromptInput = document.getElementById('system-prompt');
    const responseFormatSelect = document.getElementById('response-format');
    const languageSelect = document.getElementById('language');
    const expiryDaysInput = document.getElementById('expiry-days');
    const errorMessage = document.getElementById('error-message');

    // Fetch available models from the backend
    fetch(`${backendUrl}/models`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('API Response from /models:', data);

        // Ensure the response has a 'models' property
        if (!data.models || !Array.isArray(data.models)) {
            throw new Error('Invalid models data format: Expected an array');
        }

        // Clear existing options
        modelSelect.innerHTML = '';

        // Populate the model dropdown
        data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        // Set default value if 'tinyllama:1.1b' exists
        if (data.models.includes('tinyllama:1.1b')) {
            modelSelect.value = 'tinyllama:1.1b';
        }
    })
    .catch(error => {
        console.error('Error fetching models:', error);
        showError(`Error fetching models: ${error.message}`);
    });

    // Event listeners for sending messages
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });



    /**
     * Sends a message to the backend and processes the AI's response.
     */

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) {
        alert('Please enter a message.');
        return;
    }

    // Append user message
    const userMessage = document.createElement('div');
    userMessage.className = 'message user-message';
    userMessage.textContent = `You: ${message}`;
    chatWindow.appendChild(userMessage);

    // Clear input field
    chatInput.value = '';

    // Append AI placeholder message
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai-message';
    aiMessage.textContent = `Bot: Thinking...`;
    chatWindow.appendChild(aiMessage);

    // Scroll to the bottom of the chat window
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const payload = {
            message,
            model: modelSelect.value,
            temperature: parseFloat(temperatureInput.value),
            max_tokens: parseInt(maxTokensInput.value),
            top_p: parseFloat(topPInput.value),
            tags: tagsInput.value,
            privacy_level: privacySelect.value,
            system_prompt: systemPromptInput.value,
            response_format: responseFormatSelect.value,
            language: languageSelect.value,
            expiry_days: parseInt(expiryDaysInput.value)
        };

        const response = await fetch(`${backendUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete JSON objects in the buffer
            let boundary;
            while ((boundary = buffer.indexOf('\n')) !== -1) {
                const chunk = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 1);

                try {
                    const jsonData = JSON.parse(chunk);
                    if (jsonData.response) {
                        aiMessage.textContent += jsonData.response; // Append the response
                    }
                } catch (error) {
                    console.error('Error parsing JSON chunk:', error);
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.length > 0) {
            console.log('Remaining buffer content:', buffer); // Debugging: Log the buffer content

            try {
                const jsonData = JSON.parse(buffer);
                if (jsonData.response) {
                    aiMessage.textContent += jsonData.response; // Append the response
                }
            } catch (error) {
                console.error('Error parsing final JSON chunk:', error);

                // If parsing fails, append the raw buffer content as a fallback
                aiMessage.textContent += buffer; // Display raw buffer content
            }
        }
    } catch (error) {
        console.error('Error:', error);
        aiMessage.textContent = 'Bot: Sorry, something went wrong.';
    }
}



    /**
     * Displays an error message in the chat window.
     * @param {string} message - The error message to display.
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000); // Hide error message after 5 seconds
    }
});