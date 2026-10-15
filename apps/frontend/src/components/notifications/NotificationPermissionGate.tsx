import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Lock, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import {
    ensurePushSubscription,
    getNotificationSupport,
    watchNotificationPermission,
    type NotificationSupport,
} from '@/lib/webPush';

const BLOCKED_STEPS = [
    'Klik ikon gembok di sebelah kiri alamat iDesk di address bar.',
    'Pilih "Site settings" / "Izin situs", lalu ubah "Notifications" menjadi "Allow".',
    'Kembali ke tab ini dan klik "Cek lagi".',
];

/**
 * Signed-in users must allow OS notifications before using iDesk, so chat toasts
 * reach them. Browsers only grant this after a click, so the gate asks once; when
 * the user blocked it, it explains how to re-enable it. Browsers that cannot show
 * notifications at all get a warning banner instead of a dead end.
 */
export const NotificationPermissionGate: React.FC<{
    children: React.ReactNode;
    /** Public screens (TV board, feedback form) never ask. */
    disabled?: boolean;
}> = ({ children, disabled = false }) => {
    const { isAuthenticated, user } = useAuth();
    const [support, setSupport] = useState<NotificationSupport>(getNotificationSupport);
    const [isAsking, setIsAsking] = useState(false);
    const [dismissedWarning, setDismissedWarning] = useState(false);

    const refresh = useCallback(() => setSupport(getNotificationSupport()), []);

    useEffect(() => watchNotificationPermission(refresh), [refresh]);
    useEffect(() => {
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [refresh]);

    // Re-run per account so a shared PC's subscription follows whoever is signed in.
    useEffect(() => {
        if (!disabled && isAuthenticated && support === 'granted') void ensurePushSubscription();
    }, [disabled, isAuthenticated, support, user?.id]);

    const askPermission = async () => {
        setIsAsking(true);
        try {
            await Notification.requestPermission();
        } finally {
            setIsAsking(false);
            refresh();
        }
    };

    if (disabled || !isAuthenticated || support === 'granted') return <>{children}</>;

    if (support === 'unsupported' || support === 'insecure') {
        return (
            <>
                {!dismissedWarning && (
                    <div role="status" className="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,560px)] -translate-x-1/2 items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p className="flex-1">
                            {support === 'insecure'
                                ? 'Notifikasi tidak bisa aktif karena iDesk dibuka lewat koneksi tidak aman. Buka lewat https://idesk.santos.co.id.'
                                : 'Browser ini tidak mendukung notifikasi. Gunakan Chrome atau Edge di komputer agar pesan tiket muncul sebagai notifikasi.'}
                        </p>
                        <button type="button" onClick={() => setDismissedWarning(true)} className="text-xs font-semibold underline">
                            Tutup
                        </button>
                    </div>
                )}
                {children}
            </>
        );
    }

    const isBlocked = support === 'denied';
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="notif-gate-title" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
            <div className="glass-card w-full max-w-md rounded-2xl p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isBlocked ? <BellOff className="h-7 w-7" aria-hidden="true" /> : <BellRing className="h-7 w-7" aria-hidden="true" />}
                </div>
                <h1 id="notif-gate-title" className="text-xl font-bold text-slate-900 dark:text-white">
                    {isBlocked ? 'Notifikasi iDesk diblokir' : 'Aktifkan notifikasi iDesk'}
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Setiap pesan baru di tiket Anda akan muncul sebagai notifikasi Windows, dan bisa diklik untuk langsung membuka tiketnya.
                </p>

                {isBlocked ? (
                    <>
                        <ol className="mt-5 space-y-2 text-left text-sm text-slate-700 dark:text-slate-200">
                            {BLOCKED_STEPS.map((step, index) => (
                                <li key={step} className="flex gap-2">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{index + 1}</span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-500">
                            <Lock className="h-3 w-3" aria-hidden="true" /> Ikon gembok ada di kiri alamat situs
                        </p>
                        <button type="button" onClick={refresh} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white">
                            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Cek lagi
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={askPermission}
                        disabled={isAsking}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
                    >
                        <BellRing className="h-4 w-4" aria-hidden="true" /> Aktifkan notifikasi
                    </button>
                )}
            </div>
        </div>
    );
};
