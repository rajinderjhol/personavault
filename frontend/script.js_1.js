document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage('user', message);
            chatInput.value = '';
            fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, user_id: 'default_user' })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const reader = response.body.getReader();
                let aiMessageDiv = addMessage('ai', '');  // Create an empty AI message div
    
                function readStream() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            return;
                        }
                        // Append the chunk to the AI message
                        aiMessageDiv.textContent += value;
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                        return readStream();
                    });
                }
    
                return readStream();
            })
            .catch(error => {
                console.error('Error:', error);
                addMessage('error', `Failed to send message: ${error.message}`);
            });
        }
    }

    function addMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : sender === 'error' ? 'error-message' : 'ai-message';
        messageDiv.textContent = message;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});
