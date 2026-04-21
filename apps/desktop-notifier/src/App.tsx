import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Bell, XCircle, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/auth.store'

import { socketService } from '@/services/socket.service'

function App() {
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (isAuthenticated && user) {
      // We need token. checkAuth loaded it into store? No, persist loads user.
      // We need to get token again for socket.
      window.ipcRenderer.getCookie('access_token').then(token => {
        if (token) socketService.connect(user, token)
      })
    } else {
      socketService.disconnect()
    }
  }, [isAuthenticated, user])

  if (isLoading) return <div className="min-h-screen bg-transparent flex items-center justify-center"></div>

  return (
    <div className="min-h-screen w-full bg-zinc-900 text-white overflow-hidden rounded-xl border border-zinc-700 shadow-2xl flex flex-col font-sans">
      {/* Title Bar */}
      <div className="h-8 bg-zinc-800 flex items-center px-3 select-none drag-region justify-between border-b border-zinc-700">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          <Shield className="w-3 h-3 text-cyan-500" />
          <span>iDesk Notification Center</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-zinc-900/0 to-zinc-900/0 pointer-events-none" />

        <AnimatePresence mode='wait'>
          {!isAuthenticated ? (
            <LoginScreen key="login" />
          ) : (
            <MainDashboard key="dashboard" onLogout={logout} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function LoginScreen() {
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      await login(email, password)
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="flex flex-col items-center justify-center flex-1 gap-8 z-10"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse" />
          <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center ring-1 ring-white/10 relative z-10 shadow-2xl">
            <Bell className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
          <p className="text-zinc-500 text-sm">Sign in to activate agent alerts</p>
        </div>
      </div>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-400 text-xs font-medium"
          >
            <XCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Work Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 text-white"
            placeholder="agent@idesk.com"
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all placeholder:text-zinc-700 text-white"
            placeholder="••••••••"
            disabled={busy}
          />
        </div>

        <button
          disabled={busy}
          className={clsx(
            "w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98] mt-2",
            busy && "opacity-50 cursor-not-allowed grayscale"
          )}
        >
          {busy ? 'Authenticating...' : 'Connect to iDesk Network'}
        </button>
      </form>
    </motion.div>
  )
}

import { NotificationList } from './components/NotificationList'
import { SettingsScreen } from './components/SettingsScreen'
import { Settings } from 'lucide-react'

function MainDashboard({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuthStore()
  const [view, setView] = useState<'LIST' | 'SETTINGS'>('LIST')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col flex-1 gap-4 z-10 overflow-hidden"
    >
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            System Active
          </h2>
          <p className="text-xs text-zinc-500">Monitoring for <span className="text-cyan-400 font-medium">{user?.email}</span></p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1 border border-zinc-700/50">
          <button
            onClick={() => setView('SETTINGS')}
            className={clsx(
              "p-2 rounded-md transition-all",
              view === 'SETTINGS' ? "bg-cyan-500/20 text-cyan-400" : "hover:bg-white/5 text-zinc-500 hover:text-white"
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          <button
            onClick={onLogout}
            className="p-2 hover:bg-white/5 rounded-md text-zinc-500 hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode='wait'>
          {view === 'LIST' ? (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <NotificationList />
            </motion.div>
          ) : (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SettingsScreen onBack={() => setView('LIST')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default App
