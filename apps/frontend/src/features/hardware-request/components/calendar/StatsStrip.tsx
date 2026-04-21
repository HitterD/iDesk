type Props = { scheduled: number; today: number; unscheduled: number; rescheduleRequested: number };

function StatCard({ value, label, valueClass, bgClass, borderClass }: {
  value: number; label: string; valueClass: string; bgClass: string; borderClass: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${bgClass} ${borderClass}`}>
      <span className={`text-base font-bold leading-none ${valueClass}`}>{value}</span>
      <span className="text-xs text-slate-500 leading-tight">{label}</span>
    </div>
  );
}

export function StatsStrip({ scheduled, today, unscheduled, rescheduleRequested }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatCard value={scheduled}           label="Total Scheduled"  valueClass="text-blue-600"  bgClass="bg-slate-50"  borderClass="border-slate-200" />
      <StatCard value={today}               label="Today's Schedule" valueClass="text-green-600" bgClass="bg-green-50"  borderClass="border-green-200" />
      <StatCard value={unscheduled}         label="Unscheduled"      valueClass="text-amber-600" bgClass="bg-amber-50"  borderClass="border-amber-200" />
      <StatCard value={rescheduleRequested} label="Reschedule Req."  valueClass="text-red-600"   bgClass="bg-red-50"    borderClass="border-red-200"   />
    </div>
  );
}