import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ProcurementPanel } from '../ProcurementPanel';

const mockRequest = {
  id: 'r1', status: 'PROCUREMENT',
  items: [
    { id: 'i1', name: 'Monitor', qty: 2, procurementDecision: null },
    { id: 'i2', name: 'Keyboard', qty: 5, procurementDecision: null },
  ],
} as any;

describe('<ProcurementPanel>', () => {
  const renderWithQc = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
  };

  it('disables Selesaikan button when items undecided', () => {
    renderWithQc(<ProcurementPanel request={mockRequest} />);
    expect(screen.getByRole('button', { name: /selesaikan/i })).toBeDisabled();
  });

  it('enables Selesaikan after all items decided', async () => {
    renderWithQc(<ProcurementPanel request={mockRequest} />);
    const approveBtns = screen.getAllByRole('button', { name: /approve/i });
    await userEvent.click(approveBtns[0]);
    await userEvent.click(approveBtns[1]);
    expect(screen.getByRole('button', { name: /selesaikan/i })).toBeEnabled();
  });
});
