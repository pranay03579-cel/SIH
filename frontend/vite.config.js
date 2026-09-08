import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,   // fail clearly if 5173 is in use — never silently shift port
    watch: {
      ignored: ['**/*.log', '**/*.db', '**/chrome-temp*/**', '**/.git/**']
    },
    proxy: {
      '/recommend-route': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite proxy] /recommend-route → FastAPI error:', err.message);
          });
        }
      },
      '/routes': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/reroute': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite proxy] /reroute → FastAPI error:', err.message);
          });
        }
      },
      '/locations': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/location-suggestions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/health/, '/')
      }
    }
  }
});
