import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import http from 'http'

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 30000,
})

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
    ],
    server: {
        host: '0.0.0.0',
        port: 4050,
        allowedHosts: true,
        proxy: {
            '/v1': {
                target: 'http://127.0.0.1:5050',
                changeOrigin: true,
                xfwd: true,
                agent: httpAgent,
                timeout: 30000,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        if (['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err.code)) {
                            if (res && !res.headersSent && typeof res.writeHead === 'function') {
                                res.writeHead(503, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Backend server is temporarily unreachable. Retrying...' }));
                            }
                            return;
                        }
                    });
                },
            },
            '/socket.io': {
                target: 'http://127.0.0.1:5050',
                ws: true,
                changeOrigin: true,
                xfwd: true,
                timeout: 60000,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        if (['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err.code)) {
                            if (res && !res.headersSent && typeof res.writeHead === 'function') {
                                res.writeHead(503, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Socket.IO backend server is unreachable' }));
                            }
                            return;
                        }
                    });
                },
            },
            '/ws': {
                target: 'http://127.0.0.1:5050',
                ws: true,
                changeOrigin: true,
                xfwd: true,
                timeout: 60000,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        if (['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err.code)) {
                            if (res && !res.headersSent && typeof res.writeHead === 'function') {
                                res.writeHead(503, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'WebSocket backend server is unreachable' }));
                            }
                            return;
                        }
                    });
                },
            },
            '/uploads': {
                target: 'http://127.0.0.1:5050',
                changeOrigin: true,
                xfwd: true,
                agent: httpAgent,
                configure: (proxy) => {
                    proxy.on('error', (err, _req, res) => {
                        if (['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'].includes(err.code)) {
                            if (res && !res.headersSent && typeof res.writeHead === 'function') {
                                res.writeHead(503, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Uploads server unreachable' }));
                            }
                            return;
                        }
                    });
                },
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-ui': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-select',
                        '@radix-ui/react-popover',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-tabs',
                    ],
                    'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
                    'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
                    // Heavy, route-specific libs — split so they don't sit in the
                    // main bundle for users who never open charts/calendar/export.
                    'vendor-motion': ['framer-motion'],
                    'vendor-charts': ['recharts'],
                    'vendor-xlsx': ['xlsx'],
                    'vendor-calendar': [
                        '@fullcalendar/react',
                        '@fullcalendar/core',
                        '@fullcalendar/daygrid',
                        '@fullcalendar/timegrid',
                        '@fullcalendar/interaction',
                    ],
                },
            },
        },
        cssCodeSplit: true,
        minify: 'esbuild',
        target: 'es2020',
        chunkSizeWarningLimit: 500,
        sourcemap: process.env.NODE_ENV !== 'production',
    },
})
