import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
    quietHoursEnabled: boolean
    quietHoursStart: string // "22:00"
    quietHoursEnd: string // "07:00"
    snoozeUntil: number | null

    setQuietHours: (enabled: boolean, start?: string, end?: string) => void
    setSnooze: (durationMinutes: number) => void
    cancelSnooze: () => void
    isQuietModeActive: () => boolean
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            snoozeUntil: null,

            setQuietHours: (enabled, start, end) => set(state => ({
                quietHoursEnabled: enabled,
                quietHoursStart: start ?? state.quietHoursStart,
                quietHoursEnd: end ?? state.quietHoursEnd
            })),

            setSnooze: (minutes) => set({
                snoozeUntil: Date.now() + minutes * 60 * 1000
            }),

            cancelSnooze: () => set({ snoozeUntil: null }),

            isQuietModeActive: () => {
                const { quietHoursEnabled, quietHoursStart, quietHoursEnd, snoozeUntil } = get()
                const now = new Date()

                // Check Snooze
                if (snoozeUntil && now.getTime() < snoozeUntil) return true

                // Check Quiet Hours
                if (!quietHoursEnabled) return false

                const currentMinutes = now.getHours() * 60 + now.getMinutes()

                const [startH, startM] = quietHoursStart.split(':').map(Number)
                const [endH, endM] = quietHoursEnd.split(':').map(Number)

                const startTotal = startH * 60 + startM
                const endTotal = endH * 60 + endM

                if (startTotal > endTotal) {
                    // Span midnight (e.g. 22:00 to 07:00)
                    return currentMinutes >= startTotal || currentMinutes < endTotal
                } else {
                    // Same day (e.g. 09:00 to 17:00)
                    return currentMinutes >= startTotal && currentMinutes < endTotal
                }
            }
        }),
        {
            name: 'idesk-settings',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
