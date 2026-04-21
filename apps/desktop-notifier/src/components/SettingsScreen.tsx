import { useSettingsStore } from '@/store/settings.store'
import { motion } from 'framer-motion'
import { Moon, Clock, ArrowLeft, BellOff } from 'lucide-react'
import clsx from 'clsx'

export function SettingsScreen({ onBack }: { onBack: () => void }) {
    const { quietHoursEnabled, quietHoursStart, quietHoursEnd, setQuietHours, snoozeUntil, setSnooze, cancelSnooze } = useSettingsStore()

    // Local state for inputs to avoid stutter if store updates are slow (though Zustand is fast)
    // Actually direct store binding is fine for this scale

    return (
        <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="flex flex-col h-full bg-zinc-900/30 rounded-xl overflow-hidden backdrop-blur-sm border border-white/5"
        >
            <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-black/20">
                <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-4 h-4 text-zinc-400" />
                </button>
                <h3 className="text-sm font-semibold text-zinc-300">Preferences</h3>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto">
                {/* Quiet Hours Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Moon className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-white">Quiet Hours</h4>
                                <p className="text-[10px] text-zinc-500">Suppress toasts during specific times</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setQuietHours(!quietHoursEnabled)}
                            className={clsx(
                                "w-10 h-5 rounded-full transition-colors relative",
                                quietHoursEnabled ? "bg-indigo-500" : "bg-zinc-700"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                quietHoursEnabled ? "left-6" : "left-1"
                            )} />
                        </button>
                    </div>

                    {quietHoursEnabled && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="grid grid-cols-2 gap-4 pl-10"
                        >
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Start Time</label>
                                <input
                                    type="time"
                                    value={quietHoursStart}
                                    onChange={(e) => setQuietHours(true, e.target.value, undefined)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold">End Time</label>
                                <input
                                    type="time"
                                    value={quietHoursEnd}
                                    onChange={(e) => setQuietHours(true, undefined, e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded p-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="h-px bg-white/5" />

                {/* Snooze Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <BellOff className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-white">Snooze Notifications</h4>
                            <p className="text-[10px] text-zinc-500">Temporarily pause all alerts</p>
                        </div>
                    </div>

                    {snoozeUntil && snoozeUntil > Date.now() ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span className="text-xs text-amber-300">
                                    Snoozed until {new Date(snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <button
                                onClick={cancelSnooze}
                                className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2 py-1 rounded transition-colors"
                            >
                                End
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {[30, 60, 240].map(mins => (
                                <button
                                    key={mins}
                                    onClick={() => setSnooze(mins)}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white py-2 rounded-lg text-xs font-medium border border-zinc-700 transition-colors"
                                >
                                    {mins >= 60 ? `${mins / 60} Hours` : `${mins} Mins`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
