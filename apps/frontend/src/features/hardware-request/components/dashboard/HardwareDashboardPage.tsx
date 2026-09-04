import { BarChart3 } from 'lucide-react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { usePermissions } from '../../hooks/usePermissions';
import { useHardwareGlobalRealtime } from '../../hooks/useHardwareRequestRealtime';
import { KpiCards } from './KpiCards';
import { StatusDonut } from './StatusDonut';
import { AgingTable } from './AgingTable';
import { TopCategoriesBar } from './TopCategoriesBar';
import { WeeklyScheduleStrip } from './WeeklyScheduleStrip';
import { TechnicianWorkload } from './TechnicianWorkload';
import { HardwareRequestsBreadcrumb } from '../common/HardwareRequestsBreadcrumb';
import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';

export function HardwareDashboardPage() {
  const { isIctRole } = usePermissions();
  const d = useDashboardData();
  useHardwareGlobalRealtime();

  if (!isIctRole) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <FeatureErrorBoundary>
      <div className="space-y-6 animate-fade-in-up">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <BarChart3 className="size-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                Overview & Metrik Hardware Request
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Monitoring KPI operasional, SLA penuaan tiket, distribusi status, dan beban teknisi secara real-time.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <KpiCards data={d.kpi} loading={d.isLoading} />

        {/* Bento Grid: 2 Columns on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDonut data={d.statusDistribution} loading={d.isLoading} />
          <AgingTable data={d.aging} loading={d.isLoading} />
          <TopCategoriesBar data={d.topCategories} loading={d.isLoading} />
          <TechnicianWorkload data={d.technicianWorkload} loading={d.isLoading} />
        </div>

        {/* 7-Day Forecast Strip */}
        <WeeklyScheduleStrip data={d.weekly} loading={d.isLoading} />
      </div>
    </FeatureErrorBoundary>
  );
}
