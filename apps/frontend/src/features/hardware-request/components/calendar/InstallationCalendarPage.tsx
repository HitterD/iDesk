import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays, endOfWeek, format, isSameDay, isToday, parseISO, startOfWeek } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarDays, CalendarX, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { DASH_COLORS, DashBub, DashEmpty, DashPanel, DashSkeletonList, cssVars } from '@/features/dashboard/components/DashboardParts';
import { HBars } from '../dashboard/HBars';
import { INSTALL_STATUS_META, type InstallStatus } from '../../utils/status.util';
import { useInstallationCalendar } from '../../hooks/useInstallationCalendar';
import { usePermissions } from '../../hooks/usePermissions';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { TechnicianPop } from './TechnicianFilter';
import { StatsStrip } from './StatsStrip';
import { EventChipMedium } from './EventChipMedium';
import { AgendaBottomDrawer } from './AgendaBottomDrawer';
import { RescheduleConfirmModal } from './RescheduleConfirmModal';
import { UserInstallationCalendar } from './UserInstallationCalendar';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';
import { fetchMyTodaySchedules, fetchUnscheduledRequests } from '../../api/installation.api';
import type { CalendarEventData } from '../../types/calendar.types';
import { cn } from '@/lib/utils';

/** Drag-to-reschedule is off until it goes through the slot-proposal flow. */
const CALENDAR_DRAG_ENABLED = false;

type TodaySchedule = { id: string; requestId: string; scheduledAt: string; siteName: string; requestNumber: string };
type UnscheduledRequest = { id: string; requestNumber: string; siteName: string; createdAt?: string };

const OVERDUE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Right column (mockup "Antrean" + production "Hari ini"): today's own schedules and unscheduled requests. */
function SidebarAgenda() {
  const basePath = useHardwareBasePath();
  const { data: todaySchedules = [], isLoading: loadingToday } = useQuery<TodaySchedule[]>({
    queryKey: ['hardware-requests', 'my-today'],
    queryFn: fetchMyTodaySchedules,
    staleTime: 30_000,
  });
  const { data: unscheduled = [], isLoading: loadingUnscheduled } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });
  const now = Date.now();

  return (
    <>
      <DashPanel title={<>Jadwal Saya Hari Ini <small>{todaySchedules.length}</small></>} label="Jadwal saya hari ini">
        {loadingToday ? <DashSkeletonList rows={2} /> : todaySchedules.length === 0 ? (
          <DashEmpty>Tidak ada jadwal hari ini.</DashEmpty>
        ) : (
          <div className="dash-list">
            {todaySchedules.map((s) => (
              <Link key={s.id} to={`${basePath}/${s.requestId}`} className="dash-li">
                <span className="dash-ico" style={cssVars({ '--c': DASH_COLORS.green })}><CalendarCheck aria-hidden="true" /></span>
                <div className="grow1"><b>{s.siteName}</b><small className="mono">{s.requestNumber}</small></div>
                <span className="dash-date">{format(parseISO(s.scheduledAt), 'HH.mm')}</span>
              </Link>
            ))}
          </div>
        )}
      </DashPanel>
      <DashPanel title={<>Antrean <small>{unscheduled.length}</small></>} label="Antrean belum dijadwalkan">
        {loadingUnscheduled ? <DashSkeletonList rows={2} /> : unscheduled.length === 0 ? (
          <DashEmpty>Semua request terjadwal.</DashEmpty>
        ) : (
          <div className="dash-list">
            {unscheduled.map((r) => {
              const overdue = r.createdAt ? (now - new Date(r.createdAt).getTime()) / DAY_MS > OVERDUE_DAYS : false;
              return (
                <Link key={r.id} to={`${basePath}/${r.id}`} className="dash-li">
                  <span className="dash-ico" style={cssVars({ '--c': overdue ? DASH_COLORS.red : DASH_COLORS.gray })}><CalendarX aria-hidden="true" /></span>
                  <div className="grow1"><b>{r.siteName}</b><small className="mono">{r.requestNumber} · belum dijadwalkan</small></div>
                  {overdue && <DashBub color={DASH_COLORS.red} ink={DASH_COLORS.inkRed}>Overdue</DashBub>}
                </Link>
              );
            })}
          </div>
        )}
      </DashPanel>
    </>
  );
}

type CalendarMode = 'agenda' | 'calendar';
const MODE_OPTIONS = [
  { value: 'agenda' as const, label: 'Agenda', icon: List },
  { value: 'calendar' as const, label: 'Kalender', icon: CalendarDays },
];
const WEEK_OPTS = { weekStartsOn: 1 as const };
const WEEK_DAYS = 7;

/** Mockup dot hues per installation status. */
const INSTALL_DOT: Partial<Record<InstallStatus, string>> = {
  PROPOSED: DASH_COLORS.blue, PROPOSED_AWAITING_USER: DASH_COLORS.blue, CONFIRMED: DASH_COLORS.accent,
  IN_PROGRESS: 'var(--dash-teal)', DONE: DASH_COLORS.green, RESCHEDULED: DASH_COLORS.orange,
  RESCHEDULE_REQUESTED: DASH_COLORS.orange, CANCELLED: DASH_COLORS.gray,
};

/** Week agenda (mockup hardware.html ?tab=calendar): one row per day with its installation slots. */
function WeekAgenda({ weekStart, events, onOpen }: { weekStart: Date; events: CalendarEventData[]; onOpen: (e: CalendarEventData) => void }) {
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(weekStart, i));
  const withEvents = days
    .map((day) => ({ day, items: events.filter((e) => isSameDay(parseISO(e.scheduledAt), day)).sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt)) }))
    .filter((d) => d.items.length > 0);
  if (withEvents.length === 0) return <DashEmpty icon={<CalendarDays aria-hidden="true" />}>Belum ada jadwal instalasi minggu ini.</DashEmpty>;
  return (
    <div>
      {withEvents.map(({ day, items }) => {
        const today = isToday(day);
        return (
          <div key={day.toISOString()} className={cn('res-agenda-day', today && 'is-today')}>
            <div><b>{format(day, 'd')}</b><small>{format(day, 'EEE', { locale: idLocale })}{today ? ' · hari ini' : ''}</small></div>
            <div className="dash-list">
              {items.map((e) => {
                const meta = INSTALL_STATUS_META[e.status as InstallStatus];
                return (
                  <button key={e.scheduleId} type="button" className="dash-li" onClick={() => onOpen(e)}>
                    <span className="dash-pdot" style={cssVars({ '--c': INSTALL_DOT[e.status as InstallStatus] ?? DASH_COLORS.gray })} />
                    <div className="grow1">
                      <b>{e.siteName}{e.recipientName ? ` · ${e.recipientName}` : ''}</b>
                      <small className="mono">{e.requestNumber} · {e.technicianName || 'Belum ditentukan'}{meta ? ` · ${meta.label}` : ''}</small>
                    </div>
                    <span className="dash-date">{format(parseISO(e.scheduledAt), 'HH.mm')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InstallationCalendarPage() {
  const { isIctRole, isIctStaff } = usePermissions();
  const [mode, setMode] = useState<CalendarMode>('agenda');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), WEEK_OPTS));
  const [fcRange, setFcRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    };
  });
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDate, setDrawerDate] = useState<Date | null>(null);
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    requestId: string;
    requestNumber: string;
    from: string;
    to: string;
    revert: () => void;
  } | null>(null);

  const range = mode === 'agenda'
    ? { from: weekStart.toISOString(), to: endOfWeek(weekStart, WEEK_OPTS).toISOString() }
    : fcRange;
  const { events, reschedule } = useInstallationCalendar({ ...range, technicianIds });

  const { data: unscheduled = [] } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const today = new Date();
    return {
      scheduled: events.length,
      today: events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), today)).length,
      rescheduleRequested: events.filter((e: CalendarEventData) => e.status === 'RESCHEDULE_REQUESTED').length,
    };
  }, [events]);

  const weekLoad = useMemo(() => Array.from({ length: WEEK_DAYS }, (_, i) => {
    const day = addDays(weekStart, i);
    return {
      key: day.toISOString(),
      label: format(day, 'EEE d', { locale: idLocale }),
      value: events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), day)).length,
      color: isToday(day) ? DASH_COLORS.accent : undefined,
    };
  }), [events, weekStart]);

  const drawerEvents = useMemo(
    () =>
      drawerDate
        ? events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), drawerDate))
        : [],
    [events, drawerDate]
  );

  const fcEvents = useMemo(
    () =>
      events.map((e: CalendarEventData) => ({
        id: e.scheduleId,
        title: e.requestNumber,
        start: e.scheduledAt,
        end: e.endsAt ?? undefined,
        // Dragging used the legacy reschedule endpoint, which always rejected the payload.
        // Move a slot from the request detail page ("Usulkan Jadwal Baru") instead.
        editable: CALENDAR_DRAG_ENABLED && isIctStaff,
        extendedProps: e,
      })),
    [events, isIctStaff]
  );

  if (!isIctRole) return <UserInstallationCalendar />;

  const openDrawer = (date: Date, eventId: string | null) => {
    setDrawerDate(date);
    setDrawerEventId(eventId);
    setDrawerOpen(true);
  };
  const weekLabel = `${format(weekStart, 'd')} – ${format(endOfWeek(weekStart, WEEK_OPTS), 'd MMM yyyy', { locale: idLocale })}`;

  return (
    <FeatureErrorBoundary>
      <StatsStrip
        scheduled={stats.scheduled}
        today={stats.today}
        unscheduled={unscheduled.length}
        rescheduleRequested={stats.rescheduleRequested}
      />

      <div className="res-grid-main">
        <section className="dash-panel" aria-label="Jadwal instalasi">
          <h3 className="flex-wrap">
            Jadwal Instalasi <small>Kalender operasional hardware ICT{mode === 'agenda' ? ` · ${weekLabel}` : ''}</small>
            <span className="res-panel-tools">
              {mode === 'agenda' && (
                <span className="res-nav">
                  <button type="button" className="res-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -WEEK_DAYS))} aria-label="Minggu sebelumnya"><ChevronLeft aria-hidden="true" /></button>
                  <button type="button" className="idesk-btn is-ghost" onClick={() => setWeekStart(startOfWeek(new Date(), WEEK_OPTS))}>Hari ini</button>
                  <button type="button" className="res-icon-btn" onClick={() => setWeekStart((w) => addDays(w, WEEK_DAYS))} aria-label="Minggu berikutnya"><ChevronRight aria-hidden="true" /></button>
                </span>
              )}
              <TechnicianPop selectedIds={technicianIds} onChange={setTechnicianIds} />
              <SegmentedControl aria-label="Tampilan jadwal" className="dash-seg is-sm" options={MODE_OPTIONS} value={mode} onValueChange={setMode} />
            </span>
          </h3>
          {mode === 'agenda' ? (
            <WeekAgenda weekStart={weekStart} events={events} onOpen={(e) => openDrawer(parseISO(e.scheduledAt), e.scheduleId)} />
          ) : (
            <div className="res-fc fc-staff">
              <style>{FC_STYLES}</style>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                buttonText={{ today: 'Hari Ini', month: 'Bulan', week: 'Minggu', day: 'Hari' }}
                events={fcEvents}
                dayMaxEvents={3}
                moreLinkContent={(args) => `+${args.num} lagi`}
                eventContent={(info) => <EventChipMedium event={info.event.extendedProps as CalendarEventData} />}
                eventClick={(info) => openDrawer(info.event.start ?? new Date(), info.event.id)}
                dateClick={(info) => openDrawer(info.date, null)}
                editable={CALENDAR_DRAG_ENABLED && isIctStaff}
                eventDrop={(info) => {
                  const e = info.event.extendedProps as CalendarEventData;
                  setPendingReschedule({
                    requestId: e.requestId,
                    requestNumber: e.requestNumber,
                    from: e.scheduledAt,
                    to: info.event.start?.toISOString() ?? e.scheduledAt,
                    revert: info.revert,
                  });
                }}
                datesSet={(info) => setFcRange({ from: info.startStr, to: info.endStr })}
                height="auto"
              />
            </div>
          )}
        </section>

        <div className="res-stack">
          {mode === 'agenda' && (
            <DashPanel title="Proyeksi 7 hari" label="Proyeksi 7 hari">
              <HBars items={weekLoad} />
            </DashPanel>
          )}
          <SidebarAgenda />
        </div>
      </div>

      <AgendaBottomDrawer
        open={drawerOpen}
        date={drawerDate}
        events={drawerEvents}
        selectedEventId={drawerEventId}
        onSelectEvent={setDrawerEventId}
        onClose={() => setDrawerOpen(false)}
      />

      <RescheduleConfirmModal
        open={!!pendingReschedule}
        from={pendingReschedule?.from ?? ''}
        to={pendingReschedule?.to ?? ''}
        requestNumber={pendingReschedule?.requestNumber ?? ''}
        onCancel={() => {
          pendingReschedule?.revert();
          setPendingReschedule(null);
        }}
        onConfirm={async (reason) => {
          if (!pendingReschedule) return;
          try {
            await reschedule.mutateAsync({
              requestId: pendingReschedule.requestId,
              payload: { proposedAt: pendingReschedule.to, reason },
            });
          } catch {
            pendingReschedule.revert();
          } finally {
            setPendingReschedule(null);
          }
        }}
      />
    </FeatureErrorBoundary>
  );
}

const FC_STYLES = `
  .fc-staff { --fc-border-color: var(--td-line); --fc-today-bg-color: hsl(var(--idesk-sapphire) / .05); --fc-page-bg-color: transparent; --fc-neutral-bg-color: var(--td-fill); }
  .fc-staff .fc-scrollgrid { border-radius: 14px; overflow: hidden; }
  .fc-staff .fc-col-header-cell-cushion { font-size: 11.5px; font-weight: 500; color: var(--td-text-3); padding: 8px 4px; }
  .fc-staff .fc-daygrid-day-number { font-size: 12px; font-weight: 600; color: hsl(var(--idesk-text)); padding: 2px 6px; border-radius: 8px; }
  .fc-staff .fc-day-today .fc-daygrid-day-number { background: hsl(var(--idesk-sapphire)); color: #fff; }
  .fc-staff .fc-button-primary { background: hsl(var(--idesk-surface)) !important; border: 0 !important; color: hsl(var(--idesk-text)) !important; border-radius: 10px !important; font-weight: 550 !important; font-size: 12.5px !important; padding: .35rem .75rem !important; box-shadow: var(--dash-shadow-1) !important; }
  .fc-staff .fc-button-primary:not(:disabled).fc-button-active { background: var(--td-accent-soft) !important; color: hsl(var(--idesk-sapphire)) !important; }
  .fc-staff .fc-toolbar-title { font: 650 15px var(--font-display) !important; color: hsl(var(--idesk-text)) !important; }
  .fc-staff .fc-more-link { font-size: 11.5px !important; font-weight: 600 !important; color: hsl(var(--idesk-sapphire)) !important; }
  .fc-staff .fc-popover { background: hsl(var(--idesk-surface)) !important; border: 0 !important; border-radius: 14px !important; box-shadow: var(--dash-shadow-2) !important; overflow: hidden; z-index: 50 !important; }
`;
