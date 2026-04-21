import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HardwareRequestsLayout } from '../../layouts/HardwareRequestsLayout';
import { vi } from 'vitest';

vi.mock('../../hooks/useHardwareRequestsCount', () => ({
  useHardwareRequestsCount: () => ({ openCount: 0, isLoading: false })
}));

describe('HardwareRequestsLayout', () => {
  it('renders outlet child and tab bar', () => {
    render(
      <MemoryRouter initialEntries={['/hardware-requests']}>
        <Routes>
          <Route path="/hardware-requests" element={<HardwareRequestsLayout />}>
            <Route index element={<div>LIST_CHILD</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('LIST_CHILD')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hardware requests/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /hardware requests tabs/i })).toBeInTheDocument();
  });
});
