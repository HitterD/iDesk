const iconPath = '/electron-vite.svg' // Sourced from public folder

export const sendNativeNotification = (title: string, body: string, onClick?: () => void) => {
    // Check permission (Electron usually allows by default or requests)
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification')
        return
    }

    if (Notification.permission === 'granted') {
        spawnNotification(title, body, onClick)
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                spawnNotification(title, body, onClick)
            }
        })
    }
}

function spawnNotification(title: string, body: string, onClick?: () => void) {
    const notification = new Notification(title, {
        body: body,
        icon: iconPath,
        silent: false, // Windows sound
    })

    notification.onclick = () => {
        // Bring window to front
        // We need IPC for this "show-window"
        window.ipcRenderer.send('show-window') // We need to implement this in main.ts if not there
        if (onClick) onClick()
    }
}
