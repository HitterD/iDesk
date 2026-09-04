import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientTicketDetailPage } from '../ClientTicketDetailPage';

const mockTicket = {
    id: 'ticket-123',
    ticketNumber: '190826-GEN-0005',
    title: 'Password terkunci',
    description: 'Gagal login berkali-kali. Mohon dibantu reset.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'HARDWARE',
    device: 'Laptop',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
    slaTarget: '2026-08-30T10:00:00.000Z',
    user: {
        id: 'user-1',
        fullName: 'User SPJ',
        email: 'user.spj@desk.com',
    },
    assignedTo: {
        id: 'agent-1',
        fullName: 'Yudi Arta Trirensila',
        email: 'yudi.arta@kapalapi.co.id',
        site: {
            id: 'site-1',
            name: 'Site SPJ',
            code: 'SPJ',
        },
    },
    messages: [
        {
            id: 'm-1',
            content: 'Gagal login berkali-kali. Mohon dibantu reset.',
            createdAt: '2026-08-19T08:00:00.000Z',
            isSystemMessage: false,
            sender: {
                id: 'user-1',
                fullName: 'User SPJ',
            },
        },
    ],
};

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/tickets/ticket-123') {
                return Promise.resolve({ data: mockTicket });
            }
            return Promise.resolve({ data: {} });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'USER', fullName: 'User SPJ' },
    }),
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketSocket: () => ({
        isConnected: true,
        typingUsers: {},
        sendTypingStart: vi.fn(),
        sendTypingStop: vi.fn(),
    }),
}));

vi.mock('@/lib/socket', () => ({
    useSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
        isConnected: true,
    }),
}));

describe('ClientTicketDetailPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
    });

    it('renders ticket header with badges, full chat room, and Bento properties sidebar', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/tickets/ticket-123']}>
                    <Routes>
                        <Route path="/client/tickets/:id" element={<ClientTicketDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Wait for ticket to load
        await waitFor(() => {
            expect(screen.getAllByRole('heading', { name: 'Password terkunci' }).length).toBeGreaterThan(0);
        });

        // Header Badges & Actions
        expect(screen.getByText('#190826-GEN-0005')).toBeInTheDocument();
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
        expect(screen.getAllByText('HARDWARE').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Cancel Ticket').length).toBeGreaterThan(0);

        // Tabs
        expect(screen.getAllByText('Conversation').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Activity Logs').length).toBeGreaterThan(0);

        // Chat genesis report & messages
        expect(screen.getByText('Original Issue Report')).toBeInTheDocument();
        expect(screen.getAllByText(/Gagal login berkali-kali/i).length).toBeGreaterThan(0);

        // Assigned Agent in Bento Sidebar
        expect(screen.getByText('Yudi Arta Trirensila')).toBeInTheDocument();
        expect(screen.getByText('IT Support Specialist')).toBeInTheDocument();
        expect(screen.getByText('yudi.arta@kapalapi.co.id')).toBeInTheDocument();

        // Bento Ticket Properties
        expect(screen.getByText('Ticket Properties')).toBeInTheDocument();
        expect(screen.getByText('SLA & Tracking')).toBeInTheDocument();
    });
});
