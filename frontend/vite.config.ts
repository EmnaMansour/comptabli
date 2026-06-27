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
        ws: path === '/socket.io',
        configure: (proxy: any) => {
          // Vite attaches its built-in error listener AFTER calling the configure hook.
          // By deferring to the end of the event loop, we can properly remove them.
          setTimeout(() => {
            proxy.removeAllListeners('error');
            proxy.removeAllListeners('proxyReqWs');

            proxy.on('error', (err: any) => {
              if (err.code === 'ECONNABORTED') return;
              console.error(`[vite proxy error] ${err.message}`);
            });

            proxy.on('proxyReqWs', (_proxyReq: any, _req: any, socket: any) => {
              socket.on('error', (err: any) => {
                if (err.code === 'ECONNABORTED') return;
                console.error(`[vite proxy socket error] ${err.message}`);
              });
            });
          }, 0);
        },
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
