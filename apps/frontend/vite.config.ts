import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * PWA Configuration (Optional)
 * To enable PWA support:
 * 1. Run: npm install vite-plugin-pwa -D
 * 2. Uncomment the VitePWA import and plugin below
 * 3. Add icon files to public folder (icon-192.png, icon-512.png)
 */
// import { VitePWA } from 'vite-plugin-pwa'
// import { pwaConfig } from './src/pwa.config'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        // Uncomment to enable PWA:
        // VitePWA(pwaConfig),
    ],
    server: {
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
                    'vendor-charts': ['recharts'],
                    'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
                },
            },
        },
    },
})
