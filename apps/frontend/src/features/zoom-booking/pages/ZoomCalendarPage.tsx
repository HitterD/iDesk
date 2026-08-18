import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useHasPageAccess } from '@/hooks/usePermissions';
import {
    useZoomAccounts,
    useZoomCalendar,
    useZoomMergedCalendar,
    useZoomSocket,
    useSyncMeetings,
    usePublicZoomSettings,
    useMyUpcomingBookings,
    useCalendarView,
    useBookingPanel,
} from '../hooks';
import type { MergedCalendarDay } from '../hooks/useZoomBooking';
import { mergedCalendarToCalendar } from '../utils/mergedCalendarAdapter';
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
import { ZoomAccountsMatrix } from '../components/ZoomAccountsMatrix';
import { LayoutGrid, CalendarDays as CalendarDaysIcon } from 'lucide-react';
import { ZoomWeekView } from '../components/ZoomWeekView';
import { ZoomDayView } from '../components/ZoomDayView';
import { ZoomMyBookingsView } from '../components/ZoomMyBookingsView';
import { ZoomCalendarSkeletonView } from '../components/ZoomSkeletons';
import { UpcomingMeetingsPanel } from '../components/UpcomingMeetingsPanel';
import { useMostFreeAccount } from '../hooks/useMostFreeAccount';

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

    // Month display mode: classic calendar vs all-accounts matrix (see every
    // Zoom account's schedule at once). Local UI state; URL view stays 'month'.
    const [monthMode, setMonthMode] = useState<'calendar' | 'matrix'>('calendar');

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
    const { data: upcomingBookings = [] } = useMyUpcomingBookings();
    const safeAccounts = accounts ?? [];
    const activeAccountId =
        accountScope !== 'gabungan' && safeAccounts.some((account) => account.id === accountScope)
            ? accountScope
            : selectedAccountId;

    // Per-account meeting count derived from my upcoming bookings (best-effort load).
    const meetingsPerAccount = useMemo(() => {
        const counts = new Map<string, number>();
        for (const booking of upcomingBookings) {
            counts.set(booking.zoomAccountId, (counts.get(booking.zoomAccountId) ?? 0) + 1);
        }
        return counts;
    }, [upcomingBookings]);

    // Real-time updates.
    // In Gabungan mode subscribe to ALL accounts so any booking change
    // invalidates the merged calendar query immediately (no manual refresh).
    const useGabungan = accountScope === 'gabungan';
    const socketAccountId = useGabungan ? undefined : activeAccountId;
    useZoomSocket(socketAccountId);

    // Day view always renders single-account. When user is in Gabungan mode and
    // switches to day view, auto-pick the most-free account so the day grid stays
    // readable.
    const isDayView = view === 'day';
    const forceSingleForDay = isDayView && useGabungan;
    const mostFreeAccount = useMostFreeAccount(safeAccounts, meetingsPerAccount);
    const effectiveActiveAccountId = forceSingleForDay
        ? (activeAccountId && safeAccounts.some((a) => a.id === activeAccountId)
            ? activeAccountId
            : mostFreeAccount?.id)
        : activeAccountId;

    // Calendar data source — merged endpoint when in Gabungan mode (and not day view),
    // per-account otherwise.
    const shouldLoadMerged = !isDayView && useGabungan;
    const singleCalendar = useZoomCalendar(
        view !== 'my-bookings' && !shouldLoadMerged ? effectiveActiveAccountId : undefined,
        dateRange.start,
        dateRange.end,
    );
    const mergedCalendar = useZoomMergedCalendar(
        view !== 'my-bookings' && shouldLoadMerged ? dateRange.start : undefined,
        view !== 'my-bookings' && shouldLoadMerged ? dateRange.end : undefined,
    );

    const calendar = shouldLoadMerged
        ? mergedCalendarToCalendar(mergedCalendar.data as MergedCalendarDay[] | undefined)
        : singleCalendar.data;
    const calendarLoading = shouldLoadMerged ? mergedCalendar.isLoading : singleCalendar.isLoading;

    // Auto-select first account
    useEffect(() => {
        if (accounts?.length && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        }
    }, [accounts, selectedAccountId]);

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
    }, [activeAccountId, canBook, currentDate, panel, safeAccounts, accountScope]);

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
            const showMatrix = monthMode === 'matrix' && useGabungan;
            content = (
                <div className="flex flex-col h-full min-h-0">
                    {/* Month display-mode toggle — matrix needs merged (Gabungan) data */}
                    {useGabungan && (
                        <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border bg-white dark:bg-slate-900">
                            <div className="flex bg-muted p-0.5 border border-border rounded-lg">
                                <button
                                    onClick={() => setMonthMode('calendar')}
                                    className={
                                        monthMode === 'calendar'
                                            ? 'flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md bg-card text-primary shadow-sm'
                                            : 'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground'
                                    }
                                >
                                    <CalendarDaysIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                    Calendar
                                </button>
                                <button
                                    onClick={() => setMonthMode('matrix')}
                                    className={
                                        monthMode === 'matrix'
                                            ? 'flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md bg-card text-primary shadow-sm'
                                            : 'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground'
                                    }
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                                    All Accounts
                                </button>
                            </div>
                            <span className="ml-2 text-xs text-muted-foreground">
                                {monthMode === 'matrix'
                                    ? 'Every Zoom account at a glance — click an empty cell to book'
                                    : 'One row per day — switch to All Accounts to compare schedules'}
                            </span>
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        {showMatrix ? (
                            <ZoomAccountsMatrix
                                currentDate={currentDate}
                                mergedDays={(mergedCalendar.data as MergedCalendarDay[] | undefined) ?? []}
                                accounts={safeAccounts}
                                canBook={canBook}
                                onBookingClick={(id) => panel.openDetail(id)}
                                onCellClick={(accountId, date) => {
                                    if (!canBook) return;
                                    panel.openBooking({
                                        date,
                                        time: format(new Date(), 'HH:00'),
                                        zoomAccountId: accountId,
                                    });
                                }}
                            />
                        ) : (
                            <ZoomMonthView
                                currentDate={currentDate}
                                calendar={filteredCalendar}
                                canBook={canBook}
                                onSlotClick={(day, slot) => handleSlotClick(day, slot)}
                                onDateDoubleClick={handleDateDoubleClick}
                                onBookingClick={handleMonthBookingClick}
                            />
                        )}
                    </div>
                </div>
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
                    forceSingleAccountMode={forceSingleForDay}
                    forceSingleAccountName={mostFreeAccount?.name}
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
                                accountScope={accountScope}
                                activeAccountName={
                                    (activeAccountId && safeAccounts.find((a) => a.id === activeAccountId)?.name) ||
                                    safeAccounts[0]?.name ||
                                    'Zoom'
                                }
                                activeAccountColor={
                                    (activeAccountId &&
                                        safeAccounts.find((a) => a.id === activeAccountId)?.colorHex) ||
                                    safeAccounts[0]?.colorHex ||
                                    '#3b82f6'
                                }
                                showAutoPickHint={accountScope === 'gabungan'}
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
                                    meetingsAtTime: meetingsPerAccount.get(a.id) ?? 0,
                                }))}
                                upcomingBookings={upcomingBookings}
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
