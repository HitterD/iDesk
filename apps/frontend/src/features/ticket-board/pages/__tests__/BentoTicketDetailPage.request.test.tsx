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


const REQUEST_TICKET = { ...initialTicket, ticketType: 'HARDWARE_REQUEST', title: 'Hardware Request HR-2026-0042' };
const FLOW = {
    kind: 'HARDWARE', phase: 'review', phaseLabel: 'Review IT', route: null, managerId: null, gmId: null, hardwareSource: null, returnedReason: null,
    rescheduleCount: 0, documentVersion: 1, revisions: [], viewerRoleInFlow: 'ICT',
    hardware: { requestId: 'hr-1', requestNumber: 'HR-2026-0042', division: 'GA', recipients: [], items: [], schedule: null, assets: [] },
};

function stubApi(ticket: Record<string, unknown>) {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === `/tickets/${initialTicket.id}`) return Promise.resolve({ data: ticket });
        if (url === `/request-flow/${initialTicket.id}`) return Promise.resolve({ data: FLOW });
        if (url === '/ticket-attributes') return Promise.resolve({ data: { categories: [], priorities: [], devices: [], software: [] } });
        if (url === '/sla-config') return Promise.resolve({ data: [] });
        if (url.includes('/requester-device')) return Promise.resolve({ data: { requesterIp: null, requesterHostname: null, recentDevices: [] } });
        return Promise.resolve({ data: [] });
    });
}

describe('BentoTicketDetailPage request ticket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.socketHandlers.clear();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
    });

    it('a Hardware ticket shows the next-step bar and its header tag; the flow is loaded', async () => {
        stubApi(REQUEST_TICKET);
        renderDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
        expect(await screen.findByRole('button', { name: 'Tinjau sekarang' })).toBeInTheDocument();
        expect(screen.getByText('Hardware Request')).toBeInTheDocument();
        expect(vi.mocked(api.get)).toHaveBeenCalledWith(`/request-flow/${initialTicket.id}`);
    });

    it('an ordinary IT ticket never asks for a request flow', async () => {
        stubApi(initialTicket);
        renderDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
        await screen.findAllByText('Error sistem saat input data');
        expect(vi.mocked(api.get).mock.calls.some(([url]) => String(url).startsWith('/request-flow/'))).toBe(false);
        expect(screen.queryByRole('button', { name: 'Tinjau sekarang' })).toBeNull();
    });

    it('a request ticket has no generic "Batalkan tiket": withdrawing goes through the request flow', async () => {
        stubApi(REQUEST_TICKET);
        renderDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
        await screen.findByRole('button', { name: 'Tinjau sekarang' });
        expect(screen.queryByTitle('Batalkan tiket ini')).toBeNull();
        expect(screen.queryByText('Batalkan tiket')).toBeNull();
    });

    it('an ordinary IT ticket keeps its cancel action', async () => {
        stubApi(initialTicket);
        renderDetailPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
        await screen.findAllByText('Error sistem saat input data');
        expect(screen.queryByTitle('Batalkan tiket ini') ?? screen.queryAllByText('Batalkan tiket')[0] ?? null).not.toBeNull();
    });
});
