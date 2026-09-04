import { format, parseISO } from 'date-fns';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import type { CalendarEventData } from '../../types/calendar.types';
import { cn } from '@/lib/utils';

type Props = { event: CalendarEventData };

const AWAITING_CONFIRM_CHIP = {
  bg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 hover:border-cyan-500/50',
  dot: 'bg-cyan-500 shadow-xs shadow-cyan-500/50',
  badge: 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border-cyan-500/30',
  label: 'KONFIRMASI',
} as const;

export function EventChipMedium({ event }: Props) {
  const isAwaitingConfirm =
    event.status === 'DONE' && event.requestStatus === 'AWAITING_USER_CONFIRMATION';
  const defaultChip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  
  const time = event.scheduledAt ? format(parseISO(event.scheduledAt), 'HH:mm') : '--:--';
  const tooltipText = `[${event.requestNumber}] ${time} WIB\nTeknisi: ${event.technicianName || 'Belum Ditugaskan'}\nLokasi: ${event.siteName || 'N/A'}\nStatus: ${defaultChip.badge || event.status}`;

  return (
    <div
      title={tooltipText}
      className={cn(
        'group relative w-full rounded-md border px-1.5 py-1 transition-all duration-150 cursor-pointer text-left select-none overflow-hidden',
        isAwaitingConfirm
          ? AWAITING_CONFIRM_CHIP.bg
          : cn(
              defaultChip.bg,
              defaultChip.border,
              'hover:shadow-xs hover:brightness-105 active:scale-[0.99]'
            ),
        isAwaitingConfirm && 'ring-1 ring-cyan-400/50 animate-pulse'
      )}
    >
      {/* Top row: Status Dot + Time + Request Number + Mini Pill */}
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn(
            'size-1.5 rounded-full shrink-0',
            isAwaitingConfirm ? AWAITING_CONFIRM_CHIP.dot : defaultChip.dot
          )}
        />
        <span className="text-[10px] font-mono font-bold opacity-80 tabular-nums shrink-0">
          {time}
        </span>
        <span className="text-[11px] font-mono font-bold truncate flex-1 tracking-tight text-foreground">
          {event.requestNumber}
        </span>
        <span
          className={cn(
            'text-[9px] px-1 py-0.2 rounded font-bold tracking-tight shrink-0 border uppercase font-mono leading-none',
            isAwaitingConfirm ? AWAITING_CONFIRM_CHIP.badge : cn(defaultChip.bg, defaultChip.border, defaultChip.text)
          )}
        >
          {isAwaitingConfirm ? 'CFM' : defaultChip.badge || event.status?.slice(0, 4)}
        </span>
      </div>

      {/* Sub row: Tech & Site */}
      {event.technicianName && (
        <div className="text-[9.5px] text-muted-foreground truncate mt-0.5 pl-2.5 font-medium leading-tight opacity-90 group-hover:opacity-100">
          {event.technicianName} {event.siteName ? `· ${event.siteName}` : ''}
        </div>
      )}
    </div>
  );
}