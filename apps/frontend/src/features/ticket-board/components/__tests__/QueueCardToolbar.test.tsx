import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueueCardToolbar } from '../QueueCardToolbar';

const base = { sortBy: 'createdAt' as const, sortOrder: 'DESC' as const, onSort: vi.fn(),
    canEdit: true, ticketCount: 2, isAllSelected: false, isIndeterminate: false, onSelectAll: vi.fn() };

describe('QueueCardToolbar', () => {
    it('uses the existing sort callback for key and direction, without its own sorting state', () => {
        const onSort = vi.fn();
        render(<QueueCardToolbar {...base} onSort={onSort} />);
        fireEvent.change(screen.getByLabelText('Urutkan tiket'), { target: { value: 'priority' } });
        expect(onSort).toHaveBeenLastCalledWith('priority');
        fireEvent.click(screen.getByRole('button', { name: 'Ubah arah urutan: menurun' }));
        expect(onSort).toHaveBeenLastCalledWith('createdAt');
    });
    it('selects the loaded rows through the existing callback and reflects partial selection', () => {
        const onSelectAll = vi.fn();
        render(<QueueCardToolbar {...base} isIndeterminate onSelectAll={onSelectAll} />);
        expect(screen.getByRole('checkbox', { name: 'Pilih semua tiket di halaman ini' })).toHaveProperty('indeterminate', true);
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onSelectAll).toHaveBeenCalledWith(true);
    });
    it('keeps sorting available but disables bulk selection when no tickets are loaded', () => {
        render(<QueueCardToolbar {...base} ticketCount={0} />);
        expect(screen.getByLabelText('Urutkan tiket')).toBeEnabled();
        expect(screen.getByRole('checkbox')).toBeDisabled();
    });
    it('does not expose bulk selection to readonly roles', () => {
        render(<QueueCardToolbar {...base} canEdit={false} />);
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.getByLabelText('Urutkan tiket')).toBeEnabled();
    });
});
