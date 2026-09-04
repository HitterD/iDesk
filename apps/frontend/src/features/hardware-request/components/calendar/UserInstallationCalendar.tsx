import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO, isAfter, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    CalendarDays,
    RotateCw,
    TrendingUp,
    Clock,
    AlertCircle,
    CalendarX2,
    CheckCircle2,
    MapPin,
    User,
    ChevronRight,
    ArrowRight,
    ListFilter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';
import { EventChipMedium } from './EventChipMedium';
import { EventQuickPreviewModal } from './EventQuickPreviewModal';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import type { CalendarEventData } from '../../types/calendar.types';
import { useMySchedules } from '../../hooks/useMySchedules';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { cn } from '@/lib/utils';

export function UserInstallationCalendar() {
    const basePath = useHardwareBasePath();
    const [sidebarTab, setSidebarTab] = useState<'upcoming' | 'action_required'>('upcoming');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null);

    const [range, setRange] = useState(() => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { from: first.toISOString(), to: last.toISOString() };
    });

    const { events, isLoading, refetch, isFetching } = useMySchedules(range);

    const fcEvents = useMemo(
        () =>
            events.map((e: CalendarEventData) => ({
                id: e.scheduleId,
                title: `${e.requestNumber} · ${e.siteName}`,
                start: e.scheduledAt,
                end: e.endsAt ?? undefined,
                editable: false,
                extendedProps: e,
            })),
        [events],
    );

    const upcomingEvents = useMemo(() => {
        const now = new Date();
        return events
            .filter((e) => isAfter(parseISO(e.scheduledAt), now) && e.status !== 'CANCELLED')
            .sort((a, b) => parseISO(a.scheduledAt).getTime() - parseISO(b.scheduledAt).getTime())
            .slice(0, 8);
    }, [events]);

    const actionRequiredEvents = useMemo(
        () =>
            events.filter(
                (e) =>
                    e.status === 'PROPOSED_AWAITING_USER' ||
                    (e.status === 'DONE' && e.requestStatus === 'AWAITING_USER_CONFIRMATION'),
            ),
        [events],
    );

    const userVisibleStatuses: { key: InstallStatus | 'AWAITING_CONFIRM'; label: string }[] = [
        { key: 'PROPOSED_AWAITING_USER', label: 'Pilih Slot' },
        { key: 'CONFIRMED', label: 'Terjadwal' },
        { key: 'IN_PROGRESS', label: 'Sedang Instalasi' },
        { key: 'AWAITING_CONFIRM', label: 'Konfirmasi Anda' },
        { key: 'DONE', label: 'Selesai' },
    ];

    const formatRelativeDate = (dateStr: string) => {
        const d = parseISO(dateStr);
        if (isToday(d)) return 'Hari Ini';
        if (isTomorrow(d)) return 'Besok';
        return format(d, 'dd MMM', { locale: idLocale });
    };

    return (
        <FeatureErrorBoundary>
            <div className="space-y-6 animate-fade-in-up pb-12">
                {/* ── STYLED FULLCALENDAR OVERRIDES ── */}
                <style>{`
                    .fc-bento {
                        --fc-border-color: hsl(var(--border) / 0.7);
                        --fc-today-bg-color: hsl(var(--primary) / 0.04);
                    }
                    .fc-bento .fc-col-header-cell-cushion {
                        font-size: 0.75rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: hsl(var(--muted-foreground));
                        padding: 10px 4px;
                    }
                    .fc-bento .fc-daygrid-day-number {
                        font-size: 0.8rem;
                        font-weight: 600;
                        color: hsl(var(--foreground));
                        padding: 6px 8px;
                    }
                    .fc-bento .fc-day-today .fc-daygrid-day-number {
                        background-color: hsl(var(--primary));
                        color: hsl(var(--primary-foreground));
                        border-radius: 9999px;
                        width: 22px;
                        height: 22px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        margin: 4px;
                        padding: 0;
                        font-size: 0.75rem;
                        font-weight: 700;
                    }
                    .fc-bento .fc-button-primary {
                        background-color: hsl(var(--card)) !important;
                        border-color: hsl(var(--border)) !important;
                        color: hsl(var(--foreground)) !important;
                        border-radius: 0.75rem !important;
                        font-weight: 600 !important;
                        font-size: 0.8rem !important;
                        padding: 0.45rem 0.85rem !important;
                        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04) !important;
                        transition: all 0.15s ease !important;
                        cursor: pointer !important;
                    }
                    .fc-bento .fc-button-primary:hover {
                        background-color: hsl(var(--muted)) !important;
                        border-color: hsl(var(--border)) !important;
                        color: hsl(var(--foreground)) !important;
                    }
                    .fc-bento .fc-button-primary:not(:disabled).fc-button-active,
                    .fc-bento .fc-button-primary:not(:disabled):active {
                        background-color: hsl(var(--primary)) !important;
                        border-color: hsl(var(--primary)) !important;
                        color: hsl(var(--primary-foreground)) !important;
                    }
                    .fc-bento .fc-button-primary:disabled {
                        opacity: 0.4 !important;
                        cursor: not-allowed !important;
                    }
                    .fc-bento .fc-toolbar-title {
                        font-size: 1.15rem !important;
                        font-weight: 800 !important;
                        color: hsl(var(--foreground)) !important;
                        letter-spacing: -0.02em !important;
                    }
                    .fc-bento .fc-daygrid-day-events {
                        margin: 2px 3px !important;
                    }
                    .fc-bento .fc-daygrid-event-harness {
                        margin-bottom: 3px !important;
                    }
                `}</style>

                {/* ── HEADER AREA ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <CalendarDays className="size-6 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                    Jadwal Instalasi
                                </h1>
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Live
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1">
                                Pantau jadwal pemasangan perangkat, konfirmasi slot, dan monitoring teknisi
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="px-3.5 py-2 min-h-[38px] bg-card border border-border hover:bg-muted/50 rounded-xl text-xs sm:text-sm font-semibold text-foreground transition-colors shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                            title="Segarkan kalender"
                        >
                            <RotateCw
                                className={cn('size-4', (isLoading || isFetching) && 'animate-spin text-primary')}
                                aria-hidden="true"
                            />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* ── BENTO MINI KPI STATS CARDS ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                    <StatsCard
                        icon={TrendingUp}
                        label="Total Terjadwal"
                        value={events.length}
                        color="text-primary dark:text-blue-400"
                        bgColor="bg-primary/10 dark:bg-primary/20"
                        animationIndex={0}
                        isLoading={isLoading}
                    />
                    <StatsCard
                        icon={Clock}
                        label="Jadwal Mendatang"
                        value={upcomingEvents.length}
                        color="text-[hsl(var(--info-500))]"
                        bgColor="bg-[hsl(var(--info-500))]/10"
                        animationIndex={1}
                        onClick={() => setSidebarTab('upcoming')}
                        isActive={sidebarTab === 'upcoming'}
                        isLoading={isLoading}
                    />
                    <StatsCard
                        icon={AlertCircle}
                        label="Perlu Tindakan"
                        value={actionRequiredEvents.length}
                        color={actionRequiredEvents.length > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground'}
                        bgColor={actionRequiredEvents.length > 0 ? 'bg-cyan-500/10' : 'bg-muted/50'}
                        animationIndex={2}
                        onClick={() => setSidebarTab('action_required')}
                        isActive={sidebarTab === 'action_required'}
                        isLoading={isLoading}
                    />
                </div>

                {/* ── MAIN CONTENT: CALENDAR + AGENDA SIDEBAR ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left/Main Column: Calendar View */}
                    <div className="lg:col-span-8 xl:col-span-9 bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="size-4 text-primary" />
                                <h2 className="text-sm sm:text-base font-bold text-foreground">
                                    Kalender Pemasangan
                                </h2>
                            </div>
                            {isLoading && (
                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                    <RotateCw className="size-3 animate-spin text-primary" />
                                    Memuat jadwal...
                                </span>
                            )}
                        </div>

                        {!isLoading && events.length === 0 ? (
                            <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                                <CalendarX2 className="mb-3 size-10 text-muted-foreground/60" />
                                <h3 className="text-sm font-bold text-foreground">Belum Ada Jadwal Instalasi</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                    Belum ada jadwal pemasangan hardware yang terdaftar di rentang bulan ini.
                                </p>
                            </div>
                        ) : (
                            <div className="fc-bento overflow-x-auto">
                                <FullCalendar
                                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    headerToolbar={{
                                        left: 'prev,next today',
                                        center: 'title',
                                        right: 'dayGridMonth,timeGridWeek',
                                    }}
                                    events={fcEvents}
                                    eventContent={(info) => (
                                        <EventChipMedium event={info.event.extendedProps as CalendarEventData} />
                                    )}
                                    eventClick={(info) => {
                                        info.jsEvent.preventDefault();
                                        const e = info.event.extendedProps as CalendarEventData;
                                        setSelectedEvent(e);
                                    }}
                                    datesSet={(arg) => setRange({ from: arg.startStr, to: arg.endStr })}
                                    height="auto"
                                />
                            </div>
                        )}

                        {/* Status Legend Pills */}
                        <div className="border-t border-border pt-4 mt-2">
                            <div className="flex items-center gap-2 mb-2.5">
                                <ListFilter className="size-3.5 text-muted-foreground" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Keterangan Status
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {userVisibleStatuses.map(({ key, label }) => {
                                    const chip =
                                        key === 'AWAITING_CONFIRM'
                                            ? { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-300 dark:border-cyan-800', dot: 'bg-cyan-500', text: 'text-cyan-900 dark:text-cyan-300' }
                                            : INSTALL_STATUS_CHIP[key];
                                    return (
                                        <div
                                            key={key}
                                            className={cn(
                                                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-2xs',
                                                chip.bg,
                                                chip.border,
                                                chip.text
                                            )}
                                        >
                                            <span className={cn('size-1.5 rounded-full shrink-0', chip.dot)} />
                                            <span>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Interactive Agenda Sidebar */}
                    <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col gap-3.5">
                            {/* Tabs Switcher */}
                            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border">
                                <button
                                    type="button"
                                    onClick={() => setSidebarTab('upcoming')}
                                    className={cn(
                                        'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5',
                                        sidebarTab === 'upcoming'
                                            ? 'bg-card text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span>Mendatang</span>
                                    {upcomingEvents.length > 0 && (
                                        <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-black inline-flex items-center justify-center">
                                            {upcomingEvents.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSidebarTab('action_required')}
                                    className={cn(
                                        'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5',
                                        sidebarTab === 'action_required'
                                            ? 'bg-card text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span>Perlu Aksi</span>
                                    {actionRequiredEvents.length > 0 && (
                                        <span className="size-4 rounded-full bg-cyan-600 text-white text-[10px] font-black inline-flex items-center justify-center animate-pulse">
                                            {actionRequiredEvents.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* List of items for active tab */}
                            {sidebarTab === 'upcoming' ? (
                                <div className="flex flex-col gap-2.5 max-h-[560px] overflow-y-auto pr-0.5">
                                    {upcomingEvents.length > 0 ? (
                                        upcomingEvents.map((e) => {
                                            const isAwaitingConfirm =
                                                e.status === 'DONE' && e.requestStatus === 'AWAITING_USER_CONFIRMATION';
                                            const chip = isAwaitingConfirm
                                                ? { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-300 dark:border-cyan-800', dot: 'bg-cyan-500', text: 'text-cyan-900 dark:text-cyan-300', badge: 'KONFIRMASI' }
                                                : INSTALL_STATUS_CHIP[e.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;

                                            return (
                                                <div
                                                    key={e.scheduleId}
                                                    onClick={() => setSelectedEvent(e)}
                                                    className="group p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs relative overflow-hidden"
                                                >
                                                    {/* Accent Left Stripe */}
                                                    <div className={cn('absolute left-0 top-0 bottom-0 w-1', chip.dot)} />

                                                    <div className="flex items-start justify-between gap-1.5 pl-1.5 mb-1.5">
                                                        <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                                                            {e.requestNumber}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                'text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase',
                                                                chip.bg,
                                                                chip.border,
                                                                chip.text
                                                            )}
                                                        >
                                                            {chip.badge}
                                                        </span>
                                                    </div>

                                                    <div className="pl-1.5 space-y-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <MapPin className="size-3 text-slate-400 shrink-0" />
                                                            <span className="font-medium text-foreground truncate">{e.siteName || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                                                            <span className="font-semibold text-primary">
                                                                {formatRelativeDate(e.scheduledAt)}, {format(parseISO(e.scheduledAt), 'HH:mm')}
                                                            </span>
                                                            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                                                                {e.technicianName || 'Teknisi ICT'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border p-4">
                                            Tidak ada jadwal instalasi mendatang.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5 max-h-[560px] overflow-y-auto pr-0.5">
                                    {actionRequiredEvents.length > 0 ? (
                                        actionRequiredEvents.map((e) => {
                                            const isConfirm =
                                                e.status === 'DONE' && e.requestStatus === 'AWAITING_USER_CONFIRMATION';

                                            return (
                                                <div
                                                    key={e.scheduleId}
                                                    className="p-3.5 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/20 space-y-2.5 shadow-2xs"
                                                >
                                                    <div className="flex items-start justify-between gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-cyan-950 dark:text-cyan-200">
                                                            {e.requestNumber}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-600 text-white animate-pulse">
                                                            {isConfirm ? 'KONFIRMASI' : 'PILIH SLOT'}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-cyan-900 dark:text-cyan-300 font-medium">
                                                        {isConfirm
                                                            ? 'Teknisi telah menyelesaikan pemasangan. Harap konfirmasi penerimaan.'
                                                            : 'Slot jadwal telah diajukan. Silakan pilih slot yang sesuai.'}
                                                    </p>

                                                    <Link
                                                        to={`${basePath}/${e.requestId}`}
                                                        className="inline-flex items-center justify-between w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-800 text-xs font-bold text-cyan-900 dark:text-cyan-200 hover:bg-cyan-100/50 transition-colors"
                                                    >
                                                        <span>{isConfirm ? 'Konfirmasi Sekarang' : 'Pilih Slot Waktu'}</span>
                                                        <ArrowRight className="size-3.5" />
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border p-4">
                                            <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1.5" />
                                            <span>Semua jadwal terkendali, tidak ada aksi yang diperlukan.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── QUICK PREVIEW MODAL ── */}
                <EventQuickPreviewModal
                    event={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                />
            </div>
        </FeatureErrorBoundary>
    );
}