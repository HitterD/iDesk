import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Bundle Analyzer (Optional)
 * To analyze the bundle size:
 * 1. Run: npm install rollup-plugin-visualizer -D
 * 2. Set ANALYZE=true when building: ANALYZE=true npm run build
 * 3. Open dist/stats.html in browser
 */
// Conditional import for bundle analyzer
const visualizer = process.env.ANALYZE
    ? require('rollup-plugin-visualizer').visualizer
    : null;

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
        // Bundle analyzer - only active when ANALYZE=true
        ...(process.env.ANALYZE && visualizer
            ? [visualizer({
                filename: 'dist/stats.html',
                open: true,
                gzipSize: true,
                brotliSize: true,
                template: 'treemap', // 'sunburst', 'treemap', 'network'
            })]
            : []),
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
        // Enable CSS code splitting
        cssCodeSplit: true,
        // Minification options
        minify: 'esbuild',
        // Target modern browsers for smaller bundles
        target: 'es2020',
        // Chunk size warning limit (in kB)
        chunkSizeWarningLimit: 500,
        // Generate source maps for production debugging
        sourcemap: process.env.NODE_ENV !== 'production',
    },
})
