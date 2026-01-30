/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>
        send(channel: string, ...args: any[]): void
        on(channel: string, func: (...args: any[]) => void): void
        off(channel: string, func: (...args: any[]) => void): void

        // Type specific methods if needed
        getJwt(): Promise<string | null>
        setJwt(token: string): Promise<void>
        clearJwt(): Promise<void>
        getCookie(name: string): Promise<string | null>
    }
}
