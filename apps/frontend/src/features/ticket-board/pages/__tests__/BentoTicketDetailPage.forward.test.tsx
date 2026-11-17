import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';
import { BentoTicketDetailPage } from '../BentoTicketDetailPage';

type SocketListener = (...args: unknown[]) => void;

const mocks = vi.hoisted(() => {
    const socketHandlers = new Map<string, Set<SocketListener>>();
    const singletonSocket = {
        id: 'sock-1',
        connected: true,
        on: (ev: string, fn: SocketListener) => {
            if (!socketHandlers.has(ev)) socketHandlers.set(ev, new Set());
            socketHandlers.get(ev)!.add(fn);
        },
        off: (ev: string, fn: SocketListener) => {
            socketHandlers.get(ev)?.delete(fn);
        },
        emit: vi.fn(),
        trigger: (ev: string, ...args: unknown[]) => {
            socketHandlers.get(ev)?.forEach((fn) => fn(...args));
        },
    };
    return {
        socketHandlers,
        singletonSocket,
        user: { id: 'bagas-1', fullName: 'Bagastyo', role: 'AGENT_OPERATIONAL_SUPPORT', siteId: 'spj' },
    };
});

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: (selector?: (s: { user: typeof mocks.user }) => unknown) => {
        const state = { user: mocks.user };
        return selector ? selector(state) : state;
    },
}));

vi.mock('@/lib/socket', () => ({
    useSocket: () => ({
        isConnected: true,
        socket: mocks.singletonSocket,
    }),
}));

vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

const initialTicket = {
    id: '4db3ff1a-1ba2-4a64-bd77-3312f9a4dcc9',
    ticketNumber: '171126-GA-0009',
    title: 'Error sistem saat input data',
    description: 'Proses berhenti karena error. Nama sistem: Villa Reservation',
    status: 'TODO',
    priority: 'HIGH',
    category: 'SOFTWARE',
    handlingTeam: 'OPS_SUPPORT',
    siteId: 'spj',
    site: { id: 'spj', code: 'SPJ', name: 'Sepanjang' },
    createdAt: '2026-11-17T02:20:00.000Z',
    updatedAt: '2026-11-17T02:21:00.000Z',
    slaTarget: '2026-11-23T02:20:00.000Z',
    slaStartedAt: '2026-11-17T02:20:00.000Z',
    viewerAccess: 'handler',
    user: {
        id: 'amalia-1',
        fullName: 'Amalia Melany,,spsi.',
        email: 'akuamaliamelany@gmail.com',
        department: { name: 'GA MANAGEMENT' },
    },
    assignedTo: { id: 'yudi-1', fullName: 'Yudi Arta Trirensita' },
    participants: [],
    messages: [
        {
            id: 'msg-init',
            content: 'Proses berhenti karena error. Nama sistem: Villa Reservation',
            createdAt: '2026-11-17T02:20:00.000Z',
            isSystemMessage: false,
            attachments: [],
            sender: { id: 'amalia-1', fullName: 'Amalia Melany,,spsi.', role: 'USER' },
        },
    ],
};

