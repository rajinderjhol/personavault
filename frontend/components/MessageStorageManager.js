/**
 * MessageStorageManager class for managing the storage and retrieval of chat messages.
 * This class handles saving messages to local storage and/or the backend, as well as
 * retrieving messages for display in the chat window.
 */
export default class MessageStorageManager {
    /**
     * Constructor for the MessageStorageManager class.
     * @param {string} apiEndpoint - The base URL of the API endpoint.
     */
    constructor(apiEndpoint) {
      this.apiEndpoint = apiEndpoint;
      this.localStorageKey = 'chat-messages'; // Key for storing messages in local storage
    }
  
    // ========================
    // Local Storage Methods
    // ========================
  
    /**
     * Saves a message to local storage.
     * @param {string} sender - The sender of the message ('user' or 'bot').
     * @param {string} content - The content of the message.
     */
    saveMessageToLocalStorage(sender, content) {
      const message = { sender, content, timestamp: new Date().toISOString() };
      const messages = this.getMessagesFromLocalStorage();
      messages.push(message);
      localStorage.setItem(this.localStorageKey, JSON.stringify(messages));
      console.log('Message saved to local storage:', message);
  }
  
  async saveMessageToBackend(sender, content) {
      try {
          const sessionId = // Cookies are handled by the backend;
          if (!sessionId) {
              throw new Error('You are not logged in. Please log in.');
          }
  
          const response = await fetch(`https://localhost:5001/api/store-message`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': sessionId,
              },
              body: JSON.stringify({ sender, content }),
          });
  
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to save message.');
          }
  
          console.log('Message saved to backend successfully.');
      } catch (error) {
          console.error('Error saving message to backend:', error);
          throw new Error(`Failed to save message to backend: ${error.message}`);
      }
  }
  
    /**
     * Retrieves messages from local storage.
     * @returns {Array} - An array of message objects.
     */
    getMessagesFromLocalStorage() {
      const messages = localStorage.getItem(this.localStorageKey);
      return messages ? JSON.parse(messages) : [];
  }
  
  async getMessagesFromBackend() {
      try {
          const sessionId = // Cookies are handled by the backend;
          if (!sessionId) {
              throw new Error('You are not logged in. Please log in.');
          }
  
          const response = await fetch(`${this.apiEndpoint}/get-messages`, {
              method: 'GET',
              headers: {
                  'Authorization': sessionId,
              },
          });
  
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to retrieve messages.');
          }
  
          const data = await response.json();
          return data.messages || [];
      } catch (error) {
          console.error('Error retrieving messages from backend:', error);
          throw new Error(`Failed to retrieve messages from backend: ${error.message}`);
      }
  }
  
    /**
     * Clears all messages from local storage.
     */
    clearLocalStorage() {
      localStorage.removeItem(this.localStorageKey);
    }
  
    // ========================
    // Backend Storage Methods
    // ========================
  
    /**
     * Saves a message to the backend.
     * @param {string} sender - The sender of the message ('user' or 'bot').
     * @param {string} content - The content of the message.
     * @returns {Promise<void>} - A promise that resolves when the message is saved.
     * @throws {Error} - If the message cannot be saved.
     */
    async saveMessageToBackend(sender, content) {
      try {
        const sessionId = // Cookies are handled by the backend;
        if (!sessionId) {
          throw new Error('You are not logged in. Please log in.');
        }
  
        const response = await fetch(`${this.apiEndpoint}/save-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': sessionId,
          },
          body: JSON.stringify({ sender, content }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save message.');
        }
  
        console.log('Message saved to backend successfully.');
      } catch (error) {
        console.error('Error saving message to backend:', error);
        throw new Error(`Failed to save message to backend: ${error.message}`);
      }
    }
  
    /**
     * Retrieves messages from the backend.
     * @returns {Promise<Array>} - A promise that resolves to an array of message objects.
     * @throws {Error} - If the messages cannot be retrieved.
     */
    async getMessagesFromBackend() {
      try {
        const sessionId = // Cookies are handled by the backend;
        if (!sessionId) {
          throw new Error('You are not logged in. Please log in.');
        }
  
        const response = await fetch(`${this.apiEndpoint}/get-messages`, {
          method: 'GET',
          headers: {
            'Authorization': sessionId,
          },
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to retrieve messages.');
        }
  
        const data = await response.json();
        return data.messages || [];
      } catch (error) {
        console.error('Error retrieving messages from backend:', error);
        throw new Error(`Failed to retrieve messages from backend: ${error.message}`);
      }
    }
  
    // ========================
    // Combined Storage Methods
    // ========================
  
    /**
     * Saves a message to both local storage and the backend.
     * @param {string} sender - The sender of the message ('user' or 'bot').
     * @param {string} content - The content of the message.
     * @returns {Promise<void>} - A promise that resolves when the message is saved.
     */
    async storeMessage(sender, content) {
      try {
          // Save to local storage
          this.saveMessageToLocalStorage(sender, content);
  
          // Save to backend
          await this.saveMessageToBackend(sender, content);
      } catch (error) {
          console.error('Error storing message:', error);
          throw new Error(`Failed to store message: ${error.message}`);
      }
  }
  
    /**
     * Retrieves messages from both local storage and the backend.
     * @returns {Promise<Array>} - A promise that resolves to an array of message objects.
     */
    async getMessages() {
      try {
        const localMessages = this.getMessagesFromLocalStorage();
        const backendMessages = await this.getMessagesFromBackend();
  
        // Combine and sort messages by timestamp
        const allMessages = [...localMessages, ...backendMessages];
        allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
        return allMessages;
      } catch (error) {
        console.error('Error retrieving messages:', error);
        throw new Error(`Failed to retrieve messages: ${error.message}`);
      }
    }
  }