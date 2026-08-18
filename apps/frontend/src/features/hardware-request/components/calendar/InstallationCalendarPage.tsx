import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, isSameDay, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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

type TodaySchedule = { id: string; requestId: string; scheduledAt: string; siteName: string; requestNumber: string };
type UnscheduledRequest = { id: string; requestNumber: string; siteName: string; createdAt?: string };

function TodayPanelContent() {
  const basePath = useHardwareBasePath();
  const { data = [], isLoading } = useQuery<TodaySchedule[]>({
    queryKey: ['hardware-requests', 'my-today'],
    queryFn: fetchMyTodaySchedules,
    staleTime: 30_000,
  });
  return (
    <div className="p-3">
      <div className="text-xs font-bold text-green-700 mb-2">Jadwal Hari Ini</div>
      {isLoading ? (
        <div className="space-y-1.5">{[1,2].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : data.length > 0 ? (
        <ul className="space-y-1.5">
          {data.map(s => (
            <li key={s.id}>
              <Link to={`${basePath}/${s.requestId}`} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-2.5 py-1.5 hover:bg-green-100 transition-colors">
                <span className="text-xs font-bold text-green-700">{format(parseISO(s.scheduledAt), 'HH:mm')}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{s.siteName}</div>
                  <div className="text-xs text-slate-500 font-mono">{s.requestNumber}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Tidak ada jadwal hari ini.</p>
      )}
    </div>
  );
}

const OVERDUE_DAYS = 7;

function UnscheduledPanelContent() {
  const basePath = useHardwareBasePath();
  const { data = [], isLoading } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });
  const now = new Date();
  return (
    <div className="p-3">
      <div className="text-xs font-bold text-amber-700 mb-2">Request Belum Terjadwal</div>
      {isLoading ? (
        <div className="space-y-1.5">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : data.length > 0 ? (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {data.map(r => {
            const overdue = r.createdAt
              ? (now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000 > OVERDUE_DAYS
              : false;
            return (
              <li key={r.id} className={`rounded-lg border px-2.5 py-1.5 ${overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                <Link to={`${basePath}/${r.id}`} className="block min-w-0">
                  <div className={`text-xs font-semibold truncate ${overdue ? 'text-red-800' : 'text-amber-800'}`}>
                    {r.requestNumber}{overdue ? ' ⚠' : ''}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{r.siteName}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Semua request sudah terjadwal.</p>
      )}
    </div>
  );
}

export function InstallationCalendarPage() {
  const { isIctRole, isIctStaff } = usePermissions();
  const [range, setRange] = useState(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to:   new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
    };
  });
  const [technicianIds, setTechnicianIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerDate, setDrawerDate]   = useState<Date | null>(null);
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    requestId: string; requestNumber: string; from: string; to: string; revert: () => void;
  } | null>(null);

  const { events, reschedule } = useInstallationCalendar({ ...range, technicianIds });

  const { data: unscheduled = [] } = useQuery<UnscheduledRequest[]>({
    queryKey: ['hardware-requests', 'unscheduled'],
    queryFn: fetchUnscheduledRequests,
    staleTime: 30_000,
  });

  const today = new Date();

  const stats = useMemo(() => ({
    scheduled:            events.length,
    today:                events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), today)).length,
    rescheduleRequested:  events.filter((e: CalendarEventData) => e.status === 'RESCHEDULE_REQUESTED').length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [events]);

  const drawerEvents = useMemo(() =>
    drawerDate ? events.filter((e: CalendarEventData) => isSameDay(parseISO(e.scheduledAt), drawerDate)) : [],
    [events, drawerDate],
  );

  const fcEvents = useMemo(() =>
    events.map((e: CalendarEventData) => ({
      id: e.scheduleId,
      title: e.requestNumber,
      start: e.scheduledAt,
      end: e.endsAt ?? undefined,
      editable: isIctStaff,
      extendedProps: e,
    })),
    [events, isIctStaff],
  );

  if (!isIctRole) return <UserInstallationCalendar />;

  const openDrawer = (date: Date, eventId: string | null) => {
    setDrawerDate(date);
    setDrawerEventId(eventId);
    setDrawerOpen(true);
  };

  return (
    <FeatureErrorBoundary>
      <div className="flex bg-slate-50 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Split Panel Layout: Left Sidebar */}
        <div className="w-72 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h1 className="text-base font-bold text-slate-900">Installation Calendar</h1>
            <p className="text-xs text-slate-500">Jadwal instalasi hardware</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <StatsStrip scheduled={stats.scheduled} today={stats.today} unscheduled={unscheduled.length} rescheduleRequested={stats.rescheduleRequested} />
            <TechnicianFilter selectedIds={technicianIds} onChange={setTechnicianIds} />
            
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <TodayPanelContent />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <UnscheduledPanelContent />
              </div>
            </div>
          </div>
        </div>

        {/* Split Panel Layout: Right Calendar Content */}
        <div className="flex-1 overflow-auto bg-white p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            events={fcEvents}
            eventContent={info => <EventChipMedium event={info.event.extendedProps as CalendarEventData} />}
            eventClick={info => openDrawer(info.event.start ?? new Date(), info.event.id)}
            dateClick={info => openDrawer(info.date, null)}
            editable={isIctStaff}
            eventDrop={info => {
              const e = info.event.extendedProps as CalendarEventData;
              setPendingReschedule({
                requestId: e.requestId,
                requestNumber: e.requestNumber,
                from: e.scheduledAt,
                to: info.event.start?.toISOString() ?? e.scheduledAt,
                revert: info.revert,
              });
            }}
            datesSet={info => setRange({ from: info.startStr, to: info.endStr })}
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
          onCancel={() => { pendingReschedule?.revert(); setPendingReschedule(null); }}
          onConfirm={async reason => {
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