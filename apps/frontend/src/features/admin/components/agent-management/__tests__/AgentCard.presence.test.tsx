import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const socket = {
    connected: false,
    on: vi.fn(() => socket),
    off: vi.fn(() => socket),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

const { usePresenceStore } = await import('@/hooks/usePresence');
const { AgentCard } = await import('../AgentCard');

/** Busy on paper, but nobody is connected — the case that used to render green. */
const busyAgent = {
    id: 'agent-spj',
    fullName: 'Agent SPJ',
    email: 'spj@example.com',
    role: 'AGENT',
    openTickets: 2,
    inProgressTickets: 3,
    resolvedThisWeek: 1,
    resolvedThisMonth: 4,
    resolvedTotal: 9,
    slaCompliance: 95,
};

const renderCard = () => render(
    <AgentCard agent={busyAgent as any} onView={vi.fn()} onSelect={vi.fn()} isSelected={false} />,
);

describe('AgentCard presence indicator', () => {
    beforeEach(() => {
        usePresenceStore.setState({ onlineUserIds: [] });
    });

    it('stays offline for an agent holding in-progress tickets but not connected', () => {
        renderCard();
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Agent SPJ is offline');
    });

    it('turns online only when the roster contains the agent', () => {
        usePresenceStore.setState({ onlineUserIds: ['agent-spj'] });
        renderCard();
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Agent SPJ is online');
    });

    it('reports workload in words instead of colouring the dot', () => {
        renderCard();
        expect(screen.getByText('3 in progress')).toBeInTheDocument();
    });
});
