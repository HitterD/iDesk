import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './glassmorphism.css'
import './micro-animations.css'
import './consistency.css'
import './select-styles.css'
import { ThemeProvider } from './components/theme-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <App />
        </ThemeProvider>
    </React.StrictMode>,
)