function renderDetailPage(qc: QueryClient) {
    return render(
        <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={[`/tickets/${initialTicket.id}`]}>
                <FeatureErrorBoundary featureName="Ticket Detail">
                    <Routes>
                        <Route path="/tickets/:id" element={<BentoTicketDetailPage />} />
                    </Routes>
                </FeatureErrorBoundary>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('BentoTicketDetailPage forward regression', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.socketHandlers.clear();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        window.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    });

    it('opens forward dialog without crashing when /sites/active is uncached and completes forwarding smoothly', async () => {
        let resolveSites!: (v: unknown) => void;
        let forwarded = false;

        vi.mocked(api.get).mockImplementation((url: string) => {
            if (url === `/tickets/${initialTicket.id}`) {
                if (!forwarded) return Promise.resolve({ data: initialTicket });
                return Promise.resolve({
                    data: {
                        ...initialTicket,
                        handlingTeam: 'ORACLE_DEV',
                        ticketType: 'ORACLE_REQUEST',
                        category: 'ORACLE_REQUEST',
                        assignedTo: null,
                        viewerAccess: 'requester',
                        messages: [
                            ...initialTicket.messages,
                            {
                                id: 'msg-fwd',
                                content: 'Ticket forwarded from OPS_SUPPORT to ORACLE_DEV by Bagastyo. Reason: Terkait aplikasi Oracle / K2\nSLA reset. Target: 2026-11-23T02:22:00.000Z (2160 minutes for HIGH)',
                                createdAt: '2026-11-17T02:22:00.000Z',
                                isSystemMessage: true,
                                attachments: [],
                                sender: { id: 'bagas-1', fullName: 'Bagastyo', role: 'AGENT_OPERATIONAL_SUPPORT' },
                            },
                        ],
                    },
                });
            }
            if (url === '/sites/active') return new Promise((r) => { resolveSites = r; });
            if (url === '/ticket-attributes') return Promise.resolve({ data: { categories: [], priorities: [], devices: [], software: [] } });
            if (url === '/sla-config') return Promise.resolve({ data: [] });
            if (url.startsWith('/users/agents')) return Promise.resolve({ data: [] });
            if (url.includes('/reminders')) return Promise.resolve({ data: { data: [] } });
            if (url.includes('/hardware-requests')) return Promise.resolve({ data: { data: [] } });
            if (url.includes('/eform-requests')) return Promise.resolve({ data: { data: [] } });
            if (url.includes('/requester-device')) return Promise.resolve({ data: { requesterIp: '10.10.24.80', requesterHostname: null, recentDevices: [] } });
            if (url.includes('/kb-suggestions')) return Promise.resolve({ data: [] });
            if (url.includes('/ticket-notes')) return Promise.resolve({ data: [] });
            if (url.includes('/mention-candidates')) return Promise.resolve({ data: [] });
            return Promise.resolve({ data: [] });
        });
        vi.mocked(api.post).mockImplementation((url: string) => {
            if (url.endsWith('/forward')) {
                forwarded = true;
                mocks.singletonSocket.trigger('ticket:newMessage', {
                    ticketId: initialTicket.id,
                    message: {
                        id: 'msg-fwd',
                        content: 'Ticket forwarded from OPS_SUPPORT to ORACLE_DEV by Bagastyo. Reason: Terkait aplikasi Oracle / K2\nSLA reset. Target: 2026-11-23T02:22:00.000Z (2160 minutes for HIGH)',
                        createdAt: '2026-11-17T02:22:00.000Z',
                        isSystemMessage: true,
                        isDeleted: false,
                        deletedByAdmin: false,
                        sender: { id: 'bagas-1', fullName: 'Bagastyo', role: 'AGENT_OPERATIONAL_SUPPORT' },
                    },
                });
                mocks.singletonSocket.trigger('ticket:updated', { ticketId: initialTicket.id });
                return Promise.resolve({ data: {} });
            }
            return Promise.resolve({ data: {} });
        });

        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        renderDetailPage(qc);

        const forwardBtn = await screen.findByRole('button', { name: 'Teruskan' });
        fireEvent.click(forwardBtn);

        const submitBtn = await screen.findByRole('button', { name: 'Teruskan tiket' });
        expect(screen.queryByText(/Ticket Detail Error/i)).not.toBeInTheDocument();

        resolveSites({
            data: [
                { id: 'spj', code: 'SPJ', name: 'Sepanjang', isActive: true, handledBySiteId: null },
                { id: 'krw', code: 'KRW', name: 'Karawang', isActive: true, handledBySiteId: null },
            ],
        });
        await waitFor(() => {
            expect(screen.getByText(/Teruskan ke IT Support site lain/)).toBeInTheDocument();
        });

        fireEvent.click(submitBtn);
        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(`/tickets/${initialTicket.id}/forward`, {
                targetTeam: 'ORACLE_DEV',
                reason: 'Terkait aplikasi Oracle / K2',
            });
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.queryByText(/Ticket Detail Error/i)).not.toBeInTheDocument();
    });
});
