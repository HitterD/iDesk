import { useDashboardData } from '../../hooks/useDashboardData';
import { usePermissions } from '../../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../../hooks/useHardwareRequestRealtime';
import { KpiCards } from './KpiCards';
import { StatusDonut } from './StatusDonut';
import { AgingTable } from './AgingTable';
import { TopCategoriesBar } from './TopCategoriesBar';
import { WeeklyScheduleStrip } from './WeeklyScheduleStrip';
import { TechnicianWorkload } from './TechnicianWorkload';

import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';

export function HardwareDashboardPage() {
  const { isIctRole } = usePermissions();
  const d = useDashboardData();
  useHardwareGlobalRealtime();

  if (!isIctRole) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <FeatureErrorBoundary>
      <div className="flex flex-col gap-4">
        <KpiCards data={d.kpi} loading={d.isLoading} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusDonut data={d.statusDistribution} loading={d.isLoading} />
          <AgingTable data={d.aging} loading={d.isLoading} />
          <TopCategoriesBar data={d.topCategories} loading={d.isLoading} />
          <TechnicianWorkload data={d.technicianWorkload} loading={d.isLoading} />
        </div>
        <WeeklyScheduleStrip data={d.weekly} loading={d.isLoading} />
      </div>
    </FeatureErrorBoundary>
  );
}
