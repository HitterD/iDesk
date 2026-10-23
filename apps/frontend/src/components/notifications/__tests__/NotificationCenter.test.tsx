import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../DesktopAppDownloadBanner', () => ({ DesktopAppDownloadBanner: () => null }));
vi.mock('../BrowserNotificationStatus', () => ({ BrowserNotificationStatus: () => null }));
const now = new Date().toISOString();
const base = {
    activeTab: 'all', setActiveTab: vi.fn(), readFilter: 'all', setReadFilter: vi.fn(), searchQuery: '', setSearchQuery: vi.fn(),
    isSelectionMode: false, setIsSelectionMode: vi.fn(), selectedIds: new Set<string>(), currentPage: 1, setCurrentPage: vi.fn(), pageSize: 20,
    soundEnabled: true, total: 2, isLoading: false, isFetching: false,
    notifications: [
        { id: 'n1', type: 'SLA_BREACHED', category: 'CATEGORY_TICKET', title: 'SLA terlewati', message: '#181026 · Blocker', isRead: false, requiresAcknowledge: true, createdAt: now },
        { id: 'n2', type: 'ZOOM_BOOKING_REMINDER', category: 'CATEGORY_ZOOM', title: 'Meeting dimulai', message: 'Zoom 3', isRead: true, createdAt: now },
    ],
    categoryCounts: { CATEGORY_TICKET: 1, CATEGORY_RENEWAL: 0, CATEGORY_HARDWARE: 0, CATEGORY_ZOOM: 0, CATEGORY_EFORM: 0 },
    totalCategoryCounts: { CATEGORY_TICKET: 4, CATEGORY_RENEWAL: 0, CATEGORY_HARDWARE: 0, CATEGORY_ZOOM: 2, CATEGORY_EFORM: 0 },
    markAllAsReadMutation: { mutate: vi.fn(), isPending: false },
    handleToggleSelect: vi.fn(), handleSelectAll: vi.fn(), handleBulkDelete: vi.fn(), handleBulkMarkAsRead: vi.fn(),
    handleMarkAsRead: vi.fn(), handleDelete: vi.fn(), toggleSound: vi.fn(), handleViewDetails: vi.fn(),
    unacknowledgedCriticalCount: 1, handleAcknowledge: vi.fn(), isAcknowledgePending: false,
};
let state = { ...base };
vi.mock('../../../features/notifications/hooks/useNotificationCenter', () => ({ useNotificationCenter: () => state }));

const { NotificationCenter } = await import('../NotificationCenter');
const renderIt = () => render(<MemoryRouter><NotificationCenter /></MemoryRouter>);

describe('NotificationCenter (round-2 layout)', () => {
    beforeEach(() => { state = { ...base, selectedIds: new Set() }; vi.clearAllMocks(); });

    it('shows category stat cards with unread / total, critical banner and Hari ini group', () => {
        renderIt();
        expect(screen.getByRole('heading', { level: 1, name: 'Notification Center' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tiket: 1 belum dibaca dari 4' })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('1 notifikasi kritis belum dikonfirmasi');
        expect(screen.getByText('Hari ini')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Buka Zoom' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Riwayat Notifikasi/ })).toHaveAttribute('href', '/notifications/history');
    });

    it('row actions are siblings of the open button and call the real handlers', async () => {
        renderIt();
        const row = screen.getByText('SLA terlewati').closest('.mg-notif') as HTMLElement;
        const open = within(row).getByRole('button', { name: /SLA terlewati/ });
        expect(within(open).queryByRole('button')).toBeNull();
        await userEvent.click(within(row).getByRole('button', { name: 'Tandai dibaca' }));
        expect(base.handleMarkAsRead).toHaveBeenCalledWith('n1', expect.anything());
        await userEvent.click(within(row).getByRole('button', { name: 'Acknowledge' }));
        expect(base.handleAcknowledge).toHaveBeenCalledWith('n1');
        await userEvent.click(open);
        expect(base.handleViewDetails).toHaveBeenCalled();
    });

    it('selection mode shows checkboxes and the bulk bar', async () => {
        state = { ...base, isSelectionMode: true, selectedIds: new Set(['n2']) };
        renderIt();
        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
        const bar = screen.getByRole('toolbar', { name: 'Aksi notifikasi terpilih' });
        expect(bar).toHaveTextContent('1 dipilih');
        await userEvent.click(within(bar).getByRole('button', { name: /Hapus/ }));
        expect(base.handleBulkDelete).toHaveBeenCalled();
    });
});
