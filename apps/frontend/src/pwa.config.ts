/**
 * PWA Configuration for iDesk
 * 
 * To enable PWA support:
 * 1. Install: npm install vite-plugin-pwa -D
 * 2. Uncomment PWA plugin in vite.config.ts
 * 3. Add icons to public folder (icon-192.png, icon-512.png)
 */

import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaConfig: Partial<VitePWAOptions> = {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
    manifest: {
        name: 'iDesk Helpdesk',
        short_name: 'iDesk',
        description: 'Modern IT Helpdesk & Ticketing System',
        theme_color: '#A8E6CF',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    },
    workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
            {
                urlPattern: /^https:\/\/api\..*/i,
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'api-cache',
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 60 * 60 * 24, // 24 hours
                    },
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                },
            },
            {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'images-cache',
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    },
                },
            },
            {
                urlPattern: /\.(?:woff|woff2|ttf|otf)$/i,
                handler: 'CacheFirst',
                options: {
                    cacheName: 'fonts-cache',
                    expiration: {
                        maxEntries: 20,
                        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                    },
                },
            },
        ],
    },
    devOptions: {
        enabled: false, // Set to true during development to test PWA
    },
};

export default pwaConfig;
