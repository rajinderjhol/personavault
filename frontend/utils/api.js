// ==================== //
// api.js - Universal API Service
// ==================== //

/**
 * Universal API Service
 * This service handles API interactions, including fetching models and streaming responses.
 * It includes caching, retry mechanisms, timeout handling, and abort support.
 *
 * Key Features:
 * - Retry mechanism with exponential backoff.
 * - Caching for frequently accessed data.
 * - Streaming responses for real-time interactions.
 * - Comprehensive error handling and logging.
 * - Configurable constants for flexibility.
 *
 * @module api
 */

// ==================== //
// Configurable Constants
// ==================== //

const MAX_RETRIES = 3; // Maximum number of retries for failed requests
const RETRY_DELAY = 1000; // Initial retry delay in milliseconds (exponential backoff)
const REQUEST_TIMEOUT = 10000; // Request timeout in milliseconds
const CACHE_KEY = 'models_cache'; // Key for caching models
const CACHE_TTL = 5 * 60 * 1000; // Cache TTL in milliseconds (5 minutes)
const API_BASE_URL = 'https://localhost:5001'; // Base URL for the backend API

// ==================== //
// Utility Functions
// ==================== //

/**
 * Delays execution for a specified amount of time.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>} - A promise that resolves after the delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches data from the API with retry and timeout support.
 * @param {string} url - The URL to fetch.
 * @param {Object} options - The fetch options.
 * @param {number} retries - The number of retries remaining.
 * @returns {Promise<Response>} - The fetch response.
 * @throws {Error} - If the request fails after all retries.
 */
const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        if (retries > 0) {
            await delay(RETRY_DELAY * (MAX_RETRIES - retries + 1));
            return fetchWithRetry(url, options, retries - 1);
        }

        throw new Error(`Request failed after ${MAX_RETRIES} retries: ${error.message}`);
    }
};

// ==================== //
// API Functions
// ==================== //

/**
 * Fetches the list of available models from the backend or cache.
 * @param {string} apiEndpoint - The base URL of the API endpoint.
 * @returns {Promise<Object>} - A promise that resolves to the list of models.
 * @throws {Error} - If the request fails or the response is not OK.
 */
export async function fetchModels(apiEndpoint = API_BASE_URL) {
    // Check if cached data is available and not expired
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_TTL) {
            console.log('Returning cached models.'); // Debugging
            return data; // Return cached data if it's still valid
        }
    }

    try {
        // Fetch fresh data from the API
        console.log('Fetching models from:', `${apiEndpoint}/models`); // Debugging
        const response = await fetchWithRetry(`${apiEndpoint}/models`);
        const data = await response.json();

        // Cache the new data with a timestamp
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));

        console.log('Models fetched successfully:', data); // Debugging
        return data;
    } catch (error) {
        console.error('Error fetching models:', error);

        // If there's cached data, return it as a fallback
        if (cachedData) {
            const { data } = JSON.parse(cachedData);
            console.warn('Using cached models due to network error.');
            return data;
        }

        throw new Error(`Failed to fetch models: ${error.message}`);
    }
}

/**
 * Sends a message to the backend and streams the response.
 * @param {string} apiEndpoint - The base URL of the API endpoint.
 * @param {string} message - The message to send.
 * @param {Object} settings - The AI settings to use for the message.
 * @param {AbortSignal} [signal] - An optional AbortSignal to cancel the request.
 * @yields {string} - Yields each response chunk as it is received.
 * @throws {Error} - If the request fails or the response is not OK.
 */
export async function* sendMessage(apiEndpoint = API_BASE_URL, message, settings, signal) {
    try {
        const session_id = localStorage.getItem('session_id');
        if (!session_id) {
            throw new Error('User is not logged in. Please log in to continue.');
        }

        console.log('Sending message to backend:', message); // Debugging
        const response = await fetchWithRetry(`${apiEndpoint}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': session_id,
            },
            body: JSON.stringify({ message, settings }),
            signal, // Pass the AbortSignal to the fetch request
        });

        if (response.status === 401) {
            // Session expired, redirect to login page
            localStorage.removeItem('session_id');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
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
                        yield jsonData.response; // Yield each response chunk
                    }
                } catch (error) {
                    console.error('Error parsing JSON chunk:', error);
                    yield 'Error: Failed to parse response.';
                }
            }
        }

        // Process any remaining data in the buffer
        if (buffer.length > 0) {
            try {
                const jsonData = JSON.parse(buffer);
                if (jsonData.response) {
                    yield jsonData.response; // Yield the final response chunk
                }
            } catch (error) {
                console.error('Error parsing final JSON chunk:', error);
                yield buffer; // Fallback: yield raw buffer content
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        throw new Error(`Failed to send message: ${error.message}`);
    }
}