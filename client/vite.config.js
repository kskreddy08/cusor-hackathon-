import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const universal = process.env.VITE_UNIVERSAL === 'true';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  define: {
    'import.meta.env.VITE_UNIVERSAL': JSON.stringify(universal ? 'true' : 'false'),
    'import.meta.env.VITE_UNIVERSAL_LINK': JSON.stringify(process.env.VITE_UNIVERSAL_LINK || ''),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3847',
      '/socket.io': { target: 'http://localhost:3847', ws: true },
    },
  },
});
