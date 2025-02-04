import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs'; // Import fs to read certificate files

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Ensure Vite runs on port 5173
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'certs/frontend-key.pem')), // Path to your private key
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/frontend-cert.pem')), // Path to your certificate
    },
    proxy: {
      '/api': {
        target: 'https://localhost:5001', // Flask backend (now using HTTPS)
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    headers: {
      'Cache-Control': 'no-store, max-age=0', // Disable caching
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Path alias
    },
  },
});