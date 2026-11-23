import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagerSidebar } from '../ManagerSidebar';

let waiting = 0;
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'm-1', role: 'MANAGER', fullName: 'Hendra' } }),
    performLogout: vi.fn(),
}));
vi.mock('@/hooks/usePermissions', () => ({ useMyPermissions: () => ({ data: { pageAccess: {} } }) }));
vi.mock('@/features/client/pages/ApprovalsPage', () => ({ useApprovals: () => ({ data: Array.from({ length: waiting }, (_, i) => ({ ticketId: `t-${i}` })) }) }));

afterEach(cleanup);
const renderSidebar = () => render(<MemoryRouter><ManagerSidebar /></MemoryRouter>);

describe('ManagerSidebar approvals', () => {
    it('has no Persetujuan item when nothing waits for the manager', () => {
        waiting = 0;
        renderSidebar();
        expect(screen.queryByRole('link', { name: /Persetujuan/ })).toBeNull();
    });

    it('shows Persetujuan with the count and links to the manager approvals page', () => {
        waiting = 2;
        renderSidebar();
        const link = screen.getByRole('link', { name: /Persetujuan/ });
        expect(link).toHaveAttribute('href', '/manager/approvals');
        expect(link).toHaveTextContent('2');
    });

    it('the old Hardware and E-Form menu items are gone', () => {
        waiting = 0;
        renderSidebar();
        expect(screen.queryByRole('link', { name: 'Hardware Request' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'E-Form Access' })).toBeNull();
    });
});
