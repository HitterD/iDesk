import { Outlet } from 'react-router-dom';
import { HardwareRequestsTabs } from '../components/common/HardwareRequestsTabs';

export function HardwareRequestsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <HardwareRequestsTabs />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
