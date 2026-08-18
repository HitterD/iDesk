import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import type { CalendarEventData } from '../../types/calendar.types';

type Props = {
  open: boolean;
  date: Date | null;
  events: CalendarEventData[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onClose: () => void;
};

function ExpandedCard({ event, basePath }: { event: CalendarEventData; basePath: string }) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  return (
    <div className={`min-w-[220px] flex-shrink-0 rounded-xl border-2 border-blue-400 p-3 bg-white shadow-md`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold ${chip.text}`}>{event.requestNumber}</span>
        <span className={`text-xs rounded-full border px-1.5 font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
      </div>
      <div className="text-xs text-slate-600 space-y-0.5 mb-3">
        <div>🏢 {event.siteName}</div>
        <div>👷 {event.technicianName} · {format(parseISO(event.scheduledAt), 'HH:mm')}</div>
        {event.recipientName && <div>👤 {event.recipientName}{event.division ? ` / ${event.division}` : ''}</div>}
      </div>
      <Link
        to={`${basePath}/${event.requestId}`}
        className="block w-full rounded-md border border-slate-200 bg-slate-50 py-1 text-center text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        Detail →
      </Link>
    </div>
  );
}

function CompactCard({ event, onSelect }: { event: CalendarEventData; onSelect: () => void }) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="min-w-[160px] flex-shrink-0 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${chip.dot}`} />
        <span className="text-xs font-semibold text-slate-800">{event.requestNumber}</span>
      </div>
      <div className="text-xs text-slate-500 pl-3.5 space-y-0.5">
        <div>{event.technicianName}</div>
        <div>{format(parseISO(event.scheduledAt), 'HH:mm')} · {event.siteName}</div>
      </div>
      <div className="mt-2 text-xs text-blue-500 pl-3.5">Klik untuk detail ▸</div>
    </button>
  );
}

export function AgendaBottomDrawer({ open, date, events, selectedEventId, onSelectEvent, onClose }: Props) {
  const basePath = useHardwareBasePath();
  if (!open || !date) return null;

  return (
    <div className="border-t-2 border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex justify-center pt-1.5 pb-1">
        <div className="w-8 h-0.5 rounded-full bg-slate-300" />
      </div>
      <div className="flex items-center justify-between px-4 pb-2">
        <div>
          <div className="text-sm font-bold text-slate-900">
            {format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })}
          </div>
          <div className="text-xs text-slate-500">{events.length} instalasi terjadwal</div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          ✕ Tutup
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-4">
        {events.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Tidak ada instalasi pada tanggal ini.</p>
        ) : (
          events.map(e =>
            e.scheduleId === selectedEventId
              ? <ExpandedCard key={e.scheduleId} event={e} basePath={basePath} />
              : <CompactCard  key={e.scheduleId} event={e} onSelect={() => onSelectEvent(e.scheduleId)} />
          )
        )}
      </div>
    </div>
  );
}