import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeliveryBoard } from '../DeliveryBoard';

const mockReq = {
  id: 'r1', status: 'AWAITING_DELIVERY',
  items: [
    { id: 'i1', name: 'Monitor', quantity: 2, deliveryStatus: 'ARRIVED', arrivedAt: '2026-04-19T08:00:00Z', procurementDecision: 'APPROVED' },
    { id: 'i2', name: 'Keyboard', quantity: 5, deliveryStatus: 'PENDING', procurementDecision: 'APPROVED' },
    { id: 'i3', name: 'Cable', quantity: 1, deliveryStatus: 'NOT_PROCURED', procurementDecision: 'REJECTED' },
  ],
} as any;
const ictUser = { id: 'ict-1', role: 'ICT_STAFF' as const };

describe('<DeliveryBoard>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('renders all items including NOT_PROCURED greyed', () => {
    renderWithQc(<DeliveryBoard request={mockReq} user={ictUser} onSchedule={vi.fn()} />);
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getByText('Cable')).toBeInTheDocument();
    expect(screen.getByText(/tidak diproses/i)).toBeInTheDocument();
  });

  it('shows "Jadwalkan Instalasi" enabled when ≥1 ARRIVED', () => {
    renderWithQc(<DeliveryBoard request={mockReq} user={ictUser} onSchedule={vi.fn()} />);
    expect(screen.getByRole('button', { name: /jadwalkan/i })).toBeEnabled();
  });

  it('USER cannot toggle delivery (read-only)', () => {
    const userU = { id: 'u1', role: 'USER' as const };
    renderWithQc(<DeliveryBoard request={mockReq} user={userU} onSchedule={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sudah datang/i })).not.toBeInTheDocument();
  });
});
