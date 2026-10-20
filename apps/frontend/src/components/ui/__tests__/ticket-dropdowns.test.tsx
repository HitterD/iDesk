import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomDropdown, PriorityDropdown, StatusDropdown } from '@/features/ticket-board/components/TicketDropdowns';

const manyOptions = Array.from({ length: 9 }, (_, i) => ({ value: `V${i}`, label: `Opsi ${i}` }));

describe('ticket dropdown contracts', () => {
    it('keeps ALL/empty mapping and custom icon while using the shared picker', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<CustomDropdown value="TODO" onChange={onChange} placeholder="Status tiket"
            options={[{ value: 'ALL', label: 'Semua' }, { value: 'TODO', label: 'Open' }]} />);
        const trigger = screen.getByRole('button', { name: 'Status tiket: Open' });
        expect(trigger).toHaveClass('ticket-pill');
        expect(trigger.querySelector('.lucide-funnel')).toBeInTheDocument();
        await user.click(trigger);
        await user.click(screen.getByRole('option', { name: 'Semua' }));
        expect(onChange).toHaveBeenCalledWith('');
    });

    it('exposes the current filter value in the accessible name, falling back to placeholder', () => {
        const { rerender } = render(<CustomDropdown value="" onChange={() => {}} placeholder="All Status"
            options={[{ value: 'ALL', label: 'All Status' }, { value: 'TODO', label: 'Open' }]} />);
        expect(screen.getByRole('button', { name: 'All Status: All Status' })).toBeInTheDocument();
        rerender(<CustomDropdown value="UNKNOWN" onChange={() => {}} placeholder="All Status"
            options={[{ value: 'TODO', label: 'Open' }]} />);
        expect(screen.getByRole('button', { name: 'All Status' })).toBeInTheDocument();
    });

    it('shows search only when there are more than 8 options', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<CustomDropdown value="" onChange={() => {}} placeholder="Status"
            options={manyOptions.slice(0, 8)} />);
        await user.click(screen.getByRole('button', { name: 'Status' }));
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        unmount();
        render(<CustomDropdown value="" onChange={() => {}} placeholder="Status" options={manyOptions} />);
        await user.click(screen.getByRole('button', { name: 'Status' }));
        expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'Cari…');
    });

    it('preserves priority callbacks, excludes system priorities and keeps locks readonly', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<PriorityDropdown value="MEDIUM" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-blue');
        await user.click(screen.getByRole('button'));
        expect(screen.queryByRole('option', { name: 'Hardware Installation' })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Oracle/K2' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('option', { name: 'Blocker (Critical)' }));
        expect(onChange).toHaveBeenCalledWith('CRITICAL');
        rerender(<PriorityDropdown value="HIGH" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-amber');
        rerender(<PriorityDropdown value="HARDWARE_INSTALLATION" onChange={onChange} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('Hardware')).toHaveClass('ticket-pill');
        rerender(<PriorityDropdown value="LOW" onChange={onChange} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('does not fire priority/status onChange when the current value is re-selected', async () => {
        const user = userEvent.setup();
        const onPriority = vi.fn();
        const onStatus = vi.fn();
        render(<><PriorityDropdown value="MEDIUM" onChange={onPriority} />
            <StatusDropdown value="IN_PROGRESS" onChange={onStatus} /></>);
        const priority = screen.getByRole('button', { name: /^Prioritas:/ });
        await user.click(priority);
        await user.click(screen.getByRole('option', { name: 'Normal (Moderate)' }));
        await waitFor(() => expect(priority).toHaveAttribute('aria-expanded', 'false'));
        const status = screen.getByRole('button', { name: /^Status:/ });
        await user.click(status);
        await user.click(screen.getByRole('option', { name: 'In Progress' }));
        await waitFor(() => expect(status).toHaveAttribute('aria-expanded', 'false'));
        expect(onPriority).not.toHaveBeenCalled();
        expect(onStatus).not.toHaveBeenCalled();
    });

    it('keeps non-selectable status restrictions and renders disabled status without arrow', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(<StatusDropdown value="IN_PROGRESS" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-navy');
        await user.click(screen.getByRole('button'));
        expect(screen.queryByRole('option', { name: 'Closed' })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Cancelled' })).not.toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Waiting Vendor' }).querySelector('svg')).toBeInTheDocument();
        await user.click(screen.getByRole('option', { name: 'Waiting Vendor' }));
        expect(onChange).toHaveBeenCalledWith('WAITING_VENDOR');
        rerender(<StatusDropdown value="TODO" onChange={onChange} />);
        expect(screen.getByRole('button')).toHaveClass('ticket-tone-blue');
        rerender(<StatusDropdown value="CLOSED" onChange={onChange} disabled />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByText('Closed').closest('span')).toHaveClass('ticket-pill');
        expect(document.querySelector('.lucide-chevron-down')).not.toBeInTheDocument();
    });
});
