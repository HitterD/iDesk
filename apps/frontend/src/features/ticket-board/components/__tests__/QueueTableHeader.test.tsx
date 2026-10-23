import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueueTableHeader } from '../QueueTableHeader';
import { CustomDropdown } from '../TicketDropdowns';

describe('QueueTableHeader (mockup columns)', () => {
    const renderHeader = (onSort = vi.fn()) => render(
        <QueueTableHeader showSiteColumn canEdit isAllSelected={false} isIndeterminate={false}
            onSelectAll={vi.fn()} sortBy="createdAt" sortOrder="DESC" onSort={onSort} />,
    );

    it.each([true, false])('aligns the created-date header in a separate final column (site: %s)', (showSiteColumn) => {
        render(<QueueTableHeader showSiteColumn={showSiteColumn} canEdit isAllSelected={false} isIndeterminate={false}
            onSelectAll={vi.fn()} sortBy="createdAt" sortOrder="DESC" onSort={vi.fn()} />);
        const row = screen.getByRole('row', { name: 'Kolom tabel' });
        expect(row.lastElementChild).toBe(screen.getByRole('button', { name: 'Urutkan menurut Dibuat, menurun' }));
        expect(row.children).toHaveLength(showSiteColumn ? 9 : 8);
    });

    it('uses the mockup sentence-case columns including the created date', () => {
        renderHeader();
        const row = screen.getByRole('row', { name: 'Kolom tabel' });
        expect(row).toHaveTextContent(/^Tiket.*Prioritas.*Site.*Status.*Pemohon.*PIC.*SLA.*Dibuat$/);
        expect(row).not.toHaveTextContent(/Created|Target Date|Requester|Assigned To/);
    });

    it('keeps sorting by created date reachable from the header', () => {
        const onSort = vi.fn();
        renderHeader(onSort);
        fireEvent.click(screen.getByRole('button', { name: 'Urutkan menurut Dibuat, menurun' }));
        fireEvent.click(screen.getByRole('button', { name: 'Urutkan menurut Prioritas' }));
        expect(onSort.mock.calls).toEqual([['createdAt'], ['priority']]);
    });
});

describe('CustomDropdown filter pop', () => {
    it('renders the mockup "Status Semua" pop with a key: value accessible name', () => {
        render(<CustomDropdown value="" onChange={vi.fn()} placeholder="Semua" filterKey="Status"
            options={[{ value: 'ALL', label: 'Semua' }, { value: 'TODO', label: 'Open' }]} />);
        const trigger = screen.getByRole('button', { name: 'Status: Semua' });
        expect(trigger).toHaveClass('queue-pop');
        expect(trigger).toHaveTextContent('StatusSemua');
    });
});
