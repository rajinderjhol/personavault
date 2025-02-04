/**
 * ErrorHandler class for managing and displaying errors in the UI.
 * This class provides methods to display, clear, and log errors in a consistent manner.
 */
export default class ErrorHandler {
  /**
   * Constructor for the ErrorHandler class.
   * @param {HTMLElement} container - The container element where errors will be displayed.
   * @param {string} classPrefix - A unique prefix for DOM element classes to avoid conflicts.
   */
  constructor(container, classPrefix = '') {
      this.container = container;
      this.classPrefix = classPrefix;

      // Validate container existence
      if (!this.container) {
          console.error('Error: Container element not found.');
          throw new Error('Container element not found.');
      }

      // Initialize the error message container
      this.initializeErrorMessageContainer();
  }

  // ========================
  // Initialization Methods
  // ========================

  /**
   * Initializes the error message container in the UI.
   */
  initializeErrorMessageContainer() {
      // Check if the error message container already exists
      let errorMessageContainer = this.container.querySelector(`.${this.classPrefix}error-message`);
      if (!errorMessageContainer) {
          // Create the error message container if it doesn't exist
          errorMessageContainer = document.createElement('div');
          errorMessageContainer.className = `${this.classPrefix}error-message`;
          errorMessageContainer.style.display = 'none'; // Hidden by default
          this.container.appendChild(errorMessageContainer);
      }
  }

  // ========================
  // Error Handling Methods
  // ========================

  /**
   * Displays an error message in the UI.
   * @param {string} message - The error message to display.
   * @param {number} timeout - Optional timeout (in milliseconds) to automatically hide the error message.
   */
  displayError(message, timeout = 5000) {
      const errorMessageContainer = this.container.querySelector(`.${this.classPrefix}error-message`);
      if (!errorMessageContainer) {
          console.error('Error message container not found.');
          return;
      }

      // Set the error message text
      errorMessageContainer.textContent = message;
      errorMessageContainer.style.display = 'block';

      // Automatically hide the error message after the specified timeout
      if (timeout > 0) {
          setTimeout(() => {
              this.clearError();
          }, timeout);
      }
  }

  /**
   * Clears the error message from the UI.
   */
  clearError() {
      const errorMessageContainer = this.container.querySelector(`.${this.classPrefix}error-message`);
      if (!errorMessageContainer) {
          console.error('Error message container not found.');
          return;
      }

      // Clear the error message and hide the container
      errorMessageContainer.textContent = '';
      errorMessageContainer.style.display = 'none';
  }

  /**
   * Logs an error to the console.
   * @param {string} message - The error message to log.
   * @param {Error} error - The error object (optional).
   */
  logError(message, error = null) {
      console.error(message);
      if (error) {
          console.error('Error details:', error);
      }
  }

  /**
   * Handles API errors and displays them in the UI.
   * @param {string} endpoint - The API endpoint that failed.
   * @param {Error} error - The error object.
   */
  handleApiError(endpoint, error) {
      const errorMessage = `API Error (${endpoint}): ${error.message || 'An unknown error occurred.'}`;
      this.displayError(errorMessage);
      this.logError(errorMessage, error);
  }
}