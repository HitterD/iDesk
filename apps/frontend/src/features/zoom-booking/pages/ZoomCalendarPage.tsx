import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { ZoomShortcutsModal } from '../components/ZoomShortcutsModal';
import { ZoomBookingModal } from '../components/ZoomBookingModal';
import { ZoomMonthView } from '../components/ZoomMonthView';
import { ZoomWeekView } from '../components/ZoomWeekView';
import { ZoomDayView } from '../components/ZoomDayView';
import { ZoomMyBookingsView } from '../components/ZoomMyBookingsView';
import { ZoomCalendarSkeletonView } from '../components/ZoomSkeletons';
import { UpcomingMeetingsPanel } from '../components/UpcomingMeetingsPanel';

interface SyncMeetingsResult {
    updatedCount?: number;
}

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
        accountScope,
        setAccountScope,
    } = useCalendarView();

    // Shortcuts modal
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    // Search filter (debounced via simple useState; React batches updates)
    const [searchQuery, setSearchQuery] = useState('');

    // Panel state
    const panel = useBookingPanel();

    // Current time indicator (updates every minute)
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch data
    const { data: accounts, isLoading: accountsLoading } = useZoomAccounts();
    const { data: settings } = usePublicZoomSettings();
    const syncMeetings = useSyncMeetings();
    const safeAccounts = accounts ?? [];
    const activeAccountId =
        accountScope !== 'gabungan' && safeAccounts.some((account) => account.id === accountScope)
            ? accountScope
            : selectedAccountId;

    // Real-time updates
    useZoomSocket(activeAccountId);

    // Auto-select first account
    useEffect(() => {
        if (accounts?.length && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

    // Calendar data for selected date range & account
    const { data: calendar, isLoading: calendarLoading } = useZoomCalendar(
        view !== 'my-bookings' ? activeAccountId : undefined,
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
    const safeCalendar = calendar ?? [];

    // Filter calendar by search query (case-insensitive substring on booking title)
    const filteredCalendar = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return safeCalendar;
        return safeCalendar.map((day) => ({
            ...day,
            slots: day.slots.map((slot) => {
                if (!slot.booking) return slot;
                if (slot.booking.title.toLowerCase().includes(q)) return slot;
                // Drop non-matching bookings by replacing with available
                return {
                    ...slot,
                    status: 'available' as const,
                    booking: undefined,
                };
            }),
        }));
    }, [safeCalendar, searchQuery]);

    const openBookingAtCurrentContext = useCallback(() => {
        if (!canBook) {
            toast.error('Anda tidak punya akses untuk booking Zoom');
            return;
        }

        const zoomAccountId = activeAccountId ?? safeAccounts[0]?.id;
        if (!zoomAccountId) {
            toast.error('Tidak ada akun Zoom yang tersedia untuk booking');
            return;
        }

        panel.openBooking({
            date: format(currentDate, 'yyyy-MM-dd'),
            time: format(new Date(), 'HH:00'),
            zoomAccountId,
        });
    }, [activeAccountId, canBook, currentDate, panel, safeAccounts]);

    // Global keyboard shortcuts (must be after safeAccounts/panel declared)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable
            ) {
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            switch (e.key) {
                case '?':
                    e.preventDefault();
                    setShortcutsOpen(true);
                    break;
                case 'T':
                case 't':
                    e.preventDefault();
                    navigateToToday();
                    break;
                case 'B':
                case 'b': {
                    e.preventDefault();
                    openBookingAtCurrentContext();
                    break;
                }
                case 'G':
                case 'g':
                    e.preventDefault();
                    setAccountScope(
                        accountScope === 'gabungan'
                            ? safeAccounts[0]?.id ?? 'gabungan'
                            : 'gabungan',
                    );
                    break;
                default:
                    break;
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [currentDate, accountScope, safeAccounts, panel, navigateToToday, openBookingAtCurrentContext, setAccountScope]);

    // Slot click → open booking panel
    const handleSlotClick = (day: CalendarDay, slotOrIndex: CalendarSlot | number) => {
        if (!canBook || !activeAccountId) return;

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
            zoomAccountId: activeAccountId,
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
            const res = await syncMeetings.mutateAsync() as SyncMeetingsResult | undefined;
            if (res?.updatedCount === 0) {
                toast.success('Sinkronisasi selesai (tidak ada pembaruan)');
            }
        } catch {
            toast.error('Gagal melakukan sinkronisasi dengan Zoom');
        }
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
                    calendar={filteredCalendar}
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
                    calendar={filteredCalendar}
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
                    calendar={filteredCalendar}
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

    // Empty state when no Zoom accounts configured (and not loading, and not in My Bookings)
    const showEmptyState =
        view !== 'my-bookings' && !accountsLoading && safeAccounts.length === 0;

    // Empty state UI — rendered above the shell when no accounts configured.
    const emptyStateNode: React.ReactNode = showEmptyState ? (
        <div data-testid="no-accounts-empty-state">
            <Video className="h-8 w-8" aria-hidden="true" />
            <h2>Belum ada akun Zoom</h2>
            <Button onClick={() => toast.info('Request Account')}>Request Account</Button>
        </div>
    ) : null;

    return (
        <ZoomErrorBoundary>
            <div className="min-h-0 h-auto lg:h-[calc(100vh-2rem)] flex flex-col animate-fade-in-up">
                {showEmptyState ? emptyStateNode : (
                    <ZoomCalendarShell
                        header={(
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
                                accountScope={accountScope}
                                onAccountScopeChange={setAccountScope}
                                searchQuery={searchQuery}
                                onSearchChange={setSearchQuery}
                                onNavigateToDate={navigateToDate}
                                canBook={canBook}
                                onBookMeeting={openBookingAtCurrentContext}
                            />
                        )}
                        subBar={(
                            <ZoomCalendarSubBar
                                view={view}
                                onViewChange={setView}
                                onBook1Hour={openBookingAtCurrentContext}
                                onBookCustom={openBookingAtCurrentContext}
                                onOpenShortcuts={() => setShortcutsOpen(true)}
                                onOpenSettings={() => { window.location.href = '/zoom-calendar/settings'; }}
                                isLive
                                lastSyncAt={null}
                            />
                        )}
                        sidebar={(
                            <ZoomRightSidebar
                                accounts={safeAccounts.map((a) => ({
                                    id: a.id,
                                    name: a.name,
                                    colorHex: a.colorHex ?? '#3b82f6',
                                    meetingsAtTime: 0,
                                }))}
                                upcomingBookings={[]}
                                onBook1Hour={openBookingAtCurrentContext}
                                onBookCustom={openBookingAtCurrentContext}
                                onSync={handleSync}
                                lastSyncAt={null}
                                userName="User"
                            />
                        )}
                        calendarContent={calendarContent()}
                        topStrip={(
                            <UpcomingMeetingsPanel compact className="rounded-none border-x-0 border-t-0 shadow-none" />
                        )}
                    />
                )}
                <ZoomShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                <ZoomBookingModal
                    open={panel.isOpen}
                    onClose={panel.close}
                    mode={panel.mode ?? 'booking'}
                    zoomAccountId={panel.context.zoomAccountId}
                    preselectedDate={panel.context.preselectedDate}
                    preselectedTime={panel.context.preselectedTime}
                    bookingId={panel.context.bookingId}
                    booking={panel.context.booking}
                    accounts={safeAccounts}
                    onReschedule={panel.openReschedule}
                    onRescheduleSuccess={panel.close}
                />
            </div>
        </ZoomErrorBoundary>
    );
}
