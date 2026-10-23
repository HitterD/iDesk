import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketSidebar } from '../TicketSidebar';
import { StatusChangeCancelledError } from '../statusChangeCancelled';
import type { TicketDetail } from '../types';

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'agent-1', role: 'AGENT', fullName: 'RM BAGASTYO' } }),
}));

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const agents = [
    { id: 'agent-1', fullName: 'RM BAGASTYO', email: 'bagas@idesk.test', role: 'AGENT', site: { code: 'SPJ' } },
    { id: 'agent-2', fullName: 'Yudi Arta Trirensila', email: 'yudi@idesk.test', role: 'AGENT', site: { code: 'SPJ' } },
];

const baseTicket = {
    id: 't-1',
    ticketNumber: '201026-SPJ-0009',
    title: 'Printer macet',
    description: 'Kertas nyangkut',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    category: 'HARDWARE',
    device: '',
    createdAt: '2026-10-20T01:00:00Z',
    updatedAt: '2026-10-20T02:00:00Z',
    user: { id: 'user-1', fullName: 'Nofie Kullau', email: 'nofie@idesk.test' },
    assignedTo: { id: 'agent-2', fullName: 'Yudi Arta Trirensila', email: 'yudi@idesk.test' },
    participants: [],
    messages: [],
} as unknown as TicketDetail;

const handlers = () => ({
    onAssigneeChange: vi.fn(() => Promise.resolve()),
    onStatusChange: vi.fn(() => Promise.resolve()),
    onPriorityChange: vi.fn(() => Promise.resolve()),
    onCategoryChange: vi.fn(() => Promise.resolve()),
    onDeviceChange: vi.fn(() => Promise.resolve()),
});

const renderSidebar = (overrides: Partial<TicketDetail> = {}, cb = handlers()) => {
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <TicketSidebar
                ticket={{ ...baseTicket, ...overrides } as TicketDetail}
                agents={agents}
                slaConfigs={[]}
                attributes={{ categories: [], devices: [{ id: 'd-1', value: 'Laptop' }], software: [] }}
                {...cb}
            />
        </QueryClientProvider>,
    );
    return cb;
};

describe('TicketSidebar inspector', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders every editable property through the shared bubble pickers', () => {
        renderSidebar();
        for (const name of ['PIC: Yudi Arta Trirensila', 'Status: In Progress', 'Prioritas: Urgent (Major Impact)',
            'Kategori: Hardware', 'Perangkat: Tidak ada']) {
            expect(screen.getByRole('button', { name })).toHaveClass('ticket-pill', 'picker-trigger');
        }
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('locks a terminal ticket to readonly badges', () => {
        renderSidebar({ status: 'RESOLVED' });
        expect(screen.getByText('Terkunci')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^(PIC|Status|Prioritas|Kategori|Perangkat):/ })).not.toBeInTheDocument();
        expect(screen.getByText('Resolved').closest('.ticket-pill')).toBeInTheDocument();
    });

    it('shows a neutral readonly PIC label, not an action, when a locked ticket has no PIC', () => {
        renderSidebar({ status: 'CLOSED', assignedTo: undefined });
        expect(screen.getByText('Belum ada').closest('.ticket-pill')).toBeInTheDocument();
        expect(screen.queryByText('Pilih teknisi')).not.toBeInTheDocument();
    });

    it('locks the inspector for a requester-side viewer', () => {
        renderSidebar({ viewerAccess: 'requester' });
        expect(screen.queryByRole('button', { name: /^(PIC|Status|Prioritas|Kategori|Perangkat):/ })).not.toBeInTheDocument();
        expect(screen.getByText('In Progress').closest('.ticket-pill')).toBeInTheDocument();
    });

    it('restores the server status when the takeover is cancelled', async () => {
        const user = userEvent.setup();
        const cb = handlers();
        cb.onStatusChange.mockRejectedValueOnce(new StatusChangeCancelledError());
        renderSidebar({}, cb);
        await user.click(screen.getByRole('button', { name: 'Status: In Progress' }));
        await user.click(screen.getByRole('option', { name: 'Waiting Vendor' }));
        expect(cb.onStatusChange).toHaveBeenCalledWith('WAITING_VENDOR');
        expect(await screen.findByRole('button', { name: 'Status: In Progress' })).toBeInTheDocument();
    });

    it('routes RESOLVED through the resolve dialog with the note and files', async () => {
        const user = userEvent.setup();
        const cb = renderSidebar();
        await user.click(screen.getByRole('button', { name: 'Status: In Progress' }));
        await user.click(screen.getByRole('option', { name: 'Resolved' }));
        expect(cb.onStatusChange).not.toHaveBeenCalled();
        await user.type(screen.getByPlaceholderText(/Jelaskan tindakan teknis/), 'Roller diganti');
        await user.click(screen.getByRole('button', { name: /^Selesaikan tiket$/ }));
        await waitFor(() => expect(cb.onStatusChange).toHaveBeenCalledWith('RESOLVED', 'Roller diganti', []));
    });

    it('opens the grouped agent list for PIC and asks for a reason before reassigning', async () => {
        const user = userEvent.setup();
        renderSidebar();
        await user.click(screen.getByRole('button', { name: 'PIC: Yudi Arta Trirensila' }));
        const list = screen.getByRole('combobox', { name: 'Cari agent atau site…' }).closest('.agent-select-list') as HTMLElement;
        await user.click(within(list).getByRole('option', { name: /RM BAGASTYO/ }));
        expect(await screen.findByText('Alasan Pengalihan PIC')).toBeInTheDocument();
    });
});
