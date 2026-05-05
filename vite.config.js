import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LOCAL_HOST = '127.0.0.1';

export default defineConfig({
  plugins: [react()],
  server: {
    host: LOCAL_HOST,
    proxy: {
      '/api': {
        target: `http://${LOCAL_HOST}:8787`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: LOCAL_HOST,
  },
});
