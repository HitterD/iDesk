import { Link, Outlet, useLocation } from 'react-router-dom';
import { MonitorSmartphone, Plus } from 'lucide-react';
import { ResHead } from '@/components/resources/ResourceParts';
import { HardwareRequestsTabs, activeHardwareTab } from '../components/common/HardwareRequestsTabs';
import { useHardwareRole } from '../hooks/usePermissions';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';

/** Mockup hardware.html: one page head + segmented tabs above every tab panel. */
export function HardwareRequestsLayout() {
  const { role } = useHardwareRole();
  const basePath = useHardwareBasePath();
  const { pathname } = useLocation();
  const onList = activeHardwareTab(pathname, basePath) === 'list';

  return (
    <div className="res-page">
      <ResHead
        icon={MonitorSmartphone}
        tone="orange"
        title="Hardware Requests"
        description="Pengadaan, instalasi, dan katalog perangkat ICT"
        titleAdornment={<span className="dash-live"><i />Live</span>}
        actions={role === 'USER' && onList ? (
          <Link to={`${basePath}/new`} className="idesk-btn is-primary"><Plus aria-hidden="true" />Request Baru</Link>
        ) : undefined}
      />
      <HardwareRequestsTabs />
      <div key={pathname} className="res-tab-panel idesk-page-enter">
        <Outlet />
      </div>
    </div>
  );
}
