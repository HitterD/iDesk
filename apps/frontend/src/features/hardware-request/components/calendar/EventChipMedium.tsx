import { format, parseISO } from 'date-fns';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import type { CalendarEventData } from '../../types/calendar.types';

type Props = { event: CalendarEventData };

const AWAITING_CONFIRM_CHIP = {
  bg: 'bg-cyan-50',
  border: 'border-cyan-300',
  dot: 'bg-cyan-500',
  text: 'text-cyan-900',
  badge: 'KONFIRMASI',
} as const;

export function EventChipMedium({ event }: Props) {
  const isAwaitingConfirm =
    event.status === 'DONE' && event.requestStatus === 'AWAITING_USER_CONFIRMATION';
  const chip = isAwaitingConfirm
    ? AWAITING_CONFIRM_CHIP
    : INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  const time = format(parseISO(event.scheduledAt), 'HH:mm');

  return (
    <div
      className={`w-full rounded-md border px-1.5 py-1 cursor-pointer ${chip.bg} ${chip.border} ${isAwaitingConfirm ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chip.dot}`} />
        <span className={`text-xs font-semibold truncate flex-1 ${chip.text}`}>{event.requestNumber}</span>
        <span className={`text-[8px] px-1 rounded-full border font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
      </div>
      <div className="text-xs text-slate-500 pl-2.5 truncate">{event.technicianName} · {time}</div>
    </div>
  );
}