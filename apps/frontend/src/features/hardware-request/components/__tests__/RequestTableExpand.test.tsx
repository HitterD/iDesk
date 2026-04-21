import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandableItemRow } from '../list/ExpandableItemRow';

const items = [
  { id: '1', name: 'Monitor Dell 24"', qty: 2 },
  { id: '2', name: 'Keyboard Logitech', qty: 5 },
  { id: '3', name: 'Mouse Wireless', qty: 5 },
];

describe('ExpandableItemRow', () => {
  it('hides items by default', () => {
    render(<ExpandableItemRow items={items} />);
    expect(screen.queryByText(/Monitor Dell/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lihat 3 item/i })).toBeInTheDocument();
  });

  it('shows items when toggled', async () => {
    const user = userEvent.setup();
    render(<ExpandableItemRow items={items} />);
    await user.click(screen.getByRole('button', { name: /lihat 3 item/i }));
    expect(screen.getByText(/Monitor Dell 24"/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard Logitech/i)).toBeInTheDocument();
    expect(screen.getByText(/Mouse Wireless/i)).toBeInTheDocument();
    expect(screen.getAllByText(/qty/i).length).toBe(3);
  });

  it('shows empty state when items are []', () => {
    render(<ExpandableItemRow items={[]} />);
    expect(screen.getByText(/belum ada item/i)).toBeInTheDocument();
  });
});
