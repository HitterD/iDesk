import { useState, useEffect, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
    Video,
    Settings,
    Calendar,
    Users,
    Save,
    RefreshCw,
    Check,
    X,
    FileText,
    CalendarX
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    useAllZoomAccounts,
    useZoomSettings,
    useUpdateZoomSettings,
    useUpdateZoomAccount,
    useAllBookings,
    useSyncMeetings,
} from '../hooks';
import { CancelBookingModal } from '../components/CancelBookingModal';
import { ZoomBookingsTableSkeleton } from '../components/ZoomSkeletons';
import { BlockedDatesPicker } from '../components/BlockedDatesPicker';
import { ZoomAuditLogsViewer } from '../components/ZoomAuditLogsViewer';
import type { ZoomAccount, ZoomSettings as ZoomSettingsType, ZoomBooking } from '../types';

// Color palette for accounts
const COLOR_PALETTE = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

export function ZoomSettingsPage() {
    const [editingAccount, setEditingAccount] = useState<ZoomAccount | null>(null);
    const [cancellingBooking, setCancellingBooking] = useState<ZoomBooking | null>(null);
    const [bookingsPage, setBookingsPage] = useState(1);
    const BOOKINGS_PER_PAGE = 10;

    // Data fetching
    const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAllZoomAccounts();
    const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useZoomSettings();
    const { data: bookingsData, isLoading: bookingsLoading, refetch: refetchBookings } = useAllBookings({
        page: bookingsPage,
        limit: BOOKINGS_PER_PAGE
    });

    // Calculate total pages
    const totalBookingsPages = useMemo(() => {
        if (!bookingsData?.total) return 1;
        return Math.ceil(bookingsData.total / BOOKINGS_PER_PAGE);
    }, [bookingsData?.total]);

    // Mutations
    const updateSettings = useUpdateZoomSettings();
    const updateAccount = useUpdateZoomAccount();
    const syncMeetings = useSyncMeetings();

    // Form state for settings
    const [settingsForm, setSettingsForm] = useState<Partial<ZoomSettingsType>>({});

    // Initialize settings form when data loads
    useEffect(() => {
        if (settings && Object.keys(settingsForm).length === 0) {
            setSettingsForm(settings);
        }
    }, [settings, settingsForm]);

    // Handle settings save
    const handleSaveSettings = async () => {
        try {
            await updateSettings.mutateAsync(settingsForm);
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Failed to save settings');
        }
    };

    // Handle account update
    const handleUpdateAccount = async (id: string, data: Partial<ZoomAccount>) => {
        try {
            await updateAccount.mutateAsync({ id, data });
            toast.success('Account updated');
            setEditingAccount(null);
        } catch (error) {
            toast.error('Failed to update account');
        }
    };

    // Handle blocked dates change
    const handleBlockedDatesChange = (dates: string[]) => {
        setSettingsForm({
            ...settingsForm,
            blockedDates: dates,
        });
    };

    // Refresh all data
    const refreshAll = () => {
        refetchAccounts();
        refetchSettings();
        refetchBookings();
    };

    const handleSyncMeetings = async () => {
        try {
            const res = await syncMeetings.mutateAsync();
            refreshAll();
            if (res && res.updatedCount === 0) {
                toast.success('Sinkronisasi selesai (tidak ada pembaruan)', {
                    description: 'Jadwal Anda saat ini sudah yang paling baru.'
                });
            }
        } catch (error) {
            toast.error('Gagal melakukan sinkronisasi dengan Zoom');
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl">
                            <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Zoom Configurations
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Manage your organization's Zoom accounts, routing rules, and historical logs.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20 bg-white dark:bg-slate-900 shadow-sm" onClick={handleSyncMeetings} disabled={syncMeetings.isPending}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", syncMeetings.isPending && "animate-spin")} />
                        {syncMeetings.isPending ? 'Syncing...' : 'Sync Data'}
                    </Button>
                    <Button variant="outline" onClick={refreshAll} className="bg-white dark:bg-slate-900 shadow-sm" size="icon">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs.Root defaultValue="settings" className="space-y-8">
                <Tabs.List className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100/80 dark:bg-slate-800/60 p-1 text-slate-500 dark:text-slate-400 max-w-full overflow-x-auto no-scrollbar border border-slate-200/50 dark:border-slate-700/50">
                    <Tabs.Trigger
                        value="settings"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="accounts"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Accounts
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="bookings"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                    >
                        <Calendar className="h-4 w-4 mr-2" />
                        Bookings
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="logs"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm"
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Audit Logs
                    </Tabs.Trigger>
                </Tabs.List>

                {/* Settings Tab (Split-Pane Design) */}
                <Tabs.Content value="settings" className="space-y-6 outline-none focus:ring-0">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        {/* Settings Header */}
                        <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Booking Rules & Constraints</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Configure operational hours, durations, and limitations for all Zoom bookings.
                                </p>
                            </div>
                            <Button onClick={handleSaveSettings} disabled={updateSettings.isPending} className="shrink-0 transition-all shadow-sm">
                                <Save className="h-4 w-4 mr-2" />
                                {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>

                        {settingsLoading ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {/* Section 1: General Options */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
                                    <div className="lg:col-span-1 space-y-1.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Duration & Lead Time</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Set the default meeting length and determine how far in advance users can book a schedule.
                                        </p>
                                    </div>
                                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">Default Duration</Label>
                                            <Select
                                                value={String(settingsForm.defaultDurationMinutes || 60)}
                                                onValueChange={(v) => setSettingsForm({
                                                    ...settingsForm,
                                                    defaultDurationMinutes: Number(v)
                                                })}
                                            >
                                                <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="30">30 minutes</SelectItem>
                                                    <SelectItem value="60">1 Hour (60 mins)</SelectItem>
                                                    <SelectItem value="90">1.5 Hours (90 mins)</SelectItem>
                                                    <SelectItem value="120">2 Hours (120 mins)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">Advance Booking Days</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800 pr-12"
                                                    value={settingsForm.advanceBookingDays || 30}
                                                    onChange={(e) => setSettingsForm({
                                                        ...settingsForm,
                                                        advanceBookingDays: Number(e.target.value)
                                                    })}
                                                />
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-sm">
                                                    days
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Working Hours */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
                                    <div className="lg:col-span-1 space-y-1.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Operational Hours</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Define the daily time window when bookings are permitted to be scheduled.
                                        </p>
                                    </div>
                                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">Start Time</Label>
                                            <Input
                                                type="time"
                                                className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800"
                                                value={settingsForm.slotStartTime || '08:00'}
                                                onChange={(e) => setSettingsForm({
                                                    ...settingsForm,
                                                    slotStartTime: e.target.value
                                                })}
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">End Time</Label>
                                            <Input
                                                type="time"
                                                className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800"
                                                value={settingsForm.slotEndTime || '18:00'}
                                                onChange={(e) => setSettingsForm({
                                                    ...settingsForm,
                                                    slotEndTime: e.target.value
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Limits */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
                                    <div className="lg:col-span-1 space-y-1.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Fair Usage Limits</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Prevent monopolization by limiting bookings per user and adjusting the intervals between slots.
                                        </p>
                                    </div>
                                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">Max Bookings Per Day / User</Label>
                                            <Input
                                                type="number"
                                                className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800"
                                                value={settingsForm.maxBookingPerUserPerDay || 5}
                                                onChange={(e) => setSettingsForm({
                                                    ...settingsForm,
                                                    maxBookingPerUserPerDay: Number(e.target.value)
                                                })}
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            <Label className="text-slate-700 dark:text-slate-300 font-medium">Slot Interval</Label>
                                            <Select
                                                value={String(settingsForm.slotIntervalMinutes || 30)}
                                                onValueChange={(v) => setSettingsForm({
                                                    ...settingsForm,
                                                    slotIntervalMinutes: Number(v)
                                                })}
                                            >
                                                <SelectTrigger className="bg-slate-50 dark:bg-slate-900/50 h-11 border-slate-200 dark:border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="15">15 minutes</SelectItem>
                                                    <SelectItem value="30">30 minutes</SelectItem>
                                                    <SelectItem value="60">60 minutes</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Preferences */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
                                    <div className="lg:col-span-1 space-y-1.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Additional Preferences</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Toggle specific behavioral rules for the booking process.
                                        </p>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <div className="flex items-start justify-between p-5 bg-slate-50/80 dark:bg-slate-800/30 rounded-xl border border-slate-200/60 dark:border-slate-800 transition-colors">
                                            <div className="space-y-1 mr-6">
                                                <Label className="text-base text-slate-900 dark:text-white">Require Description</Label>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Mandate users to provide a detailed reason or description when creating a booking.
                                                </p>
                                            </div>
                                            <Switch
                                                className="mt-1"
                                                checked={settingsForm.requireDescription ?? false}
                                                onCheckedChange={(checked) => setSettingsForm({
                                                    ...settingsForm,
                                                    requireDescription: checked
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 5: Blocked Dates */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 md:p-8">
                                    <div className="lg:col-span-1 space-y-1.5">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Exception Dates</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Block specific dates (e.g., holidays or maintenance periods) from being booked by users.
                                        </p>
                                    </div>
                                    <div className="lg:col-span-2">
                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                            <BlockedDatesPicker
                                                blockedDates={settingsForm.blockedDates || []}
                                                onChange={handleBlockedDatesChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                </Tabs.Content>

                {/* Accounts Tab */}
                <Tabs.Content value="accounts" className="outline-none focus:ring-0">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Zoom Accounts</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Manage the list of Zoom credentials used as round-robin resources.
                            </p>
                        </div>
                        
                        {accountsLoading ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">#</th>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Name</th>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Email</th>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Color ID</th>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                            <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {accounts?.map((account, index) => (
                                            <tr key={account.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4 text-slate-400">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                                                    {editingAccount?.id === account.id ? (
                                                        <Input
                                                            value={editingAccount.name}
                                                            onChange={(e) => setEditingAccount({
                                                                ...editingAccount,
                                                                name: e.target.value
                                                            })}
                                                            className="w-40 h-9 bg-white dark:bg-slate-950"
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                                                style={{ backgroundColor: account.colorHex }}
                                                            />
                                                            {account.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                    {editingAccount?.id === account.id ? (
                                                        <Input
                                                            value={editingAccount.email}
                                                            onChange={(e) => setEditingAccount({
                                                                ...editingAccount,
                                                                email: e.target.value
                                                            })}
                                                            className="w-56 h-9 bg-white dark:bg-slate-950"
                                                        />
                                                    ) : (
                                                        account.email
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {editingAccount?.id === account.id ? (
                                                        <div className="flex gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                                                            {COLOR_PALETTE.map((color) => (
                                                                <button
                                                                    key={color}
                                                                    className={cn(
                                                                        'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer',
                                                                        editingAccount.colorHex === color
                                                                            ? 'border-slate-900 dark:border-white ring-2 ring-slate-200 dark:ring-slate-700'
                                                                            : 'border-transparent'
                                                                    )}
                                                                    style={{ backgroundColor: color }}
                                                                    onClick={() => setEditingAccount({
                                                                        ...editingAccount,
                                                                        colorHex: color
                                                                    })}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="w-6 h-6 rounded-full border shadow-sm opacity-90 group-hover:opacity-100 transition-opacity"
                                                            style={{ backgroundColor: account.colorHex }}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={account.isActive ? 'default' : 'secondary'} className={cn(
                                                        "font-medium shadow-none",
                                                        account.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" : ""
                                                    )}>
                                                        {account.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {editingAccount?.id === account.id ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                className="h-8 px-3"
                                                                onClick={() => handleUpdateAccount(account.id, editingAccount)}
                                                            >
                                                                <Check className="h-4 w-4 mr-1.5" /> Save
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 px-3"
                                                                onClick={() => setEditingAccount(null)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                                            onClick={() => setEditingAccount(account)}
                                                        >
                                                            Edit
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Tabs.Content>

                {/* Bookings Tab */}
                <Tabs.Content value="bookings" className="outline-none focus:ring-0">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">All Bookings Registry</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Comprehensive history and upcoming scheduled Zoom meetings.
                            </p>
                        </div>
                        
                        {bookingsLoading ? (
                            <div className="p-6">
                                <ZoomBookingsTableSkeleton />
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Meeting Title</th>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Assigned Account</th>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Date & Time</th>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Organizer</th>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                                <th className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {bookingsData?.data?.map((booking) => (
                                                <tr key={booking.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                                                        {booking.title}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                                                style={{ backgroundColor: booking.zoomAccount?.colorHex }}
                                                            />
                                                            {booking.zoomAccount?.name}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-medium">{booking.bookingDate}</span>
                                                            <span className="text-xs text-slate-400">{booking.startTime} - {booking.endTime}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                        {booking.bookedBy?.fullName || booking.bookedByUser?.fullName || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 flex items-center gap-2">
                                                        <Badge variant={
                                                            booking.status === 'CONFIRMED' ? 'default' :
                                                                booking.status === 'CANCELLED' ? 'destructive' : 'secondary'
                                                        } className={cn(
                                                            "font-medium shadow-none",
                                                            booking.status === 'CONFIRMED' ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400" : ""
                                                        )}>
                                                            {booking.status}
                                                        </Badge>
                                                        {booking.isExternal && (
                                                            <Badge variant="outline" className="border-slate-200 text-slate-500 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] h-5 px-1.5 font-medium shadow-none">
                                                                Ext
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {!booking.isExternal && booking.status !== 'CANCELLED' && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                onClick={() => setCancellingBooking(booking)}
                                                            >
                                                                Revoke
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!bookingsData?.data || bookingsData.data.length === 0) && (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400">
                                                        <CalendarX className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                                        No bookings discovered in the registry.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                {totalBookingsPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/30 dark:bg-slate-900/30">
                                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                            Page {bookingsPage} of {totalBookingsPages}
                                            {bookingsData?.total && <span className="ml-1 opacity-70">({bookingsData.total} items)</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-white dark:bg-slate-900 h-9"
                                                onClick={() => setBookingsPage(p => Math.max(1, p - 1))}
                                                disabled={bookingsPage === 1}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-white dark:bg-slate-900 h-9"
                                                onClick={() => setBookingsPage(p => Math.min(totalBookingsPages, p + 1))}
                                                disabled={bookingsPage === totalBookingsPages}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Tabs.Content>

                {/* Audit Logs Tab */}
                <Tabs.Content value="logs" className="outline-none focus:ring-0">
                    <ZoomAuditLogsViewer />
                </Tabs.Content>
            </Tabs.Root>

            {/* Cancel Booking Modal */}
            {cancellingBooking && (
                <CancelBookingModal
                    isOpen={!!cancellingBooking}
                    onClose={() => setCancellingBooking(null)}
                    booking={cancellingBooking}
                    onSuccess={() => refetchBookings()}
                />
            )}
        </div>
    );
}

