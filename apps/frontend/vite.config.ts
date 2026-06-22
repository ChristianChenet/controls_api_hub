import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3335',
      '/v1': 'http://localhost:3335',
      '/documentacao': 'http://localhost:3335'
    }
  }
});
