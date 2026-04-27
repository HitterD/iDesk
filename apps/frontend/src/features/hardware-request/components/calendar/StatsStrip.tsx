type Props = { scheduled: number; today: number; unscheduled: number; rescheduleRequested: number };

function StatCard({ value, label, valueClass, bgClass, borderClass }: {
  value: number; label: string; valueClass: string; bgClass: string; borderClass: string;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-3 ${bgClass} ${borderClass}`}>
      <span className={`text-2xl font-black tracking-tight ${valueClass}`}>{value}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
  );
}

export function StatsStrip({ scheduled, today, unscheduled, rescheduleRequested }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      <StatCard value={scheduled}           label="Scheduled"    valueClass="text-blue-600"  bgClass="bg-blue-50/50"   borderClass="border-blue-100" />
      <StatCard value={today}               label="Today"        valueClass="text-green-600" bgClass="bg-green-50/50"  borderClass="border-green-100" />
      <StatCard value={unscheduled}         label="Unscheduled"  valueClass="text-amber-600" bgClass="bg-amber-50/50"  borderClass="border-amber-100" />
      <StatCard value={rescheduleRequested} label="Reschedule"   valueClass="text-red-600"   bgClass="bg-red-50/50"    borderClass="border-red-100"   />
    </div>
  );
}