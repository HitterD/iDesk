import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Video, User, Calendar, Settings, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useZoomAccounts, useZoomCalendar } from '../hooks';
import type { CalendarSlot, CalendarDay, ZoomAccount } from '../types';
import { BookingModal } from './BookingModal';
import { BookingDetailsModal } from './BookingDetailsModal';
import { ZoomCalendarSkeleton } from './ZoomSkeletons';
import { AccountSidebar } from './AccountSidebar';
import { UpcomingMeetingsPanel } from './UpcomingMeetingsPanel';
import { useAuth } from '@/stores/useAuth';

// Slot interval in minutes (default 30)
const SLOT_INTERVAL = 30;
const SLOT_HEIGHT = 48; // pixels per slot (increased from 32 for readability)

// Helper: calculate end time from start time and interval
const getTimeRangeLabel = (startTime: string, intervalMinutes: number = SLOT_INTERVAL): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + intervalMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    return `${startTime}-${endTime}`;
};

// P1: Enhanced slot status colors with better hover states and transitions
const SLOT_BG = {
    available: 'bg-transparent cursor-pointer transition-all duration-150 hover:bg-emerald-500/20 hover:ring-1 hover:ring-inset hover:ring-emerald-400/40',
    booked: 'bg-amber-400/15 border-l-2 border-amber-400 cursor-pointer transition-all hover:bg-amber-400/25',
    my_booking: 'bg-blue-400/15 border-l-2 border-blue-400 cursor-pointer transition-all hover:bg-blue-400/25',
    blocked: 'bg-gray-500/10 cursor-not-allowed opacity-60',
};

// P1: Helper for time display - emphasize hours, de-emphasize 30-min marks
const formatTimeDisplay = (time: string): { main: string; isHour: boolean } => {
    const [h, m] = time.split(':');
    const isHour = m === '00';
    return {
        main: isHour ? `${h}:00` : time,
        isHour,
    };
};

// P3: Check if time is start of hour for visual separator
const isHourStart = (time: string): boolean => {
    return time.endsWith(':00');
};

interface ProcessedBooking {
    id: string;
    title: string;
    bookedBy: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    rowStart: number; // 1-indexed grid row
    rowSpan: number;
    isMyBooking: boolean;
}

