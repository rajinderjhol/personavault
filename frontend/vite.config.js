import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    react(),
    mkcert() // Automatically generates trusted certificates
  ],
  server: {
    host: 'localhost',
    port: 5173,
    https: true, // mkcert handles certificate generation
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: true, // Enable WebSocket proxy
        cookieDomainRewrite: {
          "*": ""  // This makes sure cookies are not tied to a specific domain (useful for localhost dev)
        }
      }
    },
    headers: {
      'Access-Control-Allow-Origin': 'https://localhost:5001',
      'Content-Security-Policy': "default-src 'self' https: 'unsafe-inline'",
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './') // Root directory alias
    }
  },
  build: {
    sourcemap: true, // Enable source maps for debugging
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
});