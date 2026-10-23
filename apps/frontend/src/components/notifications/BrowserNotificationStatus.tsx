import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, BellRing, Lock, MonitorX } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { MgBanner } from '@/components/management/MgmtParts';
import { ensurePushSubscription, getNotificationSupport, hasLocalPushSubscription } from '@/lib/webPush';

interface PushStatus { isConfigured: boolean; isSubscribed: boolean; thisBrowser: boolean }

const TEST_ERRORS: Readonly<Record<string, string>> = {
    'No active push subscriptions for user': 'Browser ini belum tersambung. Klik "Sambungkan" dulu.',
};

/**
 * Whether this browser shows iDesk notifications as OS toasts (Web Push), and the one step to fix it if not.
 * Works without the SJA desktop notifier, which stays an optional extra.
 */
export const BrowserNotificationStatus: React.FC = () => {
    const queryClient = useQueryClient();
    const [support, setSupport] = useState(getNotificationSupport);
    const [busy, setBusy] = useState(false);
    const { data: status } = useQuery<PushStatus>({
        queryKey: ['push-status'],
        // The server counts the account's devices; this browser needs its own subscription.
        queryFn: async () => ({ ...(await api.get('/notifications/push/status')).data, thisBrowser: await hasLocalPushSubscription() }),
        enabled: support === 'granted',
        staleTime: 60_000,
    });

    const connect = async () => {
        setBusy(true);
        try {
            if (getNotificationSupport() === 'default') await Notification.requestPermission();
            setSupport(getNotificationSupport());
            if (await ensurePushSubscription()) toast.success('Notifikasi browser aktif di perangkat ini');
            await queryClient.invalidateQueries({ queryKey: ['push-status'] });
        } finally {
            setBusy(false);
        }
    };

    const sendTest = async () => {
        setBusy(true);
        try {
            const { data } = await api.post<{ delivered: boolean; error: string | null }>('/notifications/push/test');
            if (data.delivered) toast.success('Notifikasi uji terkirim. Lihat pojok layar Anda.');
            else toast.error(TEST_ERRORS[data.error ?? ''] ?? data.error ?? 'Notifikasi uji tidak terkirim');
        } finally {
            setBusy(false);
        }
    };

    if (support === 'insecure') {
        return (
            <MgBanner tone="warn" icon={Lock} title="Notifikasi browser butuh HTTPS">
                Browser hanya mengizinkan notifikasi di alamat https://. Buka iDesk lewat alamat HTTPS-nya, bukan alamat IP.
            </MgBanner>
        );
    }
    if (support === 'unsupported') {
        return (
            <MgBanner tone="warn" icon={MonitorX} title="Browser ini tidak mendukung notifikasi">
                Gunakan Chrome atau Edge versi terbaru di komputer untuk menerima notifikasi di layar.
            </MgBanner>
        );
    }
    if (support === 'denied') {
        return (
            <MgBanner tone="crit" icon={BellOff} title="Notifikasi diblokir di browser ini">
                Klik ikon gembok di samping alamat, ubah Notifikasi menjadi Izinkan, lalu muat ulang halaman.
            </MgBanner>
        );
    }
    if (support === 'default' || (status && (!status.isConfigured || !status.isSubscribed || !status.thisBrowser))) {
        return (
            <MgBanner tone="warn" icon={BellOff} title="Notifikasi browser belum aktif"
                actions={<Button variant="primary" onClick={connect} loading={busy}>{support === 'default' ? 'Izinkan notifikasi' : 'Sambungkan'}</Button>}>
                Aktifkan agar tiket dan pesan baru muncul di layar meski tab iDesk tertutup.
            </MgBanner>
        );
    }
    return (
        <MgBanner icon={BellRing} title="Notifikasi browser aktif"
            actions={<Button variant="soft" onClick={sendTest} loading={busy}>Kirim uji</Button>}>
            Tiket dan pesan baru muncul di layar meski tab iDesk tertutup atau diminimalkan.
        </MgBanner>
    );
};
