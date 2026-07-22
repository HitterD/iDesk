import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HardwareRequestsTabs } from '../common/HardwareRequestsTabs';
import { vi } from 'vitest';

vi.mock('../../hooks/useHardwareRequestsCount', () => ({
  useHardwareRequestsCount: () => ({ openCount: 0, isLoading: false })
}));

vi.mock('../../hooks/usePermissions', () => ({
  useHardwareRole: () => ({ role: 'ICT_STAFF' }),
  usePermissions: () => ({ isIctLead: false }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hardware-requests" element={<HardwareRequestsTabs />}>
          <Route index element={<div />} />
          <Route path="dashboard" element={<div />} />
          <Route path="calendar" element={<div />} />
          <Route path=":id" element={<div />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('HardwareRequestsTabs', () => {
  it('renders three tabs', () => {
    renderAt('/hardware-requests');
    expect(screen.getByRole('link', { name: /daftar request/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /jadwal instalasi/i })).toBeInTheDocument();
  });

  it('marks Daftar Request active on /hardware-requests', () => {
    renderAt('/hardware-requests');
    const link = screen.getByRole('link', { name: /daftar request/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Overview active on /hardware-requests/dashboard', () => {
    renderAt('/hardware-requests/dashboard');
    const link = screen.getByRole('link', { name: /overview/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Jadwal Instalasi active on /hardware-requests/calendar', () => {
    renderAt('/hardware-requests/calendar');
    const link = screen.getByRole('link', { name: /jadwal instalasi/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Daftar Request active on deep routes', () => {
    renderAt('/hardware-requests/abc-123');
    const link = screen.getByRole('link', { name: /daftar request/i });
    expect(link).not.toHaveAttribute('aria-current', 'page');
  });
});
