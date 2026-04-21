import { useNotificationStore, type NotificationItem } from '@/store/notification.store'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, HardDrive, RefreshCcw, Ticket, ExternalLink, Clock, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

// If date-fns not installed, use simple formatter
const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
}

export function NotificationList() {
    const { notifications, remove, markAsRead, clearAll } = useNotificationStore()

    const handleOpenLink = (link?: string, id?: string) => {
        if (id) markAsRead(id)
        if (link) {
            // Open in default browser
            // We need IPC handler for this if 'shell' is not available in renderer
            // But wait, standard window.open('_blank') often works in Electron if configured, 
            // or we use IPC 'open-external'
            window.ipcRenderer.send('open-external', link)
        }
    }

    if (notifications.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
                    <Bell className="w-6 h-6 text-zinc-600" />
                </div>
                <p className="text-sm font-medium">No new notifications</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-zinc-900/30 rounded-xl overflow-hidden backdrop-blur-sm border border-white/5">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h3 className="text-sm font-semibold text-zinc-300">Recent Alerts</h3>
                <button
                    onClick={clearAll}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wider font-bold"
                >
                    Clear All
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {notifications.map((item) => (
                        <NotificationCard key={item.id} item={item} onOpen={handleOpenLink} onDismiss={remove} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

function NotificationCard({ item, onOpen, onDismiss }: {
    item: NotificationItem,
    onOpen: (l?: string, id?: string) => void,
    onDismiss: (id: string) => void
}) {
    const getIcon = () => {
        switch (item.type) {
            case 'RENEWAL': return <RefreshCcw className="w-5 h-5 text-amber-400" />
            case 'HARDWARE': return <HardDrive className="w-5 h-5 text-purple-400" />
            case 'TICKET': return <Ticket className="w-5 h-5 text-blue-400" />
            default: return <Bell className="w-5 h-5 text-zinc-400" />
        }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={clsx(
                "relative group p-4 rounded-xl border transition-all duration-200",
                item.isRead
                    ? "bg-zinc-800/20 border-zinc-800/50 hover:bg-zinc-800/40"
                    : "bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 border-cyan-500/30 shadow-[0_0_15px_-5px_rgba(6,182,212,0.15)]"
            )}
        >
            <div className="flex items-start gap-4">
                <div className={clsx(
                    "p-2.5 rounded-lg shrink-0",
                    item.isRead ? "bg-zinc-800/50" : "bg-black/40 ring-1 ring-white/10"
                )}>
                    {getIcon()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h4 className={clsx(
                            "text-sm font-semibold truncate pr-2",
                            item.isRead ? "text-zinc-400" : "text-white"
                        )}>
                            {item.title}
                        </h4>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 shrink-0 bg-black/20 px-1.5 py-0.5 rounded-full">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(item.timestamp)}
                        </span>
                    </div>

                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                        {item.message}
                    </p>

                    {item.priority === 'HIGH' && !item.isRead && (
                        <div className="mt-2 text-[10px] font-bold text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            CRITICAL ATTENTION REQUIRED
                        </div>
                    )}

                    <div className="mt-3 flex gap-2">
                        {item.link && (
                            <button
                                onClick={() => onOpen(item.link, item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium transition-colors border border-cyan-500/20"
                            >
                                View Details
                                <ExternalLink className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={() => onDismiss(item.id)}
                            className="px-3 py-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>

            {!item.isRead && (
                <div className="absolute top-4 right-[-4px] w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_2px_rgba(6,182,212,0.5)]" />
            )}
        </motion.div>
    )
}
