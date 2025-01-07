document.addEventListener('DOMContentLoaded', () => {
    // Select DOM elements
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Check if elements exist
    if (!chatWindow || !chatInput || !sendBtn) {
        console.error('One or more required elements are missing in the DOM.');
        return; // Exit if any element is missing
    }

    // Add event listeners
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Function to send a message
    async function sendMessage() {
        const message = chatInput.value.trim();

        // Validate input
        if (!message) {
            alert('Please enter a message.');
            return; // Exit if the input is empty
        }

        // Add the user's message to the chat window
        addMessage('user', message);
        chatInput.value = ''; // Clear the input field

        try {
            // Send the message to the server
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, user_id: 'default_user' })
            });

            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            // Stream the response from the server
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let aiMessageDiv = addMessage('ai', ''); // Create an empty AI message div

            // Function to read the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode the chunk and parse it as JSON
                const chunk = decoder.decode(value);
                const jsonObjects = chunk.split('\n').filter(line => line.trim() !== ''); // Split by newline and filter out empty lines

                for (const jsonStr of jsonObjects) {
                    try {
                        const json = JSON.parse(jsonStr); // Parse each JSON object
                        if (json.response) {
                            aiMessageDiv.textContent += json.response; // Append the response to the AI message
                        }
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                }

                // Scroll the chat window to the bottom
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } catch (error) {
            // Handle errors
            console.error('Error:', error);
            addMessage('error', `Failed to send message: ${error.message}`);
        }
    }

    // Function to add a message to the chat window
    function addMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : sender === 'error' ? 'error-message' : 'ai-message';
        messageDiv.textContent = message;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageDiv; // Return the created div for streaming updates
    }
});