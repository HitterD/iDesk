import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Ticket, HardDrive, FileText, RotateCcw, Video } from 'lucide-react';
import api from '../../../lib/api';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { useCategorySettings } from '../../../features/notifications/hooks/useCategorySettings';
import type { CategorySettings } from '@/components/notifications/types/notification.types';
import { DesktopAppDownloadBanner } from '@/components/notifications/DesktopAppDownloadBanner';
import { resVars } from '@/components/resources/ResourceParts';
import { MgSwitch } from '@/components/management/MgmtParts';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SetHead, SetRow, SetSwitchRow } from './SettingsParts';

interface NotificationSettingsProps {
    showAdminTools?: boolean;
}

interface NotificationPreference {
    id: string;
    userId: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    emailAddress: string | null;
    digestEnabled: boolean;
    digestFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY';
    digestTime: string | null;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    timezone: string | null;
    reminderIntensity: 'OFF' | 'GENTLE' | 'MODERATE' | 'ASSERTIVE';
    typeSettings: Record<string, Record<string, boolean>>;
}

const notificationTypes = [
    { key: 'TICKET_CREATED', label: 'Ticket Created', description: 'When a new ticket is created' },
    { key: 'TICKET_ASSIGNED', label: 'Ticket Assigned', description: 'When a ticket is assigned to you' },
    { key: 'TICKET_UPDATED', label: 'Ticket Updated', description: 'When a ticket status changes' },
    { key: 'TICKET_RESOLVED', label: 'Ticket Resolved', description: 'When a ticket is resolved' },
    { key: 'TICKET_REPLY', label: 'New Reply', description: 'When someone replies to a ticket' },
    { key: 'MENTION', label: 'Mentions', description: 'When you are mentioned' },
    { key: 'SLA_WARNING', label: 'SLA Warning', description: 'When SLA is approaching breach' },
    { key: 'SLA_BREACHED', label: 'SLA Breached', description: 'When SLA has been breached' },
];

// Default type settings - all enabled by default
const DEFAULT_TYPE_SETTINGS: Record<string, boolean> = {
    inApp: true,
    email: true,
};

// Map camelCase (frontend) to snake_case (backend storage)
const CHANNEL_KEY_MAP: Record<string, string> = {
    inApp: 'in_app',
    email: 'email',
    push: 'push',
};

// Helper to get type setting with fallback to default
// Backend stores with snake_case keys, so we need to convert
const ACTION_ITEM_CATEGORIES = [
    { key: 'TICKET', label: 'Ticket', desc: 'SLA warning, tiket belum dibalas, atau konfirmasi resolusi tiket', icon: Ticket, color: 'var(--dash-blue)' },
    { key: 'HARDWARE_REQUEST', label: 'Hardware Request', desc: 'Persetujuan manajer, jadwal instalasi, atau konfirmasi serah terima barang', icon: HardDrive, color: 'var(--dash-orange)' },
    { key: 'EFORM', label: 'E-Form', desc: 'Permintaan akses sistem yang menunggu persetujuan pejabat berwenang', icon: FileText, color: 'var(--dash-navy)' },
    { key: 'ZOOM', label: 'Zoom Meeting', desc: 'Jadwal meeting Zoom terkonfirmasi hari ini', icon: Video, color: 'var(--dash-teal)' },
    { key: 'RENEWAL', label: 'Renewal Kontrak', desc: 'Kontrak vendor atau lisensi mendekati masa expired (< 7 hari)', icon: RotateCcw, color: 'var(--dash-red)' },
] satisfies Array<{ key: keyof CategorySettings; label: string; desc: string; icon: any; color: string }>;

const getTypeSetting = (
    typeSettings: Record<string, Record<string, boolean>> | undefined,
    notificationType: string,
    channel: string
): boolean => {
    const storageKey = CHANNEL_KEY_MAP[channel] || channel;

    if (!typeSettings || !typeSettings[notificationType]) {
        return DEFAULT_TYPE_SETTINGS[channel] ?? true;
    }

    const value = typeSettings[notificationType][storageKey];
    return value !== undefined ? value : (DEFAULT_TYPE_SETTINGS[channel] ?? true);
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ showAdminTools }) => {
    const queryClient = useQueryClient();
    const { settings: categorySettings, isLoading: catLoading, updateSettings } = useCategorySettings();

    // Push notification hook
    const {
        isSupported: isPushSupported,
        isSubscribed: isPushSubscribed,
        isLoading: isPushLoading,
        isConfigured: isPushConfigured,
        permission: pushPermission,
        subscribe: subscribeToPush,
        unsubscribe: unsubscribeFromPush,
        subscriptionCount,
        isPermissionDenied,
    } = usePushNotifications();

    const { data: preferences, isLoading } = useQuery<NotificationPreference>({
        queryKey: ['notification-preferences'],
        queryFn: () => api.get('/notifications/preferences').then(r => r.data),
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<NotificationPreference>) =>
            api.put('/notifications/preferences', data).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
            toast.success('Preferensi disimpan');
        },
        onError: () => {
            toast.error('Gagal menyimpan preferensi');
        },
    });

    const updateTypeSettingsMutation = useMutation({
        mutationFn: (data: { notificationType: string; channels: Record<string, boolean> }) =>
            api.patch('/notifications/preferences/type-settings', data).then(r => r.data),
        onMutate: async (newData) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['notification-preferences'] });

            // Snapshot previous value
            const previousPrefs = queryClient.getQueryData<NotificationPreference>(['notification-preferences']);

            // Convert camelCase to snake_case for storage
            const storageChannels: Record<string, boolean> = {};
            Object.entries(newData.channels).forEach(([key, value]) => {
                const storageKey = CHANNEL_KEY_MAP[key] || key;
                storageChannels[storageKey] = value;
            });

            // Optimistically update
            if (previousPrefs) {
                queryClient.setQueryData<NotificationPreference>(['notification-preferences'], {
                    ...previousPrefs,
                    typeSettings: {
                        ...previousPrefs.typeSettings,
                        [newData.notificationType]: {
                            ...previousPrefs.typeSettings?.[newData.notificationType],
                            ...storageChannels,
                        },
                    },
                });
            }

            return { previousPrefs };
        },
        onError: (_err, _newData, context) => {
            // Rollback on error
            if (context?.previousPrefs) {
                queryClient.setQueryData(['notification-preferences'], context.previousPrefs);
            }
            toast.error('Gagal menyimpan pengaturan per jenis');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
    });

    const toggleChannel = (channel: string, enabled: boolean) => {
        updateMutation.mutate({ [`${channel}Enabled`]: enabled });
    };

    // Handle push notification toggle
    const handlePushToggle = async (enabled: boolean) => {
        if (enabled) {
            const success = await subscribeToPush();
            if (success) {
                toggleChannel('push', true);
                toast.success('Push notification aktif');
            } else {
                if (isPermissionDenied) {
                    toast.error('Push notification diblokir. Izinkan di pengaturan browser.');
                } else {
                    toast.error('Gagal mengaktifkan push notification');
                }
            }
        } else {
            const success = await unsubscribeFromPush();
            if (success) {
                toggleChannel('push', false);
                toast.success('Push notification nonaktif');
            }
        }
    };

    // Get push notification status description
    const getPushDescription = (): string => {
        if (!isPushSupported) return 'Tidak didukung di browser ini';
        if (!isPushConfigured) return 'Belum dikonfigurasi (VAPID key belum diisi)';
        if (isPermissionDenied) return 'Diblokir — izinkan di pengaturan browser';
        if (isPushSubscribed) return `Aktif di ${subscriptionCount} perangkat`;
        return 'Web Push di browser ini, tetap masuk saat aplikasi ditutup (butuh HTTPS)';
    };

    const updateDigest = (settings: Partial<NotificationPreference>) => {
        updateMutation.mutate(settings);
    };

    const updateQuietHours = (settings: Partial<NotificationPreference>) => {
        updateMutation.mutate(settings);
    };

    const updateTypeSetting = (notificationType: string, channel: string, enabled: boolean) => {
        updateTypeSettingsMutation.mutate({
            notificationType,
            channels: { [channel]: enabled },
        });
    };



    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!preferences) return null;

    return (
        <div>
            <SetHead title="Notification Preferences" sub="Pilih cara Anda menerima notifikasi." />
            <DesktopAppDownloadBanner showAdminTools={showAdminTools} />

            <SetSwitchRow title="In-App" sub="Tampilkan notifikasi di aplikasi" checked={preferences.inAppEnabled} onChange={(v) => toggleChannel('inApp', v)} />
            <SetSwitchRow title="Email" sub={preferences.emailAddress || 'Belum ada email terdaftar'} checked={preferences.emailEnabled} onChange={(v) => toggleChannel('email', v)} />
            <SetRow title="Push browser" sub={getPushDescription()}>
                {isPushLoading ? <Loader2 className="w-4 h-4 animate-spin text-[var(--td-text-3)]" aria-label="Memproses" /> : null}
                <MgSwitch checked={isPushSubscribed && preferences.pushEnabled} onChange={handlePushToggle} label="Push browser"
                    disabled={!isPushSupported || !isPushConfigured || isPushLoading} />
            </SetRow>
            {isPermissionDenied && (
                <div className="res-note set-warn"><AlertCircle aria-hidden="true" /><span>Push notification diblokir. Izinkan di pengaturan browser.</span></div>
            )}
            <SetSwitchRow title="Digest Mode" sub="Gabungkan notifikasi menjadi ringkasan berkala" checked={preferences.digestEnabled} onChange={(v) => updateDigest({ digestEnabled: v })} />
            {preferences.digestEnabled && (
                <div className="mg-setting set-sub-row">
                    <div><b>Frekuensi digest</b></div>
                    <select aria-label="Frekuensi digest" className="mg-input set-ctl" value={preferences.digestFrequency} onChange={(e) => updateDigest({ digestFrequency: e.target.value as any })}>
                        <option value="REALTIME">Real-time (No batching)</option>
                        <option value="HOURLY">Hourly</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                    </select>
                    {preferences.digestFrequency !== 'REALTIME' && preferences.digestFrequency !== 'HOURLY' && (
                        <input type="time" aria-label="Waktu kirim digest" className="mg-input set-ctl-sm" value={preferences.digestTime || '09:00'}
                            onChange={(e) => updateDigest({ digestTime: e.target.value })} />
                    )}
                </div>
            )}
            <SetSwitchRow title="Quiet Hours" sub={`Jeda notifikasi ${preferences.quietHoursStart || '22:00'}–${preferences.quietHoursEnd || '07:00'}`}
                checked={preferences.quietHoursEnabled} onChange={(v) => updateQuietHours({ quietHoursEnabled: v })} />
            {preferences.quietHoursEnabled && (
                <div className="mg-setting set-sub-row">
                    <div><b>Rentang jam tenang</b></div>
                    <input type="time" aria-label="Mulai jam tenang" className="mg-input set-ctl-sm" value={preferences.quietHoursStart || '22:00'}
                        onChange={(e) => updateQuietHours({ quietHoursStart: e.target.value })} />
                    <span className="text-[var(--td-text-3)]">–</span>
                    <input type="time" aria-label="Selesai jam tenang" className="mg-input set-ctl-sm" value={preferences.quietHoursEnd || '07:00'}
                        onChange={(e) => updateQuietHours({ quietHoursEnd: e.target.value })} />
                </div>
            )}
            <SetRow title="Action Reminders" sub="Seberapa sering mengingatkan item yang tertunda">
                <SegmentedControl aria-label="Intensitas pengingat" className="dash-seg is-sm"
                    options={[{ value: 'OFF', label: 'Off' }, { value: 'GENTLE', label: 'Gentle (1h)' }, { value: 'MODERATE', label: 'Moderate (30m)' }, { value: 'ASSERTIVE', label: 'Assertive (15m)' }]}
                    value={preferences.reminderIntensity} onValueChange={(v) => updateMutation.mutate({ reminderIntensity: v as NotificationPreference['reminderIntensity'] })} />
            </SetRow>

            <section className="set-section" aria-label="Kategori Action Items">
                <h3>Kategori Action Items</h3>
                <p>Kategori yang dinonaktifkan tidak akan muncul di Action Command Center.</p>
                {catLoading ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-[var(--td-text-3)]"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Memuat…</div>
                ) : categorySettings ? (
                    <ul className="dash-list">
                        {ACTION_ITEM_CATEGORIES.map(({ key, label, desc, icon: Icon, color }) => (
                            <li key={key}><div className="dash-li">
                                <span className="dash-ico" style={resVars({ '--c': color })}><Icon aria-hidden="true" /></span>
                                <div className="grow1"><b>{label}</b><small>{desc}</small></div>
                                <MgSwitch checked={Boolean(categorySettings[key])} onChange={() => updateSettings({ [key]: !categorySettings[key] })} label={`Aktifkan ${label}`} />
                            </div></li>
                        ))}
                    </ul>
                ) : null}
            </section>

            <section className="set-section" aria-label="Notification Types">
                <h3>Notification Types</h3>
                <p>Atur kanal per jenis notifikasi. Kanal yang dimatikan di atas tidak bisa diubah per jenis.</p>
                <div className="set-type-grid" role="table" aria-label="Kanal per jenis notifikasi">
                    <div className="set-type-head" role="row"><span role="columnheader">Jenis</span><span role="columnheader">In-App</span><span role="columnheader">Email</span></div>
                    {notificationTypes.map((type) => (
                        <div key={type.key} className="set-type-row" role="row">
                            <span role="cell"><b>{type.label}</b><small>{type.description}</small></span>
                            <span role="cell"><input type="checkbox" className="mg-check" aria-label={`${type.label} In-App`}
                                checked={getTypeSetting(preferences.typeSettings, type.key, 'inApp')}
                                onChange={(e) => updateTypeSetting(type.key, 'inApp', e.target.checked)} disabled={!preferences.inAppEnabled} /></span>
                            <span role="cell"><input type="checkbox" className="mg-check" aria-label={`${type.label} Email`}
                                checked={getTypeSetting(preferences.typeSettings, type.key, 'email')}
                                onChange={(e) => updateTypeSetting(type.key, 'email', e.target.checked)} disabled={!preferences.emailEnabled} /></span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default NotificationSettings;
