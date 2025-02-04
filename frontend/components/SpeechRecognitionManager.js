/**
 * SpeechRecognitionManager class for handling speech recognition functionality.
 * This class manages the initialization of speech recognition, capturing user speech,
 * and handling recognition results and errors.
 */
export default class SpeechRecognitionManager {
    /**
     * Constructor for the SpeechRecognitionManager class.
     * @param {string} language - The language for speech recognition (e.g., 'en-US').
     * @param {Function} onResultCallback - Callback function to handle recognition results.
     * @param {Function} onErrorCallback - Callback function to handle recognition errors.
     */
    constructor(language, onResultCallback, onErrorCallback) {
        this.language = language || 'en-US';
        this.onResultCallback = onResultCallback;
        this.onErrorCallback = onErrorCallback;
        this.recognition = null;

        // Initialize speech recognition
        this.initializeSpeechRecognition();
    }

    // ========================
    // Initialization Methods
    // ========================

    /**
     * Initializes the speech recognition object.
     */
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech recognition is not supported in this browser.');
            this.onErrorCallback('Speech recognition is not supported in this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.language;
        this.recognition.continuous = false; // Stop after one utterance
        this.recognition.interimResults = false; // Only final results

        // Event listener for recognition results
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.onResultCallback(transcript);
        };

        // Event listener for recognition errors
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.onErrorCallback(event.error);
        };

        // Event listener for when recognition ends
        this.recognition.onend = () => {
            console.log('Speech recognition ended.');
        };
    }

    // ========================
    // Speech Recognition Methods
    // ========================

    /**
     * Starts speech recognition.
     */
    start() {
        if (this.recognition) {
            console.log('Starting speech recognition...');
            this.recognition.start();
        } else {
            console.error('Speech recognition is not initialized.');
            this.onErrorCallback('Speech recognition is not initialized.');
        }
    }

    /**
     * Stops speech recognition.
     */
    stop() {
        if (this.recognition) {
            console.log('Stopping speech recognition...');
            this.recognition.stop();
        } else {
            console.error('Speech recognition is not initialized.');
            this.onErrorCallback('Speech recognition is not initialized.');
        }
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Sets the language for speech recognition.
     * @param {string} language - The language code (e.g., 'en-US', 'es-ES').
     */
    setLanguage(language) {
        if (this.recognition) {
            this.recognition.lang = language;
            this.language = language;
            console.log(`Speech recognition language set to: ${language}`);
        } else {
            console.error('Speech recognition is not initialized.');
            this.onErrorCallback('Speech recognition is not initialized.');
        }
    }

    /**
     * Checks if speech recognition is supported in the current browser.
     * @returns {boolean} - `true` if supported, otherwise `false`.
     */
    isSupported() {
        return !!window.SpeechRecognition || !!window.webkitSpeechRecognition;
    }

    /**
     * Gets the current language for speech recognition.
     * @returns {string} - The current language code.
     */
    getLanguage() {
        return this.language;
    }
}