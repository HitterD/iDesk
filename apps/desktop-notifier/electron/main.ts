/**
 * iDesk Desktop Notifier - Electron Main Process
 * 
 * This file handles:
 * - Window creation with correct path resolution for both dev and packaged modes
 * - System tray integration with minimize-to-tray behavior
 * - Secure JWT storage via electron-store
 * - IPC handlers for renderer communication
 */

import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============================================================================
// PATH RESOLUTION (CRITICAL FOR ASAR PACKAGING)
// ============================================================================
// In development: __dirname is in /dist-electron
// In production: app is packaged into resources/app.asar
// process.resourcesPath points to /resources folder in packaged app

const isDev = !app.isPackaged

// Renderer assets (index.html, CSS, JS bundles)
const RENDERER_DIST = isDev
    ? path.join(__dirname, '..', 'dist')
    : path.join(process.resourcesPath, 'app.asar', 'dist')

// Preload script (now compiled as CommonJS)
const PRELOAD_PATH = isDev
    ? path.join(__dirname, 'preload.cjs')
    : path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'preload.cjs')

// Public assets (icons, etc.)
const PUBLIC_PATH = isDev
    ? path.join(__dirname, '..', 'public')
    : path.join(process.resourcesPath, 'app.asar', 'dist')

// Dev server URL (only set in development)
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// ============================================================================
// GLOBAL STATE
// ============================================================================
let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false // Flag to distinguish close vs minimize

// Secure encrypted storage for JWT tokens
const store = new Store({
    name: 'idesk-config',
    encryptionKey: 'idesk-secure-key-v1', // TODO: Move to OS Keychain in production
})

// ============================================================================
// WINDOW CREATION
// ============================================================================
function createWindow() {
    win = new BrowserWindow({
        width: 420,
        height: 600,
        minWidth: 380,
        minHeight: 500,
        // TEMPORARILY DISABLE transparency for debugging
        // transparent: true,
        // frame: false,
        frame: true, // Enable frame for debugging
        backgroundColor: '#18181b', // zinc-900 fallback
        resizable: true,
        show: false, // Don't show until ready
        webPreferences: {
            preload: PRELOAD_PATH,
            contextIsolation: true, // Security: isolate renderer from Node.js
            nodeIntegration: false, // Security: no Node.js in renderer
            sandbox: false, // Required for preload scripts with imports
        },
    })

    // ---- ERROR HANDLING ----
    // Log any load failures (critical for debugging blank screen)
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`[ELECTRON] Failed to load: ${errorCode} - ${errorDescription}`)
        console.error(`[ELECTRON] URL: ${validatedURL}`)
        // Show error message in window for debugging
        win?.loadURL(`data:text/html;charset=utf-8,
      <html>
        <body style="background:#18181b;color:#ef4444;font-family:system-ui;padding:40px;">
          <h1>Load Error</h1>
          <p>Code: ${errorCode}</p>
          <p>Description: ${errorDescription}</p>
          <p>URL: ${validatedURL}</p>
        </body>
      </html>
    `)
    })

    // Log when page finishes loading
    win.webContents.on('did-finish-load', () => {
        console.log('[ELECTRON] Page loaded successfully')
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // ---- MINIMIZE TO TRAY BEHAVIOR ----
    // Intercept close event - hide window instead of quitting (unless explicitly quitting)
    win.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            win?.hide()
            return false
        }
    })

    // ---- LOAD CONTENT ----
    if (VITE_DEV_SERVER_URL) {
        // Development: Load from Vite dev server
        console.log(`[ELECTRON] Loading dev server: ${VITE_DEV_SERVER_URL}`)
        win.loadURL(VITE_DEV_SERVER_URL)
        win.webContents.openDevTools({ mode: 'detach' })
    } else {
        // Production: Load from built files
        const indexPath = path.join(RENDERER_DIST, 'index.html')
        console.log(`[ELECTRON] Loading file: ${indexPath}`)
        win.loadFile(indexPath)
        // DevTools disabled in production (uncomment for debugging)
        // win.webContents.openDevTools({ mode: 'detach' })
    }

    // Show window when ready
    win.once('ready-to-show', () => {
        win?.show()
        win?.focus()
    })
}

// ============================================================================
// SYSTEM TRAY
// ============================================================================
function createTray() {
    // Use a simple icon - in production, use a proper .ico file
    const iconPath = path.join(PUBLIC_PATH, 'vite.svg')
    const icon = nativeImage.createFromPath(iconPath)

    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open iDesk Notifier',
            click: () => {
                win?.show()
                win?.focus()
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip('iDesk Notification Center')
    tray.setContextMenu(contextMenu)

    // Double-click on tray to open
    tray.on('double-click', () => {
        win?.show()
        win?.focus()
    })
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================
app.whenReady().then(() => {
    console.log('[ELECTRON] App ready')
    console.log(`[ELECTRON] isDev: ${isDev}`)
    console.log(`[ELECTRON] RENDERER_DIST: ${RENDERER_DIST}`)
    console.log(`[ELECTRON] PRELOAD_PATH: ${PRELOAD_PATH}`)

    createTray()
    createWindow()
})

// Handle window-all-closed (on Windows, should not quit when window closed)
app.on('window-all-closed', () => {
    // On Windows, the tray keeps the app alive
    // Only quit if explicitly requested via tray menu
    if (process.platform !== 'darwin' && isQuitting) {
        app.quit()
    }
})

// MacOS: Re-create window when dock icon clicked
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    } else {
        win?.show()
    }
})

// Handle before-quit to set quitting flag
app.on('before-quit', () => {
    isQuitting = true
})

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Show main window (called from renderer when notification clicked)
ipcMain.on('show-window', () => {
    win?.show()
    win?.focus()
})

// Open external URL in default browser
ipcMain.on('open-external', (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url)
    }
})

// ---- JWT TOKEN MANAGEMENT ----
ipcMain.handle('get-jwt', async () => {
    // Try encrypted store first
    const stored = store.get('jwt') as string | undefined
    if (stored) return stored

    // Fallback: Try to get from cookie (for session-based auth)
    try {
        const cookies = await win?.webContents.session.cookies.get({ name: 'access_token' })
        if (cookies && cookies.length > 0) {
            return cookies[0].value
        }
    } catch (e) {
        console.error('[ELECTRON] Failed to get cookie:', e)
    }

    return null
})

ipcMain.handle('set-jwt', (_event, token: string) => {
    store.set('jwt', token)
})

ipcMain.handle('clear-jwt', () => {
    store.delete('jwt')
})

ipcMain.handle('get-cookie', async (_event, name: string) => {
    try {
        if (!win) return null
        const cookies = await win.webContents.session.cookies.get({ name })
        return cookies.length > 0 ? cookies[0].value : null
    } catch (error) {
        console.error('[ELECTRON] Failed to get cookie:', error)
        return null
    }
})
