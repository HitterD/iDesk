import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { RequestTable } from '../list/RequestTable';
import type { HardwareRequest } from '../../types';

vi.mock('../list/RequestRowDrawer', () => ({
    RequestRowDrawer: ({ r }: { r: HardwareRequest }) => <a href={`/hardware-requests/${r.id}`}>Buka detail lengkap</a>,
}));

const row = {
    id: 'hr1', requestNumber: 'HR-2610-0031', requesterId: 'u1', requester: { id: 'u1', fullName: 'Nur Ayni' },
    siteId: 's1', site: { id: 's1', name: 'SPJ' }, justification: 'Printer rusak', status: 'UNDER_REVIEW', version: 1,
    items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
} as unknown as HardwareRequest;

describe('RequestTable disclosure', () => {
    it('toggles the drawer from a disclosure button; the drawer is not nested in a link role', () => {
        render(<MemoryRouter><RequestTable rows={[row]} /></MemoryRouter>);

        expect(screen.queryByRole('link', { name: /HR-2610-0031/ })).not.toBeInTheDocument();
        const toggle = screen.getByRole('button', { name: /HR-2610-0031/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        const table = screen.getByRole('table', { name: 'Daftar hardware request' });
        expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
        expect(within(table).getAllByRole('cell')).toHaveLength(7);
        expect(toggle.closest('[role="cell"]')).not.toBeNull();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const drawer = screen.getByRole('region', { name: 'Detail HR-2610-0031' });
        expect(toggle).toHaveAttribute('aria-controls', drawer.id);
        expect(within(drawer).getByRole('link', { name: 'Buka detail lengkap' })).toBeInTheDocument();
        // The drawer is a sibling of the row, so its link is never inside the toggle.
        expect(toggle.contains(drawer)).toBe(false);

        fireEvent.click(toggle);
        expect(screen.queryByRole('region', { name: 'Detail HR-2610-0031' })).not.toBeInTheDocument();
    });
});
