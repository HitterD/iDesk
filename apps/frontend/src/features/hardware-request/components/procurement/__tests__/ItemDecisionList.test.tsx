import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ItemDecisionList } from '../ItemDecisionList';

const items = [
  { id: 'i1', name: 'Monitor', qty: 2, procurementDecision: null },
  { id: 'i2', name: 'Keyboard', qty: 5, procurementDecision: 'APPROVED' as const },
];

describe('<ItemDecisionList>', () => {
  it('renders items + decision buttons', () => {
    render(<ItemDecisionList items={items as any} onChange={vi.fn()} />);
    expect(screen.getByText('Monitor')).toBeInTheDocument();
    expect(screen.getByText('Keyboard')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(2);
  });

  it('calls onChange with APPROVED when ✓ clicked', async () => {
    const onChange = vi.fn();
    render(<ItemDecisionList items={items as any} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);
    expect(onChange).toHaveBeenCalledWith('i1', 'APPROVED');
  });

  it('marks pre-decided item with active state', () => {
    render(<ItemDecisionList items={items as any} onChange={vi.fn()} />);
    const approveBtns = screen.getAllByRole('button', { name: /approve/i });
    expect(approveBtns[1]).toHaveAttribute('aria-pressed', 'true');
  });
});
