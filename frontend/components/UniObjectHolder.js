/**
 * UniObjectHolder class for managing shared objects and data across the application.
 * This class acts as a central repository for storing and retrieving shared data.
 */
export default class UniObjectHolder {
    /**
     * Constructor for the UniObjectHolder class.
     */
    constructor() {
        this.objects = new Map(); // Use a Map to store shared objects
    }

    // ========================
    // Object Management Methods
    // ========================

    /**
     * Adds or updates an object in the repository. (store AI settings fetched from the backend)
     * @param {string} key - The key to identify the object.
     * @param {any} value - The object to store.
     */
    setObject(key, value) {
        if (!key || typeof key !== 'string') {
            console.error('Invalid key. Key must be a non-empty string.');
            return;
        }

        this.objects.set(key, value);
        console.log(`Object "${key}" added/updated.`);
    }

    /**
     * Retrieves an object from the repository. (getObject(key))
     * @param {string} key - The key of the object to retrieve.
     * @returns {any|null} - The retrieved object, or `null` if not found.
     */
    getObject(key) {
        if (!key || typeof key !== 'string') {
            console.error('Invalid key. Key must be a non-empty string.');
            return null;
        }

        if (this.objects.has(key)) {
            return this.objects.get(key);
        } else {
            console.warn(`Object "${key}" not found.`);
            return null;
        }
    }

    /**
     * Removes an object from the repository.
     * @param {string} key - The key of the object to remove.
     */
    removeObject(key) {
        if (!key || typeof key !== 'string') {
            console.error('Invalid key. Key must be a non-empty string.');
            return;
        }

        if (this.objects.has(key)) {
            this.objects.delete(key);
            console.log(`Object "${key}" removed.`);
        } else {
            console.warn(`Object "${key}" not found.`);
        }
    }

    /**
     * Checks if an object exists in the repository. (Purpose: Handle cases where the key is invalid or the data is missing.)
     * @param {string} key - The key of the object to check.
     * @returns {boolean} - `true` if the object exists, otherwise `false`.
     */
    hasObject(key) {
        if (!key || typeof key !== 'string') {
            console.error('Invalid key. Key must be a non-empty string.');
            return false;
        }

        return this.objects.has(key);
    }

    /**
     * Clears all objects from the repository. (Purpose: Log important events for debugging.)
     */
    clearAllObjects() {
        this.objects.clear();
        console.log('All objects cleared from the repository.');
    }

    // ========================
    // Utility Methods
    // ========================

    /**
     * Gets the total number of objects in the repository.
     * @returns {number} - The number of objects.
     */
    getObjectCount() {
        return this.objects.size;
    }

    /**
     * Gets all keys in the repository.
     * @returns {Array} - An array of keys.
     */
    getAllKeys() {
        return Array.from(this.objects.keys());
    }

    /**
     * Gets all objects in the repository.
     * @returns {Array} - An array of objects.
     */
    getAllObjects() {
        return Array.from(this.objects.values());
    }

    // ========================
    // AI Settings Management
    // ========================

    /**
     * Loads AI settings from the backend and updates the UniObjectHolder.
     * This method fetches both local and internet settings and stores them in the repository.
     */
    async loadSettings() {
        try {
            const localSettings = await this.fetchSettingsFromDB('local');
            const internetSettings = await this.fetchSettingsFromDB('internet');

            // Update UniObjectHolder with the latest settings
            this.setObject('aiSettings', { local: localSettings, internet: internetSettings });

            console.log('AI settings loaded and updated in UniObjectHolder.');
        } catch (error) {
            console.error('Error loading AI settings:', error);
        }
    }

    /**
     * Fetches AI settings from the backend based on the deployment type.
     * @param {string} deploymentType - The deployment type ('local' or 'internet').
     * @returns {Object} - The fetched settings.
     */
    async fetchSettingsFromDB(deploymentType) {
        try {
            const response = await fetch(`https://localhost:5001/ai-settings?deployment=${deploymentType}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${deploymentType} settings: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${deploymentType} settings:`, error);
            throw error;
        }
    }

    /**
     * Applies AI settings to the UI or other components.
     * @param {string} type - The type of settings ('local' or 'internet').
     * @param {Object} settings - The settings to apply.
     */
    applySettings(type, settings) {
        if (!settings) return;

        const elements = {
            temperature: `${this.prefix}${type}-temperature`,
            'max-tokens': `${this.prefix}${type}-max-tokens`,
            'top-p': `${this.prefix}${type}-top-p`,
            'system-prompt': `${this.prefix}${type}-system-prompt`,
            'response-format': `${this.prefix}${type}-response-format`,
            language: `${this.prefix}${type}-language`,
            'presence-penalty': `${this.prefix}${type}-presence-penalty`,
            'frequency-penalty': `${this.prefix}${type}-frequency-penalty`,
            'user-context': `${this.prefix}${type}-user-context`,
        };

        Object.entries(elements).forEach(([key, selector]) => {
            const element = document.querySelector(`#${selector}`);
            if (element) {
                const defaultValue = this.settings[type][key] || 0; // Numeric fallback
                element.value = settings[key] ?? defaultValue;
            }
        });
    }

    /**
     * Displays the current AI settings in the console for debugging.
     */
    displayCurrentSettings() {
        const aiSettings = this.getObject('aiSettings');
        if (aiSettings) {
            console.log('Current AI Settings:', aiSettings);
        } else {
            console.warn('No AI settings found in UniObjectHolder.');
        }
    }
}