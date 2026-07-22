import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SlotPickerModal } from '../SlotPickerModal';
import { vi } from 'vitest';
import * as useSched from '../../../hooks/useScheduleSelection';

vi.mock('../../../hooks/useScheduleSelection', () => ({
  useScheduleSelection: () => ({
    select: vi.fn(),
    isSelecting: false,
  }),
}));

const mockSched = {
  id: 's1',
  status: 'PROPOSED_AWAITING_USER',
  technicianId: 't1',
  technician: { id: 't1', fullName: 'Tech 1' },
  proposedSlots: [
    { start: '2026-04-20T09:00:00Z', end: '2026-04-20T10:00:00Z' },
  ],
} as any;

describe('<SlotPickerModal>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('renders slots correctly', () => {
    renderWithQc(<SlotPickerModal open={true} onOpenChange={vi.fn()} requestId="r1" schedule={mockSched} />);
    expect(screen.getByText(/Tech 1/i)).toBeInTheDocument();
  });
});
