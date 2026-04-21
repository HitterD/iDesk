import { format, parseISO } from 'date-fns';
import { INSTALL_STATUS_CHIP, type InstallStatus } from '../../utils/status.util';
import type { CalendarEventData } from '../../types/calendar.types';

type Props = { event: CalendarEventData };

export function EventChipMedium({ event }: Props) {
  const chip = INSTALL_STATUS_CHIP[event.status as InstallStatus] ?? INSTALL_STATUS_CHIP.CANCELLED;
  const time = format(parseISO(event.scheduledAt), 'HH:mm');

  return (
    <div className={`w-full rounded-md border px-1.5 py-1 cursor-pointer ${chip.bg} ${chip.border}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chip.dot}`} />
        <span className={`text-[10px] font-semibold truncate flex-1 ${chip.text}`}>{event.requestNumber}</span>
        <span className={`text-[8px] px-1 rounded-full border font-semibold ${chip.bg} ${chip.border} ${chip.text}`}>{chip.badge}</span>
      </div>
      <div className="text-[9px] text-slate-500 pl-2.5 truncate">{event.technicianName} · {time}</div>
    </div>
  );
}