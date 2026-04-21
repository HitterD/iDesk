import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Video, User, Calendar, Settings, AlertCircle, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useZoomAccounts, useZoomCalendar, useZoomSocket, useSyncMeetings } from '../hooks';
import type { CalendarSlot, CalendarDay, ZoomAccount } from '../types';
import { BookingModal } from './BookingModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import { ZoomCalendarSkeleton } from './ZoomSkeletons';
import { AccountSidebar } from './AccountSidebar';
import { UpcomingMeetingsPanel } from './UpcomingMeetingsPanel';
import { useAuth } from '@/stores/useAuth';
import { useHasFeaturePermission, useHasPageAccess } from '@/hooks/usePermissions';
import { ZoomCalendarGrid, ProcessedBooking } from './ZoomCalendarGrid';

export function ZoomCalendar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { hasAccess: canBook } = useHasPageAccess('zoom_calendar');
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
    const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

    // P3: Real-time socket updates for live conflict state
    useZoomSocket(selectedAccountId);

    // P4: Current time indicator state
    const [currentTime, setCurrentTime] = useState(new Date());

    // P4: Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const syncMeetings = useSyncMeetings();
    const handleSyncMeetings = async () => {
        try {
            const res = await syncMeetings.mutateAsync();
            if (res && res.updatedCount === 0) {
                toast.success('Sinkronisasi selesai (tidak ada pembaruan)', {
                    description: 'Jadwal Anda saat ini sudah yang paling baru.'
                });
            }
            // Note: success toast for > 0 is handled by useZoomSocket via 'sync:completed' event
        } catch (error) {
            toast.error('Gagal melakukan sinkronisasi dengan Zoom');
        }
    };

    // Fetch accounts
    const { data: accounts, isLoading: accountsLoading } = useZoomAccounts();

    // Auto-select first account when data loads
    useEffect(() => {
        if (accounts?.length && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

    // Date range for calendar (Mon-Fri)
    const startDate = format(currentWeek, 'yyyy-MM-dd');
    const endDate = format(addDays(currentWeek, 4), 'yyyy-MM-dd');

    // Fetch calendar data
    const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
        selectedAccountId,
        startDate,
        endDate
    );

    // Week navigation
    const goToPrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
    const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
    const goToToday = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Generate time labels from actual calendar data (dynamic based on settings)
    const timeLabels = useMemo(() => {
        // Use first day's slots to get the time range
        if (calendar && calendar.length > 0 && calendar[0].slots.length > 0) {
            return calendar[0].slots.map(slot => slot.time);
        }
        // Fallback to default 08:00-18:00 if no data
        const labels: string[] = [];
        for (let h = 8; h < 18; h++) {
            labels.push(`${h.toString().padStart(2, '0')}:00`);
            labels.push(`${h.toString().padStart(2, '0')}:30`);
        }
        return labels;
    }, [calendar]);

    // Handle slot click
    const handleSlotClick = (day: CalendarDay, slotIndex: number) => {
        const slot = day.slots[slotIndex];
        if (!slot) return;

        if (slot.status === 'available' && canBook) {
            setSelectedSlot({ date: day.date, time: slot.time });
            setShowBookingModal(true);
        } else if ((slot.status === 'my_booking' || slot.status === 'booked') && slot.booking) {
            setSelectedBookingId(slot.booking.id);
        }
    };

    // Handle booking click
    const handleBookingClick = (booking: ProcessedBooking) => {
        setSelectedBookingId(booking.id);
    };


    // Get selected account
    const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

    // Loading state
    if (accountsLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    // Empty state - no accounts configured
    if (!accounts?.length) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <div className="p-4 bg-amber-500/10 rounded-full">
                    <AlertCircle className="h-12 w-12 text-amber-500" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold">No Zoom Accounts Configured</h2>
                    <p className="text-muted-foreground max-w-md">
                        Zoom accounts need to be set up before the calendar can be used.
                        Please contact your administrator to initialize Zoom accounts.
                    </p>
                </div>
                {user?.role === 'ADMIN' && (
                    <Button onClick={() => navigate('/settings')} variant="outline">
                        <Settings className="h-4 w-4 mr-2" />
                        Go to Admin Settings
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
            {/* Left Sidebar - Account Selector */}
            <aside className="w-64 flex-shrink-0 hidden lg:flex lg:flex-col overflow-hidden">
                <div className="flex-1 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden shadow-sm">
                    <AccountSidebar
                        accounts={accounts || []}
                        selectedAccountId={selectedAccountId}
                        onSelectAccount={setSelectedAccountId}
                        currentWeek={currentWeek}
                        onWeekChange={setCurrentWeek}
                        onGoToToday={goToToday}
                    />
                </div>
            </aside>

            {/* Center - Calendar (flex-1) */}
            <main className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">
                {/* Header (Consolidated) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                <Video className="h-6 w-6 text-primary" />
                                Zoom Booking
                                <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full ml-1">
                                    WIB
                                </span>
                            </h1>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full">
                                <Calendar className="h-4 w-4 text-slate-500" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {format(currentWeek, 'MMM yyyy', { locale: idLocale })}
                                </span>
                                <span className="text-slate-400 font-mono font-semibold text-[11px] ml-1">
                                    W{format(currentWeek, 'w')}
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                            Pilih akun Zoom dan waktu untuk booking meeting
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
                        {/* Compact Status Legend */}
                        <div className="hidden xl:flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))]">
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500/40 ring-1 ring-emerald-500/60" /> Avail</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> My Booking</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> Others</div>
                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400" /> Blocked</div>
                        </div>

                        {/* Navigation Actions */}
                        <div className="flex items-center gap-2">
                            {user?.role === 'ADMIN' && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleSyncMeetings} 
                                    disabled={syncMeetings.isPending}
                                    className="h-9 px-4 font-semibold text-xs rounded-xl shadow-sm bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))] border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30 flex-shrink-0"
                                >
                                    <RefreshCw className={cn("h-4 w-4 mr-1.5", syncMeetings.isPending && "animate-[spin_1s_ease-in-out_infinite]")} />
                                    {syncMeetings.isPending ? 'Syncing...' : 'Sync'}
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={goToToday} className="h-9 px-4 font-semibold text-xs rounded-xl shadow-sm bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))] flex-shrink-0">
                                Today
                            </Button>
                            <div className="flex items-center bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                                <Button variant="ghost" size="sm" onClick={goToPrevWeek} className="px-3 h-9 rounded-none border-r border-[hsl(var(--border))] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={goToNextWeek} className="px-3 h-9 rounded-none text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {canBook && (
                            <Button onClick={() => setShowBookingModal(true)} className="bg-primary text-primary-foreground font-bold rounded-xl shadow-sm hover:bg-primary/90 h-9 px-4 text-sm">
                                <Plus className="h-4 w-4 mr-1.5" /> Book
                            </Button>
                        )}
                    </div>
                </div>

                {/* Calendar Grid container */}
                <div className="flex-1 min-h-0 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden relative">
                    {/* Right fade gradient for scroll hint */}
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[hsl(var(--card))] to-transparent z-10 pointer-events-none md:hidden" />
                    <div className="overflow-auto h-full custom-scrollbar scroll-smooth">
                        {calendarLoading ? (
                            <ZoomCalendarSkeleton />
                        ) : (
                            <ZoomCalendarGrid
                                calendar={calendar || []}
                                timeLabels={timeLabels}
                                canBook={canBook}
                                onSlotClick={handleSlotClick}
                                onBookingClick={handleBookingClick}
                                currentTime={currentTime}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* Right Panel - Upcoming Meetings */}
            <aside className="w-[320px] xl:w-[350px] flex-shrink-0 hidden xl:flex xl:flex-col overflow-hidden">
                <div className="flex-1 w-full bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <UpcomingMeetingsPanel maxItems={8} className="flex-1 overflow-y-auto custom-scrollbar bg-transparent border-0 shadow-none h-full rounded-none" />
                </div>
            </aside>

            {/* Booking Modal */}
            {showBookingModal && selectedAccountId && (
                <BookingModal
                    isOpen={showBookingModal}
                    onClose={() => {
                        setShowBookingModal(false);
                        setSelectedSlot(null);
                    }}
                    zoomAccountId={selectedAccountId}
                    preselectedDate={selectedSlot?.date}
                    preselectedTime={selectedSlot?.time}
                    accounts={accounts || []}
                />
            )}

            {/* Booking Details Modal */}
            {selectedBookingId && (
                <BookingDetailsModal
                    isOpen={!!selectedBookingId}
                    onClose={() => setSelectedBookingId(null)}
                    bookingId={selectedBookingId}
                />
            )}
        </div>
    );
}
