import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: [
      '/auth', '/users', '/documents', '/tasks', '/folders', '/api',
      '/banks', '/requests', '/meetings', '/messaging', '/invoices',
      '/stats', '/notifications', '/admin', '/reviews', '/socket.io', '/uploads',
      '/leaves', '/accountant-profile'
    ].reduce((acc, path) => {
      acc[path] = {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
        bypass: (req: any) => {
          if (req.url.startsWith('/uploads') || req.url.includes('/api/')) return null;
          if (req.headers.accept && req.headers.accept.indexOf('text/html') !== -1) {
            return '/index.html';
          }
        }
      };
      return acc;
    }, {} as any),
  },
})
