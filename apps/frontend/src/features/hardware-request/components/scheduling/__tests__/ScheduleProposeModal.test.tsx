import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleProposeModal } from '../ScheduleProposeModal';
import { vi } from 'vitest';
import * as useSched from '../../hooks/useScheduleSelection';

vi.mock('../../hooks/useScheduleSelection', () => ({
  useScheduleSelection: () => ({
    propose: vi.fn(),
    isProposing: false,
  }),
}));

const mockItems = [{ id: 'i1', name: 'Router', quantity: 1 }];

describe('<ScheduleProposeModal>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('renders correctly', () => {
    renderWithQc(<ScheduleProposeModal open={true} onOpenChange={vi.fn()} requestId="r1" arrivedItems={mockItems as any} />);
    expect(screen.getByText(/Router/i)).toBeInTheDocument();
  });
});
