import { portalEquivalent } from './roleHome';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nomor tiket yang bisa dibaca orang (mis. 281026-ORD-0012), tidak pernah id/GUID tiket. */
export const readableTicketNumber = (data: { ticketNumber?: string | null; referenceId?: string | null }): string | undefined => {
    const candidate = data.ticketNumber || data.referenceId || '';
    return candidate && !UUID.test(candidate) ? candidate : undefined;
};

/** Pengirim yang ditampilkan: orangnya (PIC, atau pelapor bagi agen) bila diketahui. */
export const senderOf = (data: { senderName?: string | null; sender?: string | null }): string =>
    data.senderName || data.sender || 'iDesk';

/**
 * Meneruskan notifikasi WebSocket / in-app iDesk secara otomatis ke SJA Desktop Notifier di Windows
 */
/** How long one tab's claim on a notification keeps the other tabs from forwarding it too. */
const FORWARD_CLAIM_MS = 30_000;
const CLAIM_PREFIX = 'sja-forwarded:';

/**
 * True for exactly one open tab per notification: every tab gets the socket event, but the desktop notifier
 * must show it once. The first tab to write the claim wins; the others see it and skip.
 */
export function claimForward(id: string | undefined, now: number = Date.now()): boolean {
    if (!id || typeof localStorage === 'undefined') return true;
    try {
        const key = `${CLAIM_PREFIX}${id}`;
        const existing = Number(localStorage.getItem(key));
        if (existing && now - existing < FORWARD_CLAIM_MS) return false;
        localStorage.setItem(key, String(now));
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k?.startsWith(CLAIM_PREFIX) && now - Number(localStorage.getItem(k)) > FORWARD_CLAIM_MS) localStorage.removeItem(k);
        }
        return true;
    } catch {
        return true;
    }
}

/** The user is looking at iDesk right now: the in-app toast is enough, a desktop popup on top is noise. */
const isLookingAtApp = (): boolean =>
    typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();

export const forwardToDesktopNotifier = async (data: any, currentUser?: any): Promise<boolean> => {
    try {
        const pref = getDesktopNotifierPreference();
        if (!pref.enabled) return false;
        if (isLookingAtApp() || !claimForward(data.id || data.notificationId)) return false;

        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        // Same page the bell opens, in this user's portal.
        const path = data.link
            ? (portalEquivalent(data.link, currentUser?.role) ?? data.link)
            : (data.ticketId ? (portalEquivalent(`/tickets/${data.ticketId}`, currentUser?.role) ?? '') : '');
        const targetUrl = `${origin}${path}`;

        const category = data.category || (data.type === 'TICKET_REPLY' || data.type === 'CHAT_MESSAGE_RECEIVED' ? 'TICKET_REPLY' : 'Tiket');
        const ticketNumber = readableTicketNumber(data);
        const from = senderOf(data);

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
            ticketNumber,
            metadata: {
                from,
                to: currentUser?.name || currentUser?.email || 'Anda',
                subject: data.title || 'Notifikasi Tiket',
                category: category,
                ticketNumber,
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
