import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HardwareRequestsTabs } from '../common/HardwareRequestsTabs';
import { vi } from 'vitest';

vi.mock('../../hooks/useHardwareRequestsCount', () => ({
  useHardwareRequestsCount: () => ({ openCount: 0, isLoading: false })
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
    expect(screen.getByRole('link', { name: /permintaan/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /kalender/i })).toBeInTheDocument();
  });

  it('marks Permintaan active on /hardware-requests', () => {
    renderAt('/hardware-requests');
    const link = screen.getByRole('link', { name: /permintaan/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Dashboard active on /hardware-requests/dashboard', () => {
    renderAt('/hardware-requests/dashboard');
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('marks Kalender active on /hardware-requests/calendar', () => {
    renderAt('/hardware-requests/calendar');
    const link = screen.getByRole('link', { name: /kalender/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Permintaan active on deep routes like /hardware-requests/:id', () => {
    renderAt('/hardware-requests/abc-123');
    const link = screen.getByRole('link', { name: /permintaan/i });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  describe('with reduced motion', () => {
    beforeAll(() => {
      vi.mock('framer-motion', async () => {
        const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
        return { ...actual, useReducedMotion: () => true };
      });
    });
    
    it('renders tabs with reduced motion without crashing', () => {
      renderAt('/hardware-requests/dashboard');
      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
    });
  });
});