export function ZoomCalendar() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
    const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

    // P4: Current time indicator state
    const [currentTime, setCurrentTime] = useState(new Date());

    // P4: Keyboard navigation state
    const [focusedCell, setFocusedCell] = useState<{ dayIndex: number; timeIndex: number } | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    // P4: Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

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

    // Process bookings for spanning display
    const processBookingsForDay = (day: CalendarDay): ProcessedBooking[] => {
        const bookings: ProcessedBooking[] = [];
        const processedSlots = new Set<string>();

        day.slots.forEach((slot, index) => {
            if (slot.booking && !processedSlots.has(slot.booking.id)) {
                const startIndex = index;
                const rowSpan = Math.ceil(slot.booking.durationMinutes / SLOT_INTERVAL);

                bookings.push({
                    id: slot.booking.id,
                    title: slot.booking.title,
                    bookedBy: slot.booking.bookedBy,
                    startTime: slot.booking.startTime || slot.time,     // Use actual booking time
                    endTime: slot.booking.endTime || slot.endTime,      // Use actual booking time
                    durationMinutes: slot.booking.durationMinutes,
                    rowStart: startIndex + 2, // +2 for header row (1-indexed)
                    rowSpan,
                    isMyBooking: slot.status === 'my_booking',
                });

                // Mark all slots of this booking as processed
                processedSlots.add(slot.booking.id);
            }
        });

        return bookings;
    };

    // Handle slot click
    const handleSlotClick = (day: CalendarDay, slotIndex: number) => {
        const slot = day.slots[slotIndex];
        if (!slot) return;

        if (slot.status === 'available') {
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

    // P4: Calculate current time position for the red indicator line
    const getCurrentTimePosition = useMemo(() => {
        if (!timeLabels.length) return null;

        const now = currentTime;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        // Get start time from first slot
        const [startH, startM] = timeLabels[0].split(':').map(Number);
        const startTotalMinutes = startH * 60 + startM;

        // Get end time from last slot
        const [endH, endM] = timeLabels[timeLabels.length - 1].split(':').map(Number);
        const endTotalMinutes = endH * 60 + endM + SLOT_INTERVAL;

        // Check if current time is within calendar range
        if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
            return null;
        }

        // Calculate position as percentage
        const totalRange = endTotalMinutes - startTotalMinutes;
        const offset = currentTotalMinutes - startTotalMinutes;
        const percentage = (offset / totalRange) * 100;

        // Calculate pixel offset (header row height ~60px + slot heights)
        const headerHeight = 72; // Approximate header row height
        const totalSlotsHeight = timeLabels.length * SLOT_HEIGHT;
        const pixelOffset = headerHeight + (offset / totalRange) * totalSlotsHeight;

        return { percentage, pixelOffset };
    }, [timeLabels, currentTime]);

    // P4: Keyboard navigation handler
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!calendar || !focusedCell) return;

        const { dayIndex, timeIndex } = focusedCell;
        let newDayIndex = dayIndex;
        let newTimeIndex = timeIndex;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                newTimeIndex = Math.max(0, timeIndex - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                newTimeIndex = Math.min(timeLabels.length - 1, timeIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                newDayIndex = Math.max(0, dayIndex - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                newDayIndex = Math.min(calendar.length - 1, dayIndex + 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (calendar[dayIndex]) {
                    handleSlotClick(calendar[dayIndex], timeIndex);
                }
                return;
            case 'Escape':
                setFocusedCell(null);
                return;
            default:
                return;
        }

        setFocusedCell({ dayIndex: newDayIndex, timeIndex: newTimeIndex });
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
                        10 Zoom accounts need to be set up before the calendar can be used.
                        Please contact your administrator or restart the backend to initialize default accounts.
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
        <div className="flex gap-6 h-[calc(100vh-120px)]">
            {/* Left Sidebar - Account Selector (280px) */}
            <aside className="w-72 shrink-0 hidden lg:block">
                <div className="bg-card rounded-xl border h-full overflow-hidden">
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
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Video className="h-6 w-6 text-blue-500" />
                            Zoom Booking Calendar
                            <span className="text-xs font-normal bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full ml-2">
                                WIB (UTC+7)
                            </span>
                        </h1>
                        <p className="text-muted-foreground">
                            Pilih akun Zoom dan waktu untuk booking meeting
                        </p>
                    </div>
                    <Button onClick={() => setShowBookingModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Book Meeting
                    </Button>
                </div>

                {/* P2: Icon-based legend with better spacing and contrast */}
                <div className="flex flex-wrap items-center gap-3 text-xs bg-gradient-to-r from-muted/60 to-muted/40 rounded-xl px-4 py-2.5 backdrop-blur-sm border border-border/50">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Status:</span>
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-1.5 group">
                            <div className="w-3 h-3 rounded-full bg-emerald-500/40 ring-2 ring-emerald-500/60 group-hover:ring-emerald-400 transition-all" />
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Available</span>
                        </div>
                        <div className="flex items-center gap-1.5 group">
                            <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-400 shadow-sm shadow-blue-500/50" />
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">My Booking</span>
                        </div>
                        <div className="flex items-center gap-1.5 group">
                            <div className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-300 shadow-sm shadow-amber-400/50" />
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Others</span>
                        </div>
                        <div className="flex items-center gap-1.5 group">
                            <div className="w-3 h-3 rounded-full bg-gray-400/60 ring-2 ring-gray-400/40" />
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Blocked</span>
                        </div>
                    </div>
                </div>

                {/* P2: Pill-style week navigation */}
                <div className="flex items-center justify-between bg-card rounded-xl p-2 border shadow-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={goToPrevWeek}
                        className="rounded-full h-9 px-3 hover:bg-muted hover:shadow-sm transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1.5 font-medium">Previous</span>
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToToday}
                            className="rounded-full h-8 px-4 text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                            Today
                        </Button>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground hidden sm:block" />
                            <h2 className="text-lg font-bold">
                                {format(currentWeek, 'MMMM yyyy', { locale: idLocale })}
                            </h2>
                            <span className="bg-primary/10 text-primary font-mono font-bold text-xs px-2 py-0.5 rounded-full">
                                W{format(currentWeek, 'w')}
                            </span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={goToNextWeek}
                        className="rounded-full h-9 px-3 hover:bg-muted hover:shadow-sm transition-all"
                    >
                        <span className="hidden sm:inline mr-1.5 font-medium">Next</span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Calendar Grid with scroll - flex-1 to fill remaining space */}
                <div className="bg-card rounded-xl border overflow-hidden relative flex-1 min-h-0">
                    {/* Right fade gradient for scroll hint */}
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none md:hidden" />
                    <div className="overflow-auto h-full">
                        {calendarLoading ? (
                            <ZoomCalendarSkeleton />
                        ) : (
                            <div
                                ref={calendarRef}
                                className="min-w-[800px] relative outline-none"
                                tabIndex={0}
                                onKeyDown={handleKeyDown}
                                role="grid"
                                aria-label="Zoom booking calendar grid"
                                onFocus={() => {
                                    if (!focusedCell) {
                                        setFocusedCell({ dayIndex: 0, timeIndex: 0 });
                                    }
                                }}
                            >
                                {/* Grid container */}
                                <div
                                    className="grid"
                                    style={{
                                        gridTemplateColumns: '95px repeat(5, 1fr)',
                                        gridTemplateRows: `auto repeat(${timeLabels.length}, ${SLOT_HEIGHT}px)`,
                                    }}
                                >
                                    {/* Header Row - Time column */}
                                    <div className="bg-muted/50 p-2 border-b border-r text-center text-sm font-medium sticky left-0 z-10">
                                        Time
                                    </div>

                                    {/* P1: Header Row - Day columns with Today highlighting */}
                                    {calendar?.map((day) => {
                                        const dayIsToday = isToday(new Date(day.date));
                                        return (
                                            <div
                                                key={day.date}
                                                className={cn(
                                                    'p-3 border-b text-center transition-colors',
                                                    dayIsToday
                                                        ? 'bg-blue-500/10 border-b-2 border-b-blue-500'
                                                        : 'bg-muted/50',
                                                    !day.isWorkingDay && 'bg-muted/80 opacity-60'
                                                )}
                                            >
                                                <div className={cn(
                                                    'text-sm font-medium',
                                                    dayIsToday && 'text-blue-600 dark:text-blue-400'
                                                )}>
                                                    {format(new Date(day.date), 'EEEE', { locale: idLocale })}
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className={cn(
                                                        'text-lg font-bold',
                                                        dayIsToday && 'text-blue-600 dark:text-blue-400'
                                                    )}>
                                                        {format(new Date(day.date), 'd')}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(day.date), 'MMM')}
                                                    </span>
                                                    {dayIsToday && (
                                                        <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                                            TODAY
                                                        </span>
                                                    )}
                                                </div>
                                                {day.isBlocked && (
                                                    <span className="text-[10px] text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                        Blocked
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* P1+P3: Time Slots with hour emphasis and separators */}
                                    {timeLabels.map((time, timeIndex) => {
                                        const { main: displayTime, isHour } = formatTimeDisplay(time);
                                        const hourStart = isHourStart(time);
                                        return (
                                            <>
                                                {/* P1: Time Label with hour emphasis */}
                                                <div
                                                    key={`time-${time}`}
                                                    className={cn(
                                                        'p-1.5 border-r text-center flex items-center justify-center sticky left-0 z-10 transition-colors',
                                                        hourStart
                                                            ? 'bg-muted/40 border-b-2 border-b-muted-foreground/20 text-xs font-semibold text-foreground'
                                                            : 'bg-muted/20 border-b text-[11px] text-muted-foreground'
                                                    )}
                                                >
                                                    {isHour ? displayTime : <span className="opacity-60">{displayTime}</span>}
                                                </div>

                                                {/* Day cells with P1 today highlighting and P3 hour borders */}
                                                {calendar?.map((day, dayIndex) => {
                                                    const slot = day.slots[timeIndex];
                                                    const dayIsToday = isToday(new Date(day.date));
                                                    const hasBookingStart = slot?.booking && slot.time === slot.booking.id ? false :
                                                        day.slots.findIndex(s => s.booking?.id === slot?.booking?.id) === timeIndex;

                                                    return (
                                                        <div
                                                            key={`${day.date}-${time}`}
                                                            className={cn(
                                                                'relative group',
                                                                // P3: Hour separator border
                                                                hourStart ? 'border-b-2 border-b-muted/60' : 'border-b',
                                                                'border-r',
                                                                // P1: Today column subtle highlight
                                                                dayIsToday && 'bg-blue-500/5',
                                                                // Status-based styling
                                                                slot ? SLOT_BG[slot.status as keyof typeof SLOT_BG] : 'bg-gray-500/5',
                                                                // P4: Keyboard focus styling
                                                                focusedCell?.dayIndex === dayIndex && focusedCell?.timeIndex === timeIndex &&
                                                                'ring-2 ring-inset ring-blue-500 z-10'
                                                            )}
                                                            onClick={() => handleSlotClick(day, timeIndex)}
                                                            title={slot?.status === 'available' ? 'Click to book (Enter)' : undefined}
                                                            role="gridcell"
                                                            aria-selected={focusedCell?.dayIndex === dayIndex && focusedCell?.timeIndex === timeIndex}
                                                        >
                                                            {/* P2: Empty slot hover hint */}
                                                            {slot?.status === 'available' && (
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Plus className="h-4 w-4 text-emerald-500/60" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        );
                                    })}
                                </div>

                                {/* Overlay for bookings (positioned absolutely) */}
                                <div
                                    className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '95px repeat(5, 1fr)',
                                        gridTemplateRows: `auto repeat(${timeLabels.length}, ${SLOT_HEIGHT}px)`,
                                    }}
                                >
                                    {/* Skip header row */}
                                    <div className="col-span-6" style={{ height: 'auto' }} />

                                    {calendar?.map((day, dayIndex) => {
                                        const bookings = processBookingsForDay(day);

                                        return bookings.map((booking) => (
                                            <div
                                                key={booking.id}
                                                title={`${booking.title}\n${booking.startTime} - ${booking.endTime} (${booking.durationMinutes} min)\nBooked by: ${booking.bookedBy}\n🔗 Click to view Zoom link`}
                                                className={cn(
                                                    // P3: Enhanced elevation with scale transform
                                                    'pointer-events-auto rounded-xl cursor-pointer transition-all duration-200',
                                                    'hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-0.5 hover:z-20',
                                                    'shadow-lg ring-1 ring-black/5 overflow-hidden',
                                                    booking.isMyBooking
                                                        ? 'bg-gradient-to-br from-blue-500 via-blue-500 to-blue-600 text-white border-l-4 border-blue-300 shadow-blue-500/25'
                                                        : 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-amber-900 border-l-4 border-amber-200 shadow-amber-400/25'
                                                )}
                                                style={{
                                                    gridColumn: dayIndex + 2,
                                                    gridRow: `${booking.rowStart} / span ${booking.rowSpan}`,
                                                    margin: '2px 4px',
                                                    minWidth: 0,
                                                }}
                                                onClick={() => handleBookingClick(booking)}
                                            >
                                                <div className="p-2 h-full flex flex-col min-w-0">
                                                    <div className="font-bold text-xs truncate flex items-center gap-1">
                                                        <Video className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{booking.title}</span>
                                                    </div>
                                                    <div className="text-[11px] font-medium opacity-90">
                                                        {booking.startTime} - {booking.endTime}
                                                    </div>
                                                    {booking.rowSpan >= 2 && (
                                                        <div className="text-[11px] mt-auto flex items-center gap-1 opacity-80">
                                                            <User className="h-2.5 w-2.5 shrink-0" />
                                                            <span className="truncate">Booked by: {booking.bookedBy}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ));
                                    })}
                                </div>

                                {/* P4: Current Time Indicator (Red Line) */}
                                {getCurrentTimePosition && isToday(new Date()) && (
                                    <div
                                        className="absolute left-[95px] right-0 z-30 pointer-events-none flex items-center"
                                        style={{ top: `${getCurrentTimePosition.pixelOffset}px` }}
                                    >
                                        {/* Pulsing dot */}
                                        <div className="w-3 h-3 -ml-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
                                        {/* Red line */}
                                        <div className="flex-1 h-0.5 bg-gradient-to-r from-red-500 to-red-400 shadow-sm" />
                                        {/* Current time label */}
                                        <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-l-md shadow-lg">
                                            {format(currentTime, 'HH:mm')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Right Panel - Upcoming Meetings (360px) */}
            <aside className="w-[360px] shrink-0 hidden xl:block">
                <div className="sticky top-6">
                    <UpcomingMeetingsPanel maxItems={8} className="h-[calc(100vh-140px)] overflow-y-auto" />
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
