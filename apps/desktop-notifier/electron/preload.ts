/**
 * Electron Preload Script
 * 
 * This script runs in a privileged context before the renderer process loads.
 * It safely exposes IPC methods to the renderer via contextBridge.
 * 
 * NOTE: This is compiled to CommonJS format for Electron compatibility.
 */

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe subset of IPC functionality to the renderer
contextBridge.exposeInMainWorld('ipcRenderer', {
    // Generic IPC methods
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(event, ...args))
    },
    off: (channel, callback) => {
        ipcRenderer.off(channel, callback)
    },
    send: (channel, ...args) => {
        ipcRenderer.send(channel, ...args)
    },
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args)
    },

    // Auth-specific methods (for cleaner API)
    getJwt: () => ipcRenderer.invoke('get-jwt'),
    setJwt: (token) => ipcRenderer.invoke('set-jwt', token),
    clearJwt: () => ipcRenderer.invoke('clear-jwt'),
    getCookie: (name) => ipcRenderer.invoke('get-cookie', name),
})

console.log('[PRELOAD] Preload script loaded successfully')
