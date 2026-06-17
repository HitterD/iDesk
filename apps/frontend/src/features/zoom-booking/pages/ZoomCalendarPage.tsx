import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useHasPageAccess } from '@/hooks/usePermissions';
import {
    useZoomAccounts,
    useZoomCalendar,
    useZoomSocket,
    useSyncMeetings,
    usePublicZoomSettings,
    useCalendarView,
    useBookingPanel,
} from '../hooks';
import type { CalendarDay, CalendarSlot } from '../types'; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { ProcessedBooking } from '../components/ZoomCalendarGrid';
import { ZoomErrorBoundary } from '../components/ZoomErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomCalendarHeader } from '../components/ZoomCalendarHeader';
import { ZoomCalendarSubBar } from '../components/ZoomCalendarSubBar';
import { ZoomCalendarShell } from '../components/ZoomCalendarShell';
import { ZoomRightSidebar } from '../components/ZoomRightSidebar';
import { ZoomBookingPanel } from '../components/ZoomBookingPanel';
import { ZoomMonthView } from '../components/ZoomMonthView';
import { ZoomWeekView } from '../components/ZoomWeekView';
import { ZoomDayView } from '../components/ZoomDayView';
import { ZoomMyBookingsView } from '../components/ZoomMyBookingsView';
import { ZoomBookingForm } from '../components/ZoomBookingForm';
import { ZoomBookingDetailView } from '../components/ZoomBookingDetailView';
import { ZoomRescheduleView } from '../components/ZoomRescheduleView';
import { ZoomCalendarSkeletonView } from '../components/ZoomSkeletons';
import { UpcomingMeetingsPanel } from '../components/UpcomingMeetingsPanel';

// Generate time labels from settings
function generateTimeLabels(
    startTime = '08:00',
    endTime = '18:00',
    intervalMinutes = 30
): string[] {
    const labels: string[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let current = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (current < end) {
        const h = Math.floor(current / 60);
        const m = current % 60;
        labels.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        current += intervalMinutes;
    }
    return labels;
}

export function ZoomCalendarPage() {
    const { hasAccess: canBook } = useHasPageAccess('zoom_calendar');
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
    const [currentTime, setCurrentTime] = useState(new Date());

    // URL state management
    const {
        view,
        currentDate,
        dateRange,
        setView,
        navigatePrev,
        navigateNext,
        navigateToDate,
        navigateToToday,
    } = useCalendarView();

    // Panel state
    const panel = useBookingPanel();

    // Real-time updates
    useZoomSocket(selectedAccountId);

    // Current time indicator (updates every minute)
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch data
    const { data: accounts, isLoading: accountsLoading } = useZoomAccounts();
    const { data: settings } = usePublicZoomSettings();
    const syncMeetings = useSyncMeetings();

    // Auto-select first account
    useEffect(() => {
        if (accounts?.length && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

    // Calendar data for selected date range & account
    const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
        view !== 'my-bookings' ? selectedAccountId : undefined,
        dateRange.start,
        dateRange.end
    );

    // Time labels from settings
    const timeLabels = useMemo(() => {
        if (settings) {
            return generateTimeLabels(
                settings.slotStartTime || '08:00',
                settings.slotEndTime || '18:00',
                settings.slotIntervalMinutes || 30
            );
        }
        return generateTimeLabels();
    }, [settings]);

    const isLoading = accountsLoading || calendarLoading;
    const safeAccounts = accounts ?? [];
    const safeCalendar = calendar ?? [];

    // Slot click → open booking panel
    const handleSlotClick = (day: CalendarDay, slotOrIndex: CalendarSlot | number) => {
        if (!canBook || !selectedAccountId) return;

        let time: string;
        if (typeof slotOrIndex === 'number') {
            const slot = day.slots[slotOrIndex];
            if (!slot || slot.status !== 'available') return;
            time = slot.time;
        } else {
            if (slotOrIndex.status !== 'available') return;
            time = slotOrIndex.time;
        }

        panel.openBooking({
            date: day.date,
            time,
            zoomAccountId: selectedAccountId,
        });
    };

    // Slot index click (week/day views)
    const handleSlotIndexClick = (day: CalendarDay, slotIndex: number) => {
        handleSlotClick(day, slotIndex);
    };

    // Booking click → open detail panel (just need the ID)
    const handleBookingClick = (booking: ProcessedBooking) => {
        panel.openDetail(booking.id);
    };

    // Month view booking click (by id)
    const handleMonthBookingClick = (bookingId: string, _day: CalendarDay) => {
        panel.openDetail(bookingId);
    };

    // Double-click on month day → switch to day view
    const handleDateDoubleClick = (date: Date) => {
        setView('day');
        navigateToDate(date);
    };

    // Day view navigation
    const handleNavigateDay = (delta: number) => {
        if (delta < 0) navigatePrev();
        else navigateNext();
    };

    // Sync
    const handleSync = async () => {
        try {
            const res = await syncMeetings.mutateAsync();
            if (res && (res as any).updatedCount === 0) {
                toast.success('Sinkronisasi selesai (tidak ada pembaruan)');
            }
        } catch {
            toast.error('Gagal melakukan sinkronisasi dengan Zoom');
        }
    };

    // Panel content based on mode
    const panelContent = () => {
        if (!panel.mode) return null;

        if (panel.mode === 'booking' && panel.context.zoomAccountId) {
            return (
                <ZoomBookingForm
                    zoomAccountId={panel.context.zoomAccountId}
                    preselectedDate={panel.context.preselectedDate}
                    preselectedTime={panel.context.preselectedTime}
                    accounts={safeAccounts}
                    onClose={panel.close}
                />
            );
        }

        if (panel.mode === 'detail' && panel.context.bookingId) {
            return (
                <ZoomBookingDetailView
                    bookingId={panel.context.bookingId}
                    onClose={panel.close}
                    onReschedule={(booking) => panel.openReschedule(booking)}
                />
            );
        }

        if (panel.mode === 'reschedule' && panel.context.booking) {
            return (
                <ZoomRescheduleView
                    booking={panel.context.booking}
                    onClose={panel.close}
                    onSuccess={panel.close}
                />
            );
        }

        return null;
    };

    // Calendar view content
    const calendarContent = () => {
        let content = null;
        if (isLoading) {
            content = <ZoomCalendarSkeletonView view={view} />;
        } else if (view === 'my-bookings') {
            content = (
                <ZoomMyBookingsView
                    onBookingClick={(id) => panel.openDetail(id)}
                />
            );
        } else if (view === 'month') {
            content = (
                <ZoomMonthView
                    currentDate={currentDate}
                    calendar={safeCalendar}
                    canBook={canBook}
                    onSlotClick={(day, slot) => handleSlotClick(day, slot)}
                    onDateDoubleClick={handleDateDoubleClick}
                    onBookingClick={handleMonthBookingClick}
                />
            );
        } else if (view === 'week') {
            content = (
                <ZoomWeekView
                    currentDate={currentDate}
                    calendar={safeCalendar}
                    timeLabels={timeLabels}
                    currentTime={currentTime}
                    canBook={canBook}
                    onSlotClick={handleSlotIndexClick}
                    onBookingClick={handleBookingClick}
                />
            );
        } else if (view === 'day') {
            content = (
                <ZoomDayView
                    currentDate={currentDate}
                    calendar={safeCalendar}
                    timeLabels={timeLabels}
                    currentTime={currentTime}
                    canBook={canBook}
                    onSlotClick={handleSlotIndexClick}
                    onBookingClick={handleBookingClick}
                    onNavigateDay={handleNavigateDay}
                />
            );
        }

        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full"
                >
                    {content}
                </motion.div>
            </AnimatePresence>
        );
    };

    return (
        <ZoomErrorBoundary>
            <div className="min-h-0 h-auto lg:h-[calc(100vh-2rem)] flex flex-col animate-fade-in-up">
                <ZoomCalendarShell
                    header={
                        <ZoomCalendarHeader
                            view={view}
                            currentDate={currentDate}
                            selectedAccountId={selectedAccountId ?? 'all'}
                            accounts={safeAccounts}
                            onViewChange={setView}
                            onPrev={navigatePrev}
                            onNext={navigateNext}
                            onToday={navigateToToday}
                            onAccountChange={(id) => setSelectedAccountId(id === 'all' ? safeAccounts[0]?.id : id)}
                            onNavigateToDate={navigateToDate}
                            canBook={canBook}
                            onBookMeeting={() => {
                                if (!selectedAccountId && safeAccounts.length === 0) return;
                                const accountIdToUse = selectedAccountId === 'all' || !selectedAccountId
                                    ? safeAccounts[0]?.id
                                    : selectedAccountId;

                                panel.openBooking({
                                    date: format(currentDate, 'yyyy-MM-dd'),
                                    time: format(new Date(), 'HH:00'),
                                    zoomAccountId: accountIdToUse!,
                                });
                            }}
                        />
                    }
                    subBar={
                        <ZoomCalendarSubBar
                            view={view}
                            onViewChange={setView}
                            onBook1Hour={() => {
                                if (!selectedAccountId && safeAccounts.length === 0) return;
                                const accountIdToUse = selectedAccountId === 'all' || !selectedAccountId
                                    ? safeAccounts[0]?.id
                                    : selectedAccountId;
                                panel.openBooking({
                                    date: format(currentDate, 'yyyy-MM-dd'),
                                    time: format(new Date(), 'HH:00'),
                                    zoomAccountId: accountIdToUse!,
                                });
                            }}
                            onBookCustom={() => {
                                if (!selectedAccountId && safeAccounts.length === 0) return;
                                const accountIdToUse = selectedAccountId === 'all' || !selectedAccountId
                                    ? safeAccounts[0]?.id
                                    : selectedAccountId;
                                panel.openBooking({
                                    date: format(currentDate, 'yyyy-MM-dd'),
                                    time: format(new Date(), 'HH:00'),
                                    zoomAccountId: accountIdToUse!,
                                });
                            }}
                            onOpenShortcuts={() => {
                                // Phase 8 will wire to ZoomShortcutsModal
                                toast.info('Shortcuts modal coming soon');
                            }}
                            onOpenSettings={() => {
                                window.location.href = '/zoom-calendar/settings';
                            }}
                            isLive
                            lastSyncAt={null}
                        />
                    }
                    sidebar={
                        <ZoomRightSidebar
                            accounts={safeAccounts.map((a) => ({
                                id: a.id,
                                name: a.name,
                                colorHex: a.colorHex ?? '#3b82f6',
                                meetingsAtTime: 0,
                            }))}
                            upcomingBookings={[]}
                            onBook1Hour={() => {
                                if (!selectedAccountId && safeAccounts.length === 0) return;
                                const accountIdToUse = selectedAccountId === 'all' || !selectedAccountId
                                    ? safeAccounts[0]?.id
                                    : selectedAccountId;
                                panel.openBooking({
                                    date: format(currentDate, 'yyyy-MM-dd'),
                                    time: format(new Date(), 'HH:00'),
                                    zoomAccountId: accountIdToUse!,
                                });
                            }}
                            onBookCustom={() => {
                                if (!selectedAccountId && safeAccounts.length === 0) return;
                                const accountIdToUse = selectedAccountId === 'all' || !selectedAccountId
                                    ? safeAccounts[0]?.id
                                    : selectedAccountId;
                                panel.openBooking({
                                    date: format(currentDate, 'yyyy-MM-dd'),
                                    time: format(new Date(), 'HH:00'),
                                    zoomAccountId: accountIdToUse!,
                                });
                            }}
                            onSync={handleSync}
                            lastSyncAt={null}
                            userName="User"
                        />
                    }
                    isPanelOpen={panel.isOpen}
                    calendarContent={calendarContent()}
                    panel={
                        <ZoomBookingPanel
                            isOpen={panel.isOpen}
                            mode={panel.mode}
                            onClose={panel.close}
                        >
                            {panelContent()}
                        </ZoomBookingPanel>
                    }
                    topStrip={
                        <UpcomingMeetingsPanel compact className="rounded-none border-x-0 border-t-0 shadow-none" />
                    }
                />
            </div>
        </ZoomErrorBoundary>
    );
}
