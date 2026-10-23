import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/stores/useAuth';
import { CalendarPlus, ChevronDown, UserRoundCheck, Video } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ResHead } from '@/components/resources/ResourceParts';
import { DashLive } from '@/features/dashboard/components/DashboardParts';
import { ZoomAccountsPanel, ZoomUpcomingPanel } from '../components/ZoomResourceAside';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import { ZoomCalendarHeader, type ZoomCalendarDisplayMode } from '../components/ZoomCalendarHeader';
import { ZoomShortcutsModal } from '../components/ZoomShortcutsModal';
import { ZoomBookingModal } from '../components/ZoomBookingModal';
import { ZoomMonthView } from '../components/ZoomMonthView';
import { ZoomAccountsMatrix } from '../components/ZoomAccountsMatrix';
import { ZoomWeekView } from '../components/ZoomWeekView';
import { ZoomDayView } from '../components/ZoomDayView';
import { ZoomMyBookingsView } from '../components/ZoomMyBookingsView';
import { ZoomCalendarSkeletonView } from '../components/ZoomSkeletons';
import { useMostFreeAccount } from '../hooks/useMostFreeAccount';
import { useMarkNotificationsRead } from '@/features/notifications/hooks/useMarkNotificationsRead';
import { NotificationCategory } from '@/components/notifications/types/notification.types';

/** Opening this page counts as reading its notifications. */
const ZOOM_NOTIFICATIONS = { category: NotificationCategory.CATEGORY_ZOOM };

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
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    useMarkNotificationsRead(ZOOM_NOTIFICATIONS);
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
    const [onlyMine, setOnlyMine] = useState(false);

    const activeMode: ZoomCalendarDisplayMode = useMemo(() => {
        if (view === 'my-bookings') return 'my-bookings';
        if (monthMode === 'matrix') return 'matrix';
        return 'calendar';
    }, [view, monthMode]);

    const handleModeChange = useCallback((mode: ZoomCalendarDisplayMode) => {
        if (mode === 'calendar') {
            setView('month');
            setMonthMode('calendar');
        } else if (mode === 'matrix') {
            setView('month');
            setMonthMode('matrix');
            if (accountScope !== 'gabungan') {
                setAccountScope('gabungan');
            }
        } else if (mode === 'my-bookings') {
            setView('my-bookings');
        }
    }, [setView, accountScope, setAccountScope]);

    // Search filter (debounced via simple useState; React batches updates)
    const [searchQuery, setSearchQuery] = useState('');

    // Panel state
    const panel = useBookingPanel();

    // Deep link (iPop calendar, /zoom-booking/:id): open that booking's detail once.
    const [searchParams] = useSearchParams();
    const linkedBookingId = searchParams.get('booking');
    const { openDetail } = panel;
    useEffect(() => {
        if (linkedBookingId) openDetail(linkedBookingId);
    }, [linkedBookingId, openDetail]);

    // Current time indicator (updates every minute)
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch data
    const { data: accounts, isLoading: accountsLoading } = useZoomAccounts();
    const { data: settings } = usePublicZoomSettings();
    const syncMeetings = useSyncMeetings();
    const { data: upcomingBookings = [], isLoading: upcomingLoading } = useMyUpcomingBookings();
    const safeAccounts = accounts ?? [];
    const activeAccountId =
        accountScope !== 'gabungan' && safeAccounts.some((account) => account.id === accountScope)
            ? accountScope
            : selectedAccountId;

    // Real-time updates.
    // In Gabungan mode subscribe to ALL accounts so any booking change
    // invalidates the merged calendar query immediately (no manual refresh).
    const useGabungan = accountScope === 'gabungan';
    const socketAccountId = useGabungan ? undefined : activeAccountId;
    const { isConnected: socketConnected } = useZoomSocket(socketAccountId);

    // Multi-select account filter for Mode Gabungan
    const [activeFilterAccountIds, setActiveFilterAccountIds] = useState<Set<string>>(() => new Set());

    // Sync activeFilterAccountIds with available accounts
    useEffect(() => {
        if (safeAccounts.length > 0 && activeFilterAccountIds.size === 0) {
            setActiveFilterAccountIds(new Set(safeAccounts.map((a) => a.id)));
        }
    }, [safeAccounts, activeFilterAccountIds.size]);

    const handleToggleAccountFilter = useCallback((accountId: string) => {
        setActiveFilterAccountIds((prev) => {
            const next = new Set(prev);
            if (next.has(accountId)) {
                if (next.size > 1) {
                    next.delete(accountId);
                }
            } else {
                next.add(accountId);
            }
            return next;
        });
    }, []);

    const handleSelectAllAccounts = useCallback(() => {
        setActiveFilterAccountIds(new Set(safeAccounts.map((a) => a.id)));
    }, [safeAccounts]);

    const handleSoloAccountFilter = useCallback((accountId: string) => {
        setActiveFilterAccountIds(new Set([accountId]));
    }, []);

    const handleSelectAccount = useCallback((accountId: string) => {
        if (accountId === 'gabungan') {
            setAccountScope('gabungan');
            setActiveFilterAccountIds(new Set(safeAccounts.map((a) => a.id)));
        } else {
            setAccountScope(accountId);
        }
    }, [safeAccounts, setAccountScope]);

    // Calendar data source — fetch merged endpoint for global load accuracy, per-account for single view
    const singleCalendar = useZoomCalendar(
        view !== 'my-bookings' && !useGabungan ? activeAccountId : undefined,
        dateRange.start,
        dateRange.end,
    );
    // Always fetch merged calendar when in calendar views so load for all 10 accounts is accurate in sidebar & switcher
    const mergedCalendar = useZoomMergedCalendar(
        view !== 'my-bookings' ? dateRange.start : undefined,
        view !== 'my-bookings' ? dateRange.end : undefined,
    );

    const calendar = useGabungan
        ? mergedCalendarToCalendar(
            mergedCalendar.data as MergedCalendarDay[] | undefined,
            activeFilterAccountIds.size > 0 ? activeFilterAccountIds : undefined
        )
        : singleCalendar.data;
    const calendarLoading = useGabungan ? mergedCalendar.isLoading : singleCalendar.isLoading;

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
                settings.slotStartTime || '00:00',
                settings.slotEndTime || '23:59',
                settings.slotIntervalMinutes || 30
            );
        }
        return generateTimeLabels();
    }, [settings]);

    const isLoading = accountsLoading || calendarLoading;
    const safeCalendar = calendar ?? [];

    // Per-account meeting count derived from merged calendar (always accurate for all 10 accounts)
    const meetingsPerAccount = useMemo(() => {
        const counts = new Map<string, number>();
        for (const a of safeAccounts) {
            counts.set(a.id, 0);
        }

        const mergedDays = mergedCalendar.data as MergedCalendarDay[] | undefined;
        if (mergedDays && mergedDays.length > 0) {
            const seen = new Set<string>();
            for (const day of mergedDays) {
                for (const slot of day.slots) {
                    for (const b of slot.bookings) {
                        if (!seen.has(b.id)) {
                            seen.add(b.id);
                            if (counts.has(b.zoomAccountId)) {
                                counts.set(b.zoomAccountId, (counts.get(b.zoomAccountId) ?? 0) + 1);
                            }
                        }
                    }
                }
            }
            return counts;
        }

        const seen = new Set<string>();
        for (const day of safeCalendar) {
            for (const slot of day.slots) {
                if (slot.booking && !seen.has(slot.booking.id)) {
                    seen.add(slot.booking.id);
                    const accId = (slot.booking as any).zoomAccountId || (slot.booking as any).zoomAccount?.id || (useGabungan ? undefined : activeAccountId);
                    if (accId && counts.has(accId)) {
                        counts.set(accId, (counts.get(accId) ?? 0) + 1);
                    }
                }
                const extras = (slot as any).extraBookings;
                if (Array.isArray(extras)) {
                    for (const extra of extras) {
                        if (extra?.id && !seen.has(extra.id)) {
                            seen.add(extra.id);
                            const accId = extra.zoomAccountId || extra.zoomAccount?.id;
                            if (accId && counts.has(accId)) {
                                counts.set(accId, (counts.get(accId) ?? 0) + 1);
                            }
                        }
                    }
                }
            }
        }
        if (!useGabungan && activeAccountId && counts.get(activeAccountId) === 0 && seen.size > 0) {
            counts.set(activeAccountId, seen.size);
        }
        return counts;
    }, [safeAccounts, mergedCalendar.data, safeCalendar, useGabungan, activeAccountId]);

    const mostFreeAccount = useMostFreeAccount(safeAccounts, meetingsPerAccount);

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

    // Click on a slot → open booking panel with preset date/time
    const handleSlotClick = (day: CalendarDay, slotOrIndex: CalendarSlot | number, accountId?: string) => {
        if (!canBook) return;

        const targetAccountId = accountId ?? activeAccountId ?? safeAccounts[0]?.id;
        if (!targetAccountId) {
            toast.error('Tidak ada akun Zoom yang tersedia untuk booking');
            return;
        }

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
            zoomAccountId: targetAccountId,
        });
    };

    // Slot index click (week/day views)
    const handleSlotIndexClick = (day: CalendarDay, slotIndex: number, accountId?: string) => {
        handleSlotClick(day, slotIndex, accountId);
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
                toast.info('Sinkronisasi selesai, data sudah mutakhir', {
                    id: 'zoom-calendar-sync',
                });
            }
        } catch {
            toast.error('Gagal melakukan sinkronisasi dengan Zoom', {
                id: 'zoom-calendar-sync',
            });
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
                    hideViewSwitcher={true}
                    defaultViewMode="calendar"
                    onBookingClick={(id) => panel.openDetail(id)}
                />
            );
        } else if (view === 'month') {
            const showMatrix = monthMode === 'matrix';
            content = (
                <div className="flex flex-col h-full min-h-0">
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
                                accounts={safeAccounts}
                                isGabungan={useGabungan}
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
                    accounts={safeAccounts}
                    canBook={canBook}
                    onSlotClick={handleSlotIndexClick}
                    onBookingClick={handleBookingClick}
                    onlyMine={onlyMine}
                    accountFilterId=""
                />
            );
        } else if (view === 'day') {
            content = (
                <ZoomDayView
                    currentDate={currentDate}
                    calendar={filteredCalendar}
                    timeLabels={timeLabels}
                    currentTime={currentTime}
                    accounts={safeAccounts}
                    canBook={canBook}
                    onSlotClick={handleSlotIndexClick}
                    onBookingClick={handleBookingClick}
                    onNavigateDay={handleNavigateDay}
                    forceSingleAccountMode={!useGabungan}
                    forceSingleAccountName={safeAccounts.find((a) => a.id === activeAccountId)?.name}
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
        <div data-testid="no-accounts-empty-state" className="dash-panel zm-empty">
            <Video className="h-8 w-8" aria-hidden="true" />
            <h2 className="text-base font-semibold">Belum ada akun Zoom</h2>
            <p className="text-sm text-muted-foreground">Akun Zoom perusahaan belum dikonfigurasi. Hubungi admin ICT untuk menambahkannya di Pengaturan Zoom.</p>
        </div>
    ) : null;

    const accountLabel = accountScope === 'gabungan'
        ? (activeFilterAccountIds.size > 0 && activeFilterAccountIds.size < safeAccounts.length
            ? `${activeFilterAccountIds.size} dari ${safeAccounts.length} akun`
            : `Semua Akun Zoom (${safeAccounts.length})`)
        : (safeAccounts.find((a) => a.id === accountScope)?.name ?? 'Zoom');
    // /zoom-settings is ADMIN-only (AppRoutes); other roles get no settings entry.
    const openSettings = isAdmin ? () => navigate('/zoom-settings') : undefined;

    const filterControls = (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="queue-pop" aria-label={`Akun: ${accountLabel}`}>
                        <span className="queue-pop-k">Akun</span><span className="queue-pop-v">{accountLabel}</span><ChevronDown aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label="Filter akun">
                    <DropdownMenuRadioGroup value={accountScope} onValueChange={handleSelectAccount}>
                        <DropdownMenuRadioItem value="gabungan">Semua Akun Zoom ({safeAccounts.length})</DropdownMenuRadioItem>
                        {safeAccounts.map((a) => (
                            <DropdownMenuRadioItem key={a.id} value={a.id}>
                                <span className="res-dot mr-2" style={{ background: a.colorHex }} aria-hidden="true" />{a.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {view === 'week' && (
                <button type="button" className={cn('queue-pop zm-mine', onlyMine && 'is-on')} aria-pressed={onlyMine}
                    onClick={() => setOnlyMine((v) => !v)} title="Hanya tampilkan meeting milik Anda di kalender mingguan">
                    <UserRoundCheck aria-hidden="true" /><span className="queue-pop-v">Hanya Meeting Saya</span>
                </button>
            )}
        </>
    );

    return (
        <ZoomErrorBoundary>
            <div className="res-page pb-24 lg:pb-0">
                <ResHead icon={Video} tone="blue" title="Zoom Calendar"
                    description={`Booking ruang meeting Zoom untuk ${safeAccounts.length || 'semua'} akun perusahaan`}
                    titleAdornment={<DashLive connected={socketConnected} />}
                    actions={canBook ? <Button variant="primary" onClick={openBookingAtCurrentContext}><CalendarPlus aria-hidden="true" />Book Meeting</Button> : undefined} />
                {showEmptyState ? emptyStateNode : (
                    <>
                        <ZoomCalendarHeader
                            view={view}
                            currentDate={currentDate}
                            selectedAccountId={selectedAccountId ?? 'all'}
                            accounts={safeAccounts}
                            meetingsPerAccount={meetingsPerAccount}
                            onViewChange={setView}
                            activeMode={activeMode}
                            onModeChange={handleModeChange}
                            onPrev={navigatePrev}
                            onNext={navigateNext}
                            onToday={navigateToToday}
                            onAccountChange={(id) => setSelectedAccountId(id === 'all' ? safeAccounts[0]?.id : id)}
                            accountScope={accountScope}
                            onAccountScopeChange={handleSelectAccount}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onNavigateToDate={navigateToDate}
                            canBook={canBook}
                            onBookMeeting={openBookingAtCurrentContext}
                            filters={filterControls}
                        />
                        <div className="zm-legend" aria-label="Legenda">
                            {safeAccounts.map((a) => <span key={a.id} style={{ ['--c' as string]: a.colorHex }}><i />{a.name}</span>)}
                            <span><i className="is-mine" />Booking saya</span>
                            <span><i className="is-blocked" />Diblokir</span>
                        </div>
                        <div className="res-grid-main zm-main">
                            <section className="dash-panel zm-cal-panel" aria-label="Kalender Zoom">{calendarContent()}</section>
                            <aside className="res-stack">
                                <ZoomUpcomingPanel bookings={upcomingBookings} accounts={safeAccounts} onOpen={panel.openDetail} isLoading={upcomingLoading} />
                                <ZoomAccountsPanel
                                    accounts={safeAccounts}
                                    meetingsPerAccount={meetingsPerAccount}
                                    visibleAccountIds={activeFilterAccountIds}
                                    accountScope={accountScope}
                                    onToggleAccount={(id) => (accountScope === 'gabungan' ? handleToggleAccountFilter(id) : handleSelectAccount(id))}
                                    onShowOnly={(id) => (accountScope === 'gabungan' ? handleSoloAccountFilter(id) : handleSelectAccount(id))}
                                    onShowAll={() => handleSelectAccount('gabungan')}
                                    onOpenShortcuts={() => setShortcutsOpen(true)}
                                    onOpenSettings={openSettings}
                                />
                            </aside>
                        </div>
                    </>
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
                    onBookingCreated={panel.openDetail}
                />
            </div>
        </ZoomErrorBoundary>
    );
}
