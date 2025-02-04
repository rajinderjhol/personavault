const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

// Proxy endpoint
app.get('/proxy/health', async (req, res) => {
    try {
        console.log('Request headers:', req.headers); // Log request headers
        const response = await fetch('https://api.deepseek.com/health', {
            headers: {
                'Authorization': req.headers.authorization, // Forward the Authorization header
            },
        });
        console.log('Response status:', response.status); // Log response status
        const data = await response.json();
        console.log('Response data:', data); // Log response data
        res.json(data);
    } catch (error) {
        console.error('Error:', error); // Log errors
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});