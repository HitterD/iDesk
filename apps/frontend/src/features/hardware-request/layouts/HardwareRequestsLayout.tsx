import { Outlet, Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HardwareRequestsTabs } from '../components/common/HardwareRequestsTabs';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';

export function HardwareRequestsLayout() {
  const { role } = useHardwareRole();
  const basePath = useHardwareBasePath();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Hardware Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola permintaan hardware, jadwal instalasi, dan monitoring pengiriman.
          </p>
        </div>
        {role === 'USER' && (
          <Link
            to={`${basePath}/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus className="size-4" /> Buat Request Baru
          </Link>
        )}
      </header>
      <HardwareRequestsTabs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
