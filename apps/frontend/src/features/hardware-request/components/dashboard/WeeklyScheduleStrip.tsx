import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { DashChartSkeleton, DashEmpty, DashPanel } from '@/features/dashboard/components/DashboardParts';
import { HBars } from './HBars';

type Slot = {
  date?: string;
  count?: number;
  scheduledStart?: string;
  scheduledAt?: string;
};

export function WeeklyScheduleStrip({ data, loading }: { data?: Slot[]; loading?: boolean }) {
  const today = new Date();

  const normalizedSlots = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Case 1: Pre-aggregated array of { date: 'YYYY-MM-DD', count: N }
    if (data.length > 0 && typeof data[0] === 'object' && 'date' in data[0] && 'count' in data[0]) {
      return data as { date: string; count: number }[];
    }

    // Case 2: Array of raw schedules from backend (e.g. [{ scheduledStart: '...', ... }])
    // Generate 7 days starting from start of current week
    const weekStart = new Date(today);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const daysMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = format(d, 'yyyy-MM-dd');
      daysMap[key] = 0;
    }

    for (const item of data) {
      const timeStr = item.scheduledStart || item.scheduledAt;
      if (timeStr) {
        try {
          const itemDate = format(parseISO(timeStr), 'yyyy-MM-dd');
          if (itemDate in daysMap) {
            daysMap[itemDate]++;
          }
        } catch {
          // ignore invalid date strings
        }
      }
    }

    return Object.entries(daysMap).map(([date, count]) => ({ date, count }));
  }, [data]);

  const items = normalizedSlots.map((d) => {
    let date = today;
    try { date = parseISO(d.date); } catch { /* fallback to today */ }
    const label = format(date, 'EEE d', { locale: idLocale });
    return { key: d.date, label: isSameDay(date, today) ? `${label} · hari ini` : label, value: d.count, color: isSameDay(date, today) ? 'hsl(var(--idesk-sapphire))' : undefined };
  });
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <DashPanel title={<>Proyeksi Jadwal Instalasi <small>{total} terjadwal minggu ini</small></>} label="Proyeksi jadwal instalasi">
      {loading ? <DashChartSkeleton /> : items.length === 0 ? <DashEmpty>Belum ada jadwal minggu ini.</DashEmpty> : <HBars items={items} />}
    </DashPanel>
  );
}
