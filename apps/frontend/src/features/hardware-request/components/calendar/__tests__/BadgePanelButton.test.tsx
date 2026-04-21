import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BadgePanelButton } from '../BadgePanelButton';

describe('BadgePanelButton', () => {
  it('renders label and count', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={() => {}}><div>content</div></BadgePanelButton>);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('hides children when closed', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={() => {}}><div>Panel content</div></BadgePanelButton>);
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });
  it('shows children when open', () => {
    render(<BadgePanelButton label="Today" count={3} variant="green" open={true} onToggle={() => {}}><div>Panel content</div></BadgePanelButton>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });
  it('calls onToggle on click', async () => {
    const onToggle = vi.fn();
    render(<BadgePanelButton label="Today" count={3} variant="green" open={false} onToggle={onToggle}><div>x</div></BadgePanelButton>);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});