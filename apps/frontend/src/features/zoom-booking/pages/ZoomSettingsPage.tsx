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
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Video className="h-6 w-6 text-blue-500" />
                        Zoom Settings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage Zoom accounts, booking settings, and view logs
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30" onClick={handleSyncMeetings} disabled={syncMeetings.isPending}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", syncMeetings.isPending && "animate-spin")} />
                        {syncMeetings.isPending ? 'Syncing...' : 'Sync with Zoom'}
                    </Button>
                    <Button variant="outline" onClick={refreshAll}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs.Root defaultValue="accounts" className="space-y-6">
                <Tabs.List className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit flex-wrap">
                    <Tabs.Trigger
                        value="accounts"
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                            "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                            "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                            "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                    >
                        <Users className="h-4 w-4" />
                        Accounts
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="settings"
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                            "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                            "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                            "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                    >
                        <Settings className="h-4 w-4" />
                        Settings
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="bookings"
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                            "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                            "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                            "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                    >
                        <Calendar className="h-4 w-4" />
                        Bookings
                    </Tabs.Trigger>
                    <Tabs.Trigger
                        value="logs"
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                            "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                            "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                            "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        )}
                    >
                        <FileText className="h-4 w-4" />
                        Audit Logs
                    </Tabs.Trigger>
                </Tabs.List>

                {/* Accounts Tab */}
                <Tabs.Content value="accounts" className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white">Zoom Accounts (10)</h3>
                            <p className="text-sm text-muted-foreground">
                                Manage the 10 Zoom accounts used for booking.
                            </p>
                        </div>
                        <div className="p-4">
                            {accountsLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                                            <tr>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">#</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Name</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Color</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {accounts?.map((account, index) => (
                                                <tr key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-3 text-muted-foreground text-sm">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">
                                                        {editingAccount?.id === account.id ? (
                                                            <Input
                                                                value={editingAccount.name}
                                                                onChange={(e) => setEditingAccount({
                                                                    ...editingAccount,
                                                                    name: e.target.value
                                                                })}
                                                                className="w-32"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: account.colorHex }}
                                                                />
                                                                {account.name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingAccount?.id === account.id ? (
                                                            <Input
                                                                value={editingAccount.email}
                                                                onChange={(e) => setEditingAccount({
                                                                    ...editingAccount,
                                                                    email: e.target.value
                                                                })}
                                                                className="w-48"
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground">{account.email}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {editingAccount?.id === account.id ? (
                                                            <div className="flex gap-1">
                                                                {COLOR_PALETTE.map((color) => (
                                                                    <button
                                                                        key={color}
                                                                        className={cn(
                                                                            'w-5 h-5 rounded-full border-2',
                                                                            editingAccount.colorHex === color
                                                                                ? 'border-white ring-2 ring-blue-500'
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
                                                                className="w-6 h-6 rounded-full border"
                                                                style={{ backgroundColor: account.colorHex }}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={account.isActive ? 'default' : 'secondary'}>
                                                            {account.isActive ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {editingAccount?.id === account.id ? (
                                                            <div className="flex gap-2 justify-end">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleUpdateAccount(account.id, editingAccount)}
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setEditingAccount(null)}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
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
                    </div>
                </Tabs.Content>

                {/* Settings Tab */}
                <Tabs.Content value="settings" className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">Booking Settings</h3>

                        {settingsLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Duration Settings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Default Duration (minutes)</Label>
                                        <Select
                                            value={String(settingsForm.defaultDurationMinutes || 60)}
                                            onValueChange={(v) => setSettingsForm({
                                                ...settingsForm,
                                                defaultDurationMinutes: Number(v)
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="30">30 minutes</SelectItem>
                                                <SelectItem value="60">60 minutes</SelectItem>
                                                <SelectItem value="90">90 minutes</SelectItem>
                                                <SelectItem value="120">120 minutes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Advance Booking Days</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.advanceBookingDays || 30}
                                            onChange={(e) => setSettingsForm({
                                                ...settingsForm,
                                                advanceBookingDays: Number(e.target.value)
                                            })}
                                        />
                                    </div>
                                </div>

                                {/* Working Hours */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Time</Label>
                                        <Input
                                            type="time"
                                            value={settingsForm.slotStartTime || '08:00'}
                                            onChange={(e) => setSettingsForm({
                                                ...settingsForm,
                                                slotStartTime: e.target.value
                                            })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>End Time</Label>
                                        <Input
                                            type="time"
                                            value={settingsForm.slotEndTime || '18:00'}
                                            onChange={(e) => setSettingsForm({
                                                ...settingsForm,
                                                slotEndTime: e.target.value
                                            })}
                                        />
                                    </div>
                                </div>

                                {/* Limits */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Max Bookings Per User Per Day</Label>
                                        <Input
                                            type="number"
                                            value={settingsForm.maxBookingPerUserPerDay || 5}
                                            onChange={(e) => setSettingsForm({
                                                ...settingsForm,
                                                maxBookingPerUserPerDay: Number(e.target.value)
                                            })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Slot Interval (minutes)</Label>
                                        <Select
                                            value={String(settingsForm.slotIntervalMinutes || 30)}
                                            onValueChange={(v) => setSettingsForm({
                                                ...settingsForm,
                                                slotIntervalMinutes: Number(v)
                                            })}
                                        >
                                            <SelectTrigger>
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

                                {/* Toggle Options */}
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                    <div className="space-y-0.5">
                                        <Label>Require Description</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Users must provide a description when booking
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settingsForm.requireDescription ?? false}
                                        onCheckedChange={(checked) => setSettingsForm({
                                            ...settingsForm,
                                            requireDescription: checked
                                        })}
                                    />
                                </div>

                                {/* Blocked Dates Picker */}
                                <div className="pt-4 border-t">
                                    <BlockedDatesPicker
                                        blockedDates={settingsForm.blockedDates || []}
                                        onChange={handleBlockedDatesChange}
                                    />
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                                        <Save className="h-4 w-4 mr-2" />
                                        {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </Tabs.Content>

                {/* Bookings Tab */}
                <Tabs.Content value="bookings" className="space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white">All Bookings</h3>
                            <p className="text-sm text-muted-foreground">
                                View and manage all Zoom bookings.
                            </p>
                        </div>
                        <div className="p-4">
                            {bookingsLoading ? (
                                <ZoomBookingsTableSkeleton />
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Title</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Account</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Time</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Booked By</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {bookingsData?.data?.map((booking) => (
                                                    <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium">{booking.title}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: booking.zoomAccount?.colorHex }}
                                                                />
                                                                {booking.zoomAccount?.name}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">{booking.bookingDate}</td>
                                                        <td className="px-4 py-3">{booking.startTime} - {booking.endTime}</td>
                                                        <td className="px-4 py-3">{booking.bookedBy?.fullName || booking.bookedByUser?.fullName || '-'}</td>
                                                        <td className="px-4 py-3 flex items-center gap-2">
                                                            <Badge variant={
                                                                booking.status === 'CONFIRMED' ? 'default' :
                                                                    booking.status === 'CANCELLED' ? 'destructive' : 'secondary'
                                                            }>
                                                                {booking.status}
                                                            </Badge>
                                                            {booking.isExternal && (
                                                                <Badge variant="outline" className="border-slate-300 text-slate-500 text-[10px] h-5 px-1.5">External</Badge>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {!booking.isExternal && booking.status !== 'CANCELLED' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="text-red-500 hover:text-red-600"
                                                                    onClick={() => setCancellingBooking(booking)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!bookingsData?.data || bookingsData.data.length === 0) && (
                                                    <tr>
                                                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                                                            No bookings found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalBookingsPages > 1 && (
                                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                                            <div className="text-sm text-muted-foreground">
                                                Showing page {bookingsPage} of {totalBookingsPages}
                                                {bookingsData?.total && ` (${bookingsData.total} total)`}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setBookingsPage(p => Math.max(1, p - 1))}
                                                    disabled={bookingsPage === 1}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
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
                    </div>
                </Tabs.Content>

                {/* Audit Logs Tab */}
                <Tabs.Content value="logs">
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
