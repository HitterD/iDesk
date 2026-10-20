import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDropdown, PriorityDropdown, StatusDropdown } from '@/features/ticket-board/components/TicketDropdowns';

globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};

describe('ticket dropdown contracts', () => {
    it('keeps ALL/empty mapping and custom icon while using the shared picker', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<CustomDropdown value="TODO" onChange={onChange} placeholder="Status tiket"
            options={[{ value: 'ALL', label: 'Semua' }, { value: 'TODO', label: 'Open' }]} />);
        const trigger = screen.getByRole('button', { name: 'Status tiket' });
        expect(trigger).toHaveClass('ticket-pill');
        expect(trigger.querySelector('.lucide-funnel')).toBeInTheDocument();
        await user.click(trigger);
        await user.click(screen.getByRole('option', { name: 'Semua' }));
        expect(onChange).toHaveBeenCalledWith('');
    });

    it('preserves priority callbacks, excludes system priorities and keeps locks readonly', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<PriorityDropdown value="MEDIUM" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-amber');
        await user.click(screen.getByRole('button'));
        expect(screen.queryByRole('option', { name: 'Hardware Installation' })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Oracle/K2' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('option', { name: 'Blocker (Critical)' }));
        expect(onChange).toHaveBeenCalledWith('CRITICAL');
        rerender(<PriorityDropdown value="HARDWARE_INSTALLATION" onChange={onChange} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('Hardware')).toHaveClass('ticket-pill');
        rerender(<PriorityDropdown value="LOW" onChange={onChange} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('keeps non-selectable status restrictions and renders disabled status without arrow', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<StatusDropdown value="IN_PROGRESS" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-navy');
        await user.click(screen.getByRole('button'));
        expect(screen.queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Cancelled' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('option', { name: 'Waiting Vendor' }));
        expect(onChange).toHaveBeenCalledWith('WAITING_VENDOR');
        rerender(<StatusDropdown value="CLOSED" onChange={onChange} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('Closed').closest('span')).toHaveClass('ticket-pill');
        expect(document.querySelector('.lucide-chevron-down')).not.toBeInTheDocument();
    });
});
