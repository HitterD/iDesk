import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Bell,
    Mail,
    MessageSquare,
    Smartphone,
    Clock,
    Moon,
    Settings2,
    Loader2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import api from '../../../lib/api';

interface NotificationPreference {
    id: string;
    userId: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    telegramEnabled: boolean;
    pushEnabled: boolean;
    emailAddress: string | null;
    telegramChatId: string | null;
    digestEnabled: boolean;
    digestFrequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY';
    digestTime: string | null;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    timezone: string | null;
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
    telegram: true,
};

// Map camelCase (frontend) to snake_case (backend storage)
const CHANNEL_KEY_MAP: Record<string, string> = {
    inApp: 'in_app',
    email: 'email',
    telegram: 'telegram',
    push: 'push',
};

// Helper to get type setting with fallback to default
// Backend stores with snake_case keys, so we need to convert
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

export const NotificationSettings: React.FC = () => {
    const queryClient = useQueryClient();
    const [expandedSection, setExpandedSection] = useState<string | null>('channels');

    const { data: preferences, isLoading } = useQuery<NotificationPreference>({
        queryKey: ['notification-preferences'],
        queryFn: () => api.get('/notifications/preferences').then(r => r.data),
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<NotificationPreference>) =>
            api.put('/notifications/preferences', data).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
            toast.success('Preferences updated');
        },
        onError: () => {
            toast.error('Failed to update preferences');
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
            toast.error('Failed to update type settings');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
    });

    const toggleChannel = (channel: string, enabled: boolean) => {
        updateMutation.mutate({ [`${channel}Enabled`]: enabled });
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

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
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
        <div className="space-y-6">
            {/* Channel Settings */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button
                    onClick={() => toggleSection('channels')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-medium text-slate-800 dark:text-white">Notification Channels</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Choose how you receive notifications</p>
                        </div>
                    </div>
                    {expandedSection === 'channels' ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>

                {expandedSection === 'channels' && (
                    <div className="p-4 pt-0 space-y-4">
                        <ChannelToggle
                            icon={<Bell className="w-5 h-5" />}
                            label="In-App Notifications"
                            description="Show notifications in the app"
                            enabled={preferences.inAppEnabled}
                            onChange={(v) => toggleChannel('inApp', v)}
                        />
                        <ChannelToggle
                            icon={<Mail className="w-5 h-5" />}
                            label="Email Notifications"
                            description={preferences.emailAddress || 'No email configured'}
                            enabled={preferences.emailEnabled}
                            onChange={(v) => toggleChannel('email', v)}
                        />
                        <ChannelToggle
                            icon={<MessageSquare className="w-5 h-5" />}
                            label="Telegram Notifications"
                            description={preferences.telegramChatId ? 'Connected' : 'Not connected'}
                            enabled={preferences.telegramEnabled}
                            onChange={(v) => toggleChannel('telegram', v)}
                            disabled={!preferences.telegramChatId}
                        />
                        <ChannelToggle
                            icon={<Smartphone className="w-5 h-5" />}
                            label="Push Notifications"
                            description="Coming soon"
                            enabled={preferences.pushEnabled}
                            onChange={(v) => toggleChannel('push', v)}
                            disabled={true}
                        />
                    </div>
                )}
            </div>

            {/* Digest Settings */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button
                    onClick={() => toggleSection('digest')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-medium text-slate-800 dark:text-white">Digest Mode</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Batch notifications together</p>
                        </div>
                    </div>
                    {expandedSection === 'digest' ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>

                {expandedSection === 'digest' && (
                    <div className="p-4 pt-0 space-y-4">
                        <ChannelToggle
                            icon={<Clock className="w-5 h-5" />}
                            label="Enable Digest Mode"
                            description="Receive batched notification summaries"
                            enabled={preferences.digestEnabled}
                            onChange={(v) => updateDigest({ digestEnabled: v })}
                        />

                        {preferences.digestEnabled && (
                            <div className="ml-12 space-y-3">
                                <div>
                                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">Frequency</label>
                                    <select
                                        value={preferences.digestFrequency}
                                        onChange={(e) => updateDigest({ digestFrequency: e.target.value as any })}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="REALTIME">Real-time (No batching)</option>
                                        <option value="HOURLY">Hourly</option>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                    </select>
                                </div>

                                {preferences.digestFrequency !== 'REALTIME' && preferences.digestFrequency !== 'HOURLY' && (
                                    <div>
                                        <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">Delivery Time</label>
                                        <input
                                            type="time"
                                            value={preferences.digestTime || '09:00'}
                                            onChange={(e) => updateDigest({ digestTime: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quiet Hours */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button
                    onClick={() => toggleSection('quiet')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Moon className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-medium text-slate-800 dark:text-white">Quiet Hours</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Do not disturb settings</p>
                        </div>
                    </div>
                    {expandedSection === 'quiet' ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>

                {expandedSection === 'quiet' && (
                    <div className="p-4 pt-0 space-y-4">
                        <ChannelToggle
                            icon={<Moon className="w-5 h-5" />}
                            label="Enable Quiet Hours"
                            description="Pause notifications during specified hours"
                            enabled={preferences.quietHoursEnabled}
                            onChange={(v) => updateQuietHours({ quietHoursEnabled: v })}
                        />

                        {preferences.quietHoursEnabled && (
                            <div className="ml-12 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">Start Time</label>
                                    <input
                                        type="time"
                                        value={preferences.quietHoursStart || '22:00'}
                                        onChange={(e) => updateQuietHours({ quietHoursStart: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block">End Time</label>
                                    <input
                                        type="time"
                                        value={preferences.quietHoursEnd || '07:00'}
                                        onChange={(e) => updateQuietHours({ quietHoursEnd: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Per-Type Settings */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <button
                    onClick={() => toggleSection('types')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                            <Settings2 className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-medium text-slate-800 dark:text-white">Notification Types</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Configure per-type channel settings</p>
                        </div>
                    </div>
                    {expandedSection === 'types' ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                </button>

                {expandedSection === 'types' && (
                    <div className="p-4 pt-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600">
                                        <th className="text-left py-2 pr-4">Type</th>
                                        <th className="text-center px-2">In-App</th>
                                        <th className="text-center px-2">Email</th>
                                        <th className="text-center px-2">Telegram</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notificationTypes.map((type) => (
                                        <tr key={type.key} className="border-b border-slate-100 dark:border-slate-700">
                                            <td className="py-3 pr-4">
                                                <div className="text-slate-800 dark:text-white font-medium">{type.label}</div>
                                                <div className="text-xs text-slate-500">{type.description}</div>
                                            </td>
                                            <td className="text-center px-2">
                                                <input
                                                    type="checkbox"
                                                    checked={getTypeSetting(preferences.typeSettings, type.key, 'inApp')}
                                                    onChange={(e) => updateTypeSetting(type.key, 'inApp', e.target.checked)}
                                                    disabled={!preferences.inAppEnabled}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary disabled:opacity-50"
                                                />
                                            </td>
                                            <td className="text-center px-2">
                                                <input
                                                    type="checkbox"
                                                    checked={getTypeSetting(preferences.typeSettings, type.key, 'email')}
                                                    onChange={(e) => updateTypeSetting(type.key, 'email', e.target.checked)}
                                                    disabled={!preferences.emailEnabled}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary disabled:opacity-50"
                                                />
                                            </td>
                                            <td className="text-center px-2">
                                                <input
                                                    type="checkbox"
                                                    checked={getTypeSetting(preferences.typeSettings, type.key, 'telegram')}
                                                    disabled={!preferences.telegramEnabled}
                                                    onChange={(e) => updateTypeSetting(type.key, 'telegram', e.target.checked)}
                                                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-primary focus:ring-primary disabled:opacity-50"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Channel Toggle Component
interface ChannelToggleProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

const ChannelToggle: React.FC<ChannelToggleProps> = ({
    icon,
    label,
    description,
    enabled,
    onChange,
    disabled = false,
}) => (
    <div className={`flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-3">
            <div className="text-slate-400">{icon}</div>
            <div>
                <div className="text-slate-800 dark:text-white font-medium">{label}</div>
                <div className="text-xs text-slate-500">{description}</div>
            </div>
        </div>
        <button
            onClick={() => !disabled && onChange(!enabled)}
            disabled={disabled}
            className={`relative w-12 h-6 rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    enabled ? 'left-7' : 'left-1'
                }`}
            />
        </button>
    </div>
);

export default NotificationSettings;
