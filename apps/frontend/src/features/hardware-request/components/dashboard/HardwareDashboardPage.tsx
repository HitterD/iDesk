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

/** Mockup hardware.html ?tab=dashboard: KPI tiles + two-column panels (head + tabs live in the layout). */
export function HardwareDashboardPage() {
  const { isIctRole } = usePermissions();
  const d = useDashboardData();
  useHardwareGlobalRealtime();

  if (!isIctRole) return <div className="p-8 text-center text-sm text-muted-foreground">Akses ditolak.</div>;

  return (
    <FeatureErrorBoundary>
      <KpiCards data={d.kpi} loading={d.isLoading} />
      <div className="res-grid2">
        <StatusDonut data={d.statusDistribution} loading={d.isLoading} />
        <TopCategoriesBar data={d.topCategories} loading={d.isLoading} />
        <TechnicianWorkload data={d.technicianWorkload} loading={d.isLoading} />
        <AgingTable data={d.aging} loading={d.isLoading} />
      </div>
      <WeeklyScheduleStrip data={d.weekly} loading={d.isLoading} />
    </FeatureErrorBoundary>
  );
}
