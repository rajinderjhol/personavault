/**
 * VoiceOutputManager class for handling voice output functionality.
 * This class manages the initialization of speech synthesis, speaking text aloud,
 * and handling speech synthesis events.
 */
export default class VoiceOutputManager {
    /**
     * Constructor for the VoiceOutputManager class.
     * @param {string} language - The language for speech synthesis (e.g., 'en-US').
     */
    constructor(language = 'en-US') {
        this.language = language;
        this.synth = window.speechSynthesis;
        this.utterance = null;

        // Validate browser support for speech synthesis
        if (!this.synth) {
            console.error('Speech synthesis is not supported in this browser.');
        }
    }

    // ========================
    // Speech Synthesis Methods
    // ========================

    /**
     * Speaks the given text aloud using speech synthesis.
     * @param {string} text - The text to speak.
     * @param {Object} options - Optional settings for speech synthesis (e.g., voice, pitch, rate).
     */
    speak(text, options = {}) {
        if (!this.synth) {
            console.error('Speech synthesis is not supported in this browser.');
            return;
        }

        if (!text || typeof text !== 'string') {
            console.error('Invalid text. Text must be a non-empty string.');
            return;
        }

        // Cancel any ongoing speech
        if (this.synth.speaking) {
            this.synth.cancel();
        }

        // Create a new SpeechSynthesisUtterance
        this.utterance = new SpeechSynthesisUtterance(text);

        // Set default options
        this.utterance.lang = this.language;
        this.utterance.pitch = options.pitch || 1; // Default pitch
        this.utterance.rate = options.rate || 1; // Default rate
        this.utterance.volume = options.volume || 1; // Default volume

        // Set the voice if specified
        if (options.voice) {
            this.utterance.voice = options.voice;
        }

        // Event listener for when speech starts
        this.utterance.onstart = () => {
            console.log('Speech synthesis started.');
        };

        // Event listener for when speech ends
        this.utterance.onend = () => {
            console.log('Speech synthesis ended.');
        };

        // Event listener for speech errors
        this.utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
        };

        // Speak the text
        this.synth.speak(this.utterance);
    }

    /**
     * Stops any ongoing speech synthesis.
     */
    stop() {
        if (this.synth && this.synth.speaking) {
            this.synth.cancel();
            console.log('Speech synthesis stopped.');
        }
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Sets the language for speech synthesis.
     * @param {string} language - The language code (e.g., 'en-US', 'es-ES').
     */
    setLanguage(language) {
        this.language = language;
        console.log(`Speech synthesis language set to: ${language}`);
    }

    /**
     * Gets the available voices for speech synthesis.
     * @returns {Array} - An array of available voices.
     */
    getVoices() {
        if (!this.synth) {
            console.error('Speech synthesis is not supported in this browser.');
            return [];
        }

        return this.synth.getVoices();
    }

    /**
     * Finds a voice by name or language.
     * @param {string} name - The name of the voice to find.
     * @param {string} language - The language of the voice to find.
     * @returns {SpeechSynthesisVoice|null} - The found voice, or `null` if not found.
     */
    findVoice(name, language) {
        const voices = this.getVoices();
        return voices.find((voice) => {
            return (
                (!name || voice.name === name) &&
                (!language || voice.lang === language)
            );
        }) || null;
    }

    /**
     * Checks if speech synthesis is supported in the current browser.
     * @returns {boolean} - `true` if supported, otherwise `false`.
     */
    isSupported() {
        return !!this.synth;
    }

    /**
     * Gets the current language for speech synthesis.
     * @returns {string} - The current language code.
     */
    getLanguage() {
        return this.language;
    }
}