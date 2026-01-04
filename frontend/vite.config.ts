import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5200,
    host: '0.0.0.0', // Listen on all network interfaces
    proxy: {
      '/api': {
        target: 'http://192.168.5.221:3000',
        changeOrigin: true,
      },
    },
  },
});
