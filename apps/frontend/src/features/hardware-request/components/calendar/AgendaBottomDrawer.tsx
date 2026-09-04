import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Building2, User, Wrench, ArrowRight, X, CalendarCheck } from 'lucide-react';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import type { CalendarEventData } from '../../types/calendar.types';
import { cn } from '@/lib/utils';

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
    <div className="min-w-[260px] max-w-[280px] flex-shrink-0 rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-lg text-left transition-all">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-mono font-bold text-foreground">{event.requestNumber}</span>
        <span
          className={cn(
            'text-[10px] rounded-lg border px-2 py-0.5 font-bold uppercase font-mono',
            chip.bg,
            chip.border,
            chip.text
          )}
        >
          {chip.badge || event.status}
        </span>
      </div>

      <div className="text-xs text-muted-foreground space-y-1.5 mb-3.5">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="size-3.5 text-primary shrink-0" />
          <span className="truncate">{event.siteName || 'Lokasi N/A'}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Wrench className="size-3.5 text-primary shrink-0" />
          <span className="truncate">
            {event.technicianName} · <strong className="text-foreground">{format(parseISO(event.scheduledAt), 'HH:mm')}</strong>
          </span>
        </div>
        {event.recipientName && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{event.recipientName}{event.division ? ` (${event.division})` : ''}</span>
          </div>
        )}
      </div>

      <Link
        to={`${basePath}/${event.requestId}`}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
      >
        <span>Lihat Detail Request</span>
        <ArrowRight className="size-3.5" />
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
      className="min-w-[200px] flex-shrink-0 rounded-2xl border border-border bg-card/90 p-3.5 text-left hover:border-primary/50 hover:bg-muted/30 transition-all shadow-2xs group cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn('size-2 rounded-full flex-shrink-0', chip.dot)} />
        <span className="text-xs font-mono font-bold text-foreground truncate flex-1">
          {event.requestNumber}
        </span>
        <span className="text-[10px] font-mono font-semibold text-muted-foreground">
          {format(parseISO(event.scheduledAt), 'HH:mm')}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground pl-3.5 space-y-0.5">
        <div className="truncate text-foreground font-medium">{event.technicianName}</div>
        <div className="truncate">{event.siteName}</div>
      </div>
      <div className="mt-2 text-[10px] font-bold text-primary pl-3.5 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
        <span>Buka preview</span>
        <span>→</span>
      </div>
    </button>
  );
}

export function AgendaBottomDrawer({ open, date, events, selectedEventId, onSelectEvent, onClose }: Props) {
  const basePath = useHardwareBasePath();
  if (!open || !date) return null;

  return (
    <div className="border-t border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="flex items-center justify-between px-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <CalendarCheck className="size-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">
              {format(date, 'EEEE, d MMMM yyyy', { locale: idLocale })}
            </div>
            <div className="text-[11px] text-muted-foreground">{events.length} instalasi terjadwal</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-3.5" />
          <span>Tutup</span>
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-4 custom-scrollbar">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">Tidak ada instalasi terjadwal pada tanggal ini.</p>
        ) : (
          events.map((e) =>
            e.scheduleId === selectedEventId ? (
              <ExpandedCard key={e.scheduleId} event={e} basePath={basePath} />
            ) : (
              <CompactCard key={e.scheduleId} event={e} onSelect={() => onSelectEvent(e.scheduleId)} />
            )
          )
        )}
      </div>
    </div>
  );
}