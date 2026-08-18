import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
    ],
    server: {
        host: '0.0.0.0',
        port: 4050,
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
