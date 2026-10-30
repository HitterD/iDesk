import { CalendarCheck, CalendarDays, CalendarSync, CalendarX } from 'lucide-react';
import { ResStat } from '@/components/resources/ResourceParts';

type Props = { scheduled: number; today: number; unscheduled: number; rescheduleRequested: number };

/** Mockup hardware.html ?tab=calendar `.stats.four`: Hari Ini · Scheduled · Unscheduled · Reschedule. */
export function StatsStrip({ scheduled, today, unscheduled, rescheduleRequested }: Props) {
  return (
    <section className="res-stats is-four" aria-label="Ringkasan jadwal">
      <ResStat icon={CalendarCheck} tone="navy" label="Hari Ini" value={today} zero={today === 0} />
      <ResStat icon={CalendarDays} tone="blue" label="Scheduled" value={scheduled} zero={scheduled === 0} />
      <ResStat icon={CalendarX} tone="neutral" label="Unscheduled" value={unscheduled} zero={unscheduled === 0} />
      <ResStat icon={CalendarSync} tone="amber" label="Reschedule" value={rescheduleRequested}
        attention={rescheduleRequested > 0} zero={rescheduleRequested === 0} />
    </section>
  );
}
