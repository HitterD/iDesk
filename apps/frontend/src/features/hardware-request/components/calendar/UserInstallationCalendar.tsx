import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parseISO, isAfter } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar, Info, CalendarX2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';
import { EventChipMedium } from './EventChipMedium';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import type { CalendarEventData } from '../../types/calendar.types';
import { useMySchedules } from '../../hooks/useMySchedules';

export function UserInstallationCalendar() {
  const basePath = useHardwareBasePath();
  const navigate = useNavigate();
  const [range, setRange] = useState(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: first.toISOString(), to: last.toISOString() };
  });

  const { events, isLoading } = useMySchedules(range);

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
      .slice(0, 5);
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

  return (
    <FeatureErrorBoundary>
      <div className="flex flex-col gap-4 p-4 bg-slate-50 min-h-screen">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3 text-blue-800">
          <Info className="size-5 flex-shrink-0 text-blue-500" />
          <div>
            <h3 className="font-semibold text-sm">Informasi Jadwal</h3>
            <p className="text-xs text-blue-600">Jadwal instalasi Anda ditampilkan di kalender ini. Klik event untuk melihat detail.</p>
          </div>
        </div>

        {actionRequiredEvents.length > 0 && (
          <div className="bg-cyan-50 border border-cyan-300 rounded-lg p-3 flex items-start gap-3 text-cyan-900">
            <AlertCircle className="size-5 flex-shrink-0 text-cyan-600 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Aksi Diperlukan</h3>
              <p className="text-xs text-cyan-700 mb-2">
                {actionRequiredEvents.length} jadwal membutuhkan tindakan dari Anda.
              </p>
              <div className="flex flex-col gap-1.5">
                {actionRequiredEvents.slice(0, 3).map((e) => {
                  const isConfirm =
                    e.status === 'DONE' && e.requestStatus === 'AWAITING_USER_CONFIRMATION';
                  return (
                    <Link
                      key={e.scheduleId}
                      to={`${basePath}/${e.requestId}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-white border border-cyan-200 px-2.5 py-1.5 text-xs hover:bg-cyan-50 transition-colors"
                    >
                      <span className="font-semibold text-cyan-900 truncate">
                        {e.requestNumber} · {e.siteName}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-700 shrink-0">
                        {isConfirm ? 'Konfirmasi instalasi →' : 'Pilih slot →'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="size-4" />
                Kalender Instalasi
              </h2>
              {isLoading && <span className="text-[10px] font-medium text-slate-500">Memuat...</span>}
            </header>
            
            {!isLoading && events.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500">
                <CalendarX2 className="mb-2 size-6 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">Tidak ada jadwal</p>
                <p className="text-[10px]">Belum ada jadwal instalasi di rentang waktu ini.</p>
              </div>
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek',
                }}
                events={fcEvents}
                eventContent={info => <EventChipMedium event={info.event.extendedProps as CalendarEventData} />}
                eventClick={(info) => {
                  info.jsEvent.preventDefault();
                  const e = info.event.extendedProps as CalendarEventData;
                  navigate(`${basePath}/${e.requestId}`);
                }}
                datesSet={(arg) =>
                  setRange({ from: arg.startStr, to: arg.endStr })
                }
                height="auto"
              />
            )}
            
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keterangan Warna</p>
              <div className="flex flex-wrap gap-2">
                {userVisibleStatuses.map(({ key, label }) => {
                  const chip =
                    key === 'AWAITING_CONFIRM'
                      ? { bg: 'bg-cyan-50', border: 'border-cyan-300', dot: 'bg-cyan-500', text: 'text-cyan-900' }
                      : INSTALL_STATUS_CHIP[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${chip.bg} ${chip.border} ${chip.text}`}
                    >
                      <span className={`size-1.5 rounded-full ${chip.dot}`} />
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Jadwal Mendatang</h3>
              <div className="flex flex-col gap-2.5">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((e) => {
                    const isAwaitingConfirm =
                      e.status === 'DONE' && e.requestStatus === 'AWAITING_USER_CONFIRMATION';
                    const chip = isAwaitingConfirm
                      ? { bg: 'bg-cyan-50', border: 'border-cyan-300', dot: 'bg-cyan-500', text: 'text-cyan-900', badge: 'KONFIRMASI' }
                      : INSTALL_STATUS_CHIP[e.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
                    return (
                      <Link
                        to={`${basePath}/${e.requestId}`}
                        key={e.scheduleId}
                        className={`block rounded-lg border-y border-r border-l-4 p-2.5 bg-white shadow-sm hover:bg-slate-50 transition-colors ${chip.border.replace('border-', 'border-l-')} border-y-slate-100 border-r-slate-100`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`text-[10px] font-bold ${chip.text}`}>{e.requestNumber}</span>
                          <span className={`text-[8px] rounded-full border px-1 font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 line-clamp-1">{e.siteName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{format(parseISO(e.scheduledAt), 'dd MMM, HH:mm', { locale: id })}</p>
                      </Link>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Tidak ada jadwal mendatang.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FeatureErrorBoundary>
  );
}