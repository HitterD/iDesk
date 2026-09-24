export type DesktopDisplayMode = 'both' | 'toast' | 'popup';

export interface DesktopNotifierPreference {
    enabled: boolean;
    mode: DesktopDisplayMode;
}

const PREF_ENABLED_KEY = 'idesk_desktop_notifier_enabled';
const PREF_MODE_KEY = 'idesk_desktop_notifier_mode';

/**
 * Mendapatkan preferensi tampilan notifikasi desktop dari localStorage
 */
export const getDesktopNotifierPreference = (): DesktopNotifierPreference => {
    if (typeof window === 'undefined') {
        return { enabled: true, mode: 'both' };
    }
    const enabled = localStorage.getItem(PREF_ENABLED_KEY) !== 'false';
    const mode = (localStorage.getItem(PREF_MODE_KEY) as DesktopDisplayMode) || 'both';
    return { enabled, mode };
};

/**
 * Menyimpan preferensi tampilan notifikasi desktop ke localStorage dan menyinkronkan ke SJA Notifier
 */
export const setDesktopNotifierPreference = async (pref: Partial<DesktopNotifierPreference>): Promise<void> => {
    if (typeof window === 'undefined') return;

    if (pref.enabled !== undefined) {
        localStorage.setItem(PREF_ENABLED_KEY, String(pref.enabled));
    }
    if (pref.mode !== undefined) {
        localStorage.setItem(PREF_MODE_KEY, pref.mode);
        // Sinkronisasi ke aplikasi desktop jika sedang aktif di port 18399
        try {
            await fetch('http://127.0.0.1:18399/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultDisplayMode: pref.mode }),
                signal: AbortSignal.timeout(1000)
            });
        } catch {
            // Ignore if desktop app not running
        }
    }
};

/**
 * Meneruskan notifikasi WebSocket / in-app iDesk secara otomatis ke SJA Desktop Notifier di Windows
 */
export const forwardToDesktopNotifier = async (data: any, currentUser?: any): Promise<boolean> => {
    try {
        const pref = getDesktopNotifierPreference();
        if (!pref.enabled) return false;

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const targetUrl = data.link
            ? `${origin}${data.link}`
            : (data.ticketId
                ? `${origin}${currentUser?.role === 'USER' ? '/client/tickets' : '/tickets'}/${data.ticketId}`
                : origin);

        const category = data.category || (data.type === 'TICKET_REPLY' || data.type === 'CHAT_MESSAGE_RECEIVED' ? 'TICKET_REPLY' : 'Tiket');

        const payload = {
            app: 'iDesk',
            title: data.title || 'Notifikasi iDesk',
            message: data.message || '',
            url: targetUrl,
            priority: data.requiresAcknowledge || data.type === 'SLA_WARNING' || data.type === 'SLA_BREACHED' ? 'urgent' : 'high',
            display: pref.mode,
            avatar: 'idesk',
            category: category,
            ticketId: data.ticketId || undefined,
            ticketNumber: data.referenceId || (data.ticketId ? String(data.ticketId) : undefined),
            metadata: {
                from: data.sender || 'iDesk System',
                to: currentUser?.name || currentUser?.email || 'Anda',
                subject: data.title || 'Notifikasi Tiket',
                category: category,
                ticketNumber: data.referenceId || data.ticketId || undefined,
                ticketId: data.ticketId || undefined
            },
            callbackUrl: 'http://127.0.0.1:18399/reply-ack'
        };

        const res = await fetch('http://127.0.0.1:18399/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(2000)
        });

        return res.ok;
    } catch {
        return false;
    }
};
