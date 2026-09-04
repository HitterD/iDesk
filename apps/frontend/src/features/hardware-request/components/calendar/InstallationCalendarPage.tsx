import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, isSameDay, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, AlertTriangle } from 'lucide-react';
import { useInstallationCalendar } from '../../hooks/useInstallationCalendar';
import { usePermissions } from '../../hooks/usePermissions';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { TechnicianFilter } from './TechnicianFilter';
import { StatsStrip } from './StatsStrip';
import { EventChipMedium } from './EventChipMedium';
import { AgendaBottomDrawer } from './AgendaBottomDrawer';
import { RescheduleConfirmModal } from './RescheduleConfirmModal';
import { UserInstallationCalendar } from './UserInstallationCalendar';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';
import { fetchMyTodaySchedules, fetchUnscheduledRequests } from '../../api/installation.api';
import type { CalendarEventData } from '../../types/calendar.types';
import { cn } from '@/lib/utils';

type TodaySchedule = { id: string; requestId: string; scheduledAt: string; siteName: string; requestNumber: string };
type UnscheduledRequest = { id: string; requestNumber: string; siteName: string; createdAt?: string };

const OVERDUE_DAYS = 7;

function SidebarAgendaTabs() {
  const basePath = useHardwareBasePath();
  const [activeTab, setActiveTab] = useState<'today' | 'unscheduled'>('today');

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

  const now = new Date();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-2xs flex flex-col">
      {/* Segment Switcher */}
      <div className="p-1.5 bg-muted/40 border-b border-border/80 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeTab === 'today'
              ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Clock className="size-3.5" />
          <span>Hari Ini</span>
          {todaySchedules.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {todaySchedules.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unscheduled')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeTab === 'unscheduled'
              ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <AlertTriangle className="size-3.5" />
          <span>Antrean</span>
          {unscheduled.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {unscheduled.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-3">
        {activeTab === 'today' ? (
          loadingToday ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-muted/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : todaySchedules.length > 0 ? (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
              {todaySchedules.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`${basePath}/${s.requestId}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-emerald-500/10 border border-border/70 hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                        {s.siteName}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {s.requestNumber}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 tabular-nums shrink-0">
                      {format(parseISO(s.scheduledAt), 'HH:mm')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-6 text-muted-foreground space-y-1">
              <Clock className="size-6 mx-auto opacity-30 text-emerald-500" />
              <p className="text-xs font-semibold">Tidak ada jadwal hari ini</p>
              <p className="text-[11px] opacity-70">Semua instalasi hari ini telah selesai.</p>
            </div>
          )
        ) : loadingUnscheduled ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : unscheduled.length > 0 ? (
          <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5 custom-scrollbar">
            {unscheduled.map((r) => {
              const overdue = r.createdAt
                ? (now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000 > OVERDUE_DAYS
                : false;
              return (
                <li key={r.id}>
                  <Link
                    to={`${basePath}/${r.id}`}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-xl border transition-all group',
                      overdue
                        ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30'
                        : 'bg-muted/30 hover:bg-amber-500/10 border-border/70 hover:border-amber-500/30'
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-bold text-foreground font-mono truncate">
                        {r.requestNumber}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {r.siteName}
                      </div>
                    </div>
                    {overdue ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 shrink-0">
                        Overdue
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 shrink-0">
                        Pending
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-6 text-muted-foreground space-y-1">
            <AlertTriangle className="size-6 mx-auto opacity-30 text-amber-500" />
            <p className="text-xs font-semibold">Semua request terjadwal</p>
            <p className="text-[11px] opacity-70">Tidak ada antrean tertunda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallationCalendarPage() {
  const { isIctRole, isIctStaff } = usePermissions();
  const [range, setRange] = useState(() => {
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

  const { events, reschedule } = useInstallationCalendar({ ...range, technicianIds });

  const { data: unscheduled = [] } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });

  const today = new Date();

  const stats = useMemo(
    () => ({
      scheduled: events.length,
      today: events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), today)).length,
      rescheduleRequested: events.filter((e: CalendarEventData) => e.status === 'RESCHEDULE_REQUESTED').length,
    }),
    [events, today]
  );

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
        editable: isIctStaff,
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

  return (
    <FeatureErrorBoundary>
      <div className="flex flex-col lg:flex-row bg-card border border-border rounded-2xl overflow-hidden shadow-xs min-h-[720px] h-[calc(100vh-140px)]">
        {/* Style overrides for Staff Calendar */}
        <style>{`
          .fc-staff {
            --fc-border-color: hsl(var(--border) / 0.65);
            --fc-today-bg-color: hsl(var(--primary) / 0.05);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: hsl(var(--muted) / 0.3);
          }
          .fc-staff .fc-scrollgrid {
            border-radius: 1rem;
            overflow: hidden;
            border-color: hsl(var(--border) / 0.65) !important;
          }
          .fc-staff .fc-col-header-cell {
            background-color: hsl(var(--muted) / 0.35);
          }
          .fc-staff .fc-col-header-cell-cushion {
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: hsl(var(--muted-foreground));
            padding: 10px 4px;
          }
          .fc-staff .fc-daygrid-day-top {
            padding: 4px 6px;
          }
          .fc-staff .fc-daygrid-day-number {
            font-size: 0.8rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            padding: 2px 6px;
            border-radius: 0.5rem;
          }
          .fc-staff .fc-day-today .fc-daygrid-day-number {
            background-color: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
          }
          .fc-staff .fc-button-primary {
            background-color: hsl(var(--card)) !important;
            border-color: hsl(var(--border)) !important;
            color: hsl(var(--foreground)) !important;
            border-radius: 0.75rem !important;
            font-weight: 700 !important;
            font-size: 0.8rem !important;
            padding: 0.45rem 0.85rem !important;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
            transition: all 0.15s ease !important;
            cursor: pointer !important;
          }
          .fc-staff .fc-button-primary:hover {
            background-color: hsl(var(--muted)) !important;
            border-color: hsl(var(--border)) !important;
            color: hsl(var(--foreground)) !important;
          }
          .fc-staff .fc-button-primary:not(:disabled).fc-button-active {
            background-color: hsl(var(--primary)) !important;
            border-color: hsl(var(--primary)) !important;
            color: hsl(var(--primary-foreground)) !important;
          }
          .fc-staff .fc-toolbar-title {
            font-size: 1.2rem !important;
            font-weight: 800 !important;
            color: hsl(var(--foreground)) !important;
            letter-spacing: -0.02em;
          }
          .fc-staff .fc-more-link {
            font-size: 0.75rem !important;
            font-weight: 700 !important;
            color: hsl(var(--primary)) !important;
            background-color: hsl(var(--primary) / 0.1) !important;
            border: 1px solid hsl(var(--primary) / 0.2) !important;
            padding: 2px 6px !important;
            border-radius: 0.5rem !important;
            margin-top: 2px !important;
          }
          .fc-staff .fc-daygrid-event-harness {
            margin-bottom: 2px !important;
          }
          .fc-staff .fc-popover {
            background: hsl(var(--card)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: 1rem !important;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
            overflow: hidden;
            z-index: 50 !important;
          }
          .fc-staff .fc-popover-header {
            background: hsl(var(--muted) / 0.5) !important;
            border-bottom: 1px solid hsl(var(--border)) !important;
            padding: 8px 12px !important;
            font-weight: 700 !important;
            font-size: 0.8rem !important;
          }
        `}</style>

        {/* Split Panel Layout: Left Sidebar */}
        <div className="w-full lg:w-88 flex-shrink-0 bg-muted/15 border-r border-border flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">Jadwal Instalasi</h1>
                <p className="text-[11px] text-muted-foreground">Kalender operasional hardware ICT</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            <StatsStrip
              scheduled={stats.scheduled}
              today={stats.today}
              unscheduled={unscheduled.length}
              rescheduleRequested={stats.rescheduleRequested}
            />

            <TechnicianFilter selectedIds={technicianIds} onChange={setTechnicianIds} />

            <SidebarAgendaTabs />
          </div>
        </div>

        {/* Split Panel Layout: Right Calendar Content */}
        <div className="flex-1 overflow-auto bg-card p-4 fc-staff flex flex-col">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: 'Hari Ini',
              month: 'Bulan',
              week: 'Minggu',
              day: 'Hari',
            }}
            events={fcEvents}
            dayMaxEvents={3}
            moreLinkContent={(args) => `+${args.num} lagi`}
            eventContent={(info) => <EventChipMedium event={info.event.extendedProps as CalendarEventData} />}
            eventClick={(info) => openDrawer(info.event.start ?? new Date(), info.event.id)}
            dateClick={(info) => openDrawer(info.date, null)}
            editable={isIctStaff}
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
            datesSet={(info) => setRange({ from: info.startStr, to: info.endStr })}
            height="100%"
          />
        </div>

        {/* Bottom drawer */}
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
      </div>
    </FeatureErrorBoundary>
  );
}