vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketListRow, TicketRowData, Agent } from '../TicketListRow';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/TicketQuickPreview', () => ({
    TicketQuickPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Exercise the real priority/status bubbles, including terminal flame suppression.

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockTicket: TicketRowData = {
    id: 'ticket-1',
    ticketNumber: '190826-GEN-0005',
    title: 'Password terkunci',
    description: 'User cannot login',
    category: 'ACCOUNT',
    status: 'TODO',
    priority: 'MEDIUM',
    source: 'WEB',
    isOverdue: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: {
        id: 'user-1',
        fullName: 'User SPJ',
        department: { name: 'IT' },
    },
    assignedTo: {
        id: 'agent-1',
        fullName: 'BENY SAPUTRA, S.KOM',
    },
    site: {
        id: 'site-1',
        code: 'SPJ',
        name: 'Santos Premium Jaya',
    },
};

const mockAgents: Agent[] = [
    {
        id: 'agent-1',
        fullName: 'BENY SAPUTRA, S.KOM',
        email: 'beny@example.com',
        role: 'AGENT_OPERATIONAL_SUPPORT',
        site: { code: 'SPJ', name: 'Santos Premium Jaya' },
    },
    {
        id: 'agent-2',
        fullName: 'RM BAGASTYO ANGGORO INDRASTOTO',
        email: 'bagas@example.com',
        role: 'AGENT_OPERATIONAL_SUPPORT',
        site: { code: 'SPJ', name: 'Santos Premium Jaya' },
    },
];

describe('TicketListRow queue presentation contract', () => {
    const renderRow = (ticket: TicketRowData, canEdit = true) => render(
        <MemoryRouter>
            <TicketListRow ticket={ticket} index={0} showSiteColumn canEdit={canEdit}
                isSelected={false} agents={mockAgents} onSelect={vi.fn()}
                onUpdatePriority={vi.fn()} onUpdateStatus={vi.fn()} onAssign={vi.fn()} />
        </MemoryRouter>
    );

    it('presents editable PIC as named bubbles with carets, keeping real photographs', () => {
        const { container } = renderRow({ ...mockTicket,
            user: { ...mockTicket.user, avatarUrl: '/requester.jpg' },
            assignedTo: { ...mockTicket.assignedTo!, avatarUrl: '/agent.jpg' },
        });
        expect(screen.getAllByRole('button', { name: /Ganti PIC/ })).toHaveLength(2);
        screen.getAllByRole('button', { name: /Ganti PIC/ }).forEach((button) => {
            expect(button).toHaveClass('ticket-pill');
            expect(button.querySelector('.lucide-chevron-down')).not.toBeNull();
        });
        expect(container.querySelector('img[src="/requester.jpg"]')).not.toBeNull();
        expect(container.querySelector('img[src="/agent.jpg"]')).not.toBeNull();
        screen.getAllByText('SPJ').forEach((site) => {
            expect(site).toHaveClass('ticket-pill');
            expect(site.closest('button')).toBeNull();
            expect(site.querySelector('.lucide-chevron-down')).toBeNull();
        });
    });

    it('shows paused SLA on mobile even without a target date', () => {
        renderRow({ ...mockTicket, status: 'WAITING_VENDOR', slaTarget: undefined, slaRemainingMinutes: 90 });
        expect(screen.getAllByText('Paused · sisa 1h 30m')).toHaveLength(2);
        screen.getAllByLabelText('SLA Timer Paused').forEach((sla) => {
            expect(sla).toHaveClass('ticket-pill');
            expect(sla.closest('button')).toBeNull();
        });
    });

    it.each(['RESOLVED', 'CLOSED', 'CANCELLED'] as const)('does not flag %s as overdue', (status) => {
        const { container } = renderRow({ ...mockTicket, status, isOverdue: true });
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        expect(container.firstElementChild).not.toHaveClass('queue-row-flagged');
    });

    it('flags an active critical ticket with a left stripe', () => {
        const { container } = renderRow({ ...mockTicket, priority: 'CRITICAL' });
        expect(container.firstElementChild).toHaveClass('queue-row-flagged');
    });
});

describe('TicketListRow paused SLA', () => {
    it('passes remaining minutes to both mobile and desktop SLA cells', () => {
        render(
            <MemoryRouter>
                <TicketListRow
                    ticket={{ ...mockTicket, status: 'WAITING_VENDOR', slaTarget: '2026-10-20T05:00:00Z', slaRemainingMinutes: 120 }}
                    index={0} showSiteColumn={true} canEdit={true} isSelected={false}
                    agents={mockAgents} onSelect={vi.fn()} onUpdatePriority={vi.fn()}
                    onUpdateStatus={vi.fn()} onAssign={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.getAllByText('Paused · sisa 2h 0m')).toHaveLength(2);
    });

    it('shows a WAITING_VENDOR ticket as paused, never overdue, even when the server flags it overdue', () => {
        const { container } = render(
            <MemoryRouter>
                <TicketListRow
                    ticket={{ ...mockTicket, status: 'WAITING_VENDOR', isOverdue: true, slaTarget: '2026-10-20T05:00:00Z', slaRemainingMinutes: 120 }}
                    index={0} showSiteColumn={true} canEdit={true} isSelected={false}
                    agents={mockAgents} onSelect={vi.fn()} onUpdatePriority={vi.fn()}
                    onUpdateStatus={vi.fn()} onAssign={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.getAllByText('Paused · sisa 2h 0m')).toHaveLength(2);
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
        expect(container.querySelectorAll('.lucide-triangle-alert, .lucide-alert-triangle')).toHaveLength(0);
        expect(container.firstElementChild?.className).not.toContain('error-500');
    });

    it('still shows overdue for an active non-paused ticket', () => {
        render(
            <MemoryRouter>
                <TicketListRow
                    ticket={{ ...mockTicket, status: 'IN_PROGRESS', isOverdue: true, slaTarget: '2026-10-20T05:00:00Z' }}
                    index={0} showSiteColumn={true} canEdit={true} isSelected={false}
                    agents={mockAgents} onSelect={vi.fn()} onUpdatePriority={vi.fn()}
                    onUpdateStatus={vi.fn()} onAssign={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.getByText('Overdue')).toBeInTheDocument();
    });
});

describe('TicketListRow critical indicators', () => {
    it.each(['RESOLVED', 'CLOSED', 'CANCELLED'] as const)('hides flame for %s critical ticket', (status) => {
        const { container } = renderCriticalTicket(status);
        expect(container.querySelectorAll('.lucide-flame')).toHaveLength(0);
        expect(screen.queryByText('Critical')).not.toBeInTheDocument();
        expect(container.querySelectorAll('span.rounded-full[aria-hidden="true"].bg-red-500')).toHaveLength(0);
    });

    it.each(['TODO', 'IN_PROGRESS', 'WAITING_VENDOR'] as const)('shows flame for %s critical ticket', (status) => {
        const { container } = renderCriticalTicket(status);
        expect(container.querySelectorAll('.lucide-flame').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('Critical')).toBeInTheDocument();
    });
});

function renderCriticalTicket(status: TicketRowData['status']) {
    return render(
        <MemoryRouter>
            <TicketListRow
                ticket={{ ...mockTicket, priority: 'CRITICAL', status }}
                index={0}
                showSiteColumn={true}
                canEdit={true}
                isSelected={false}
                agents={mockAgents}
                onSelect={vi.fn()}
                onUpdatePriority={vi.fn()}
                onUpdateStatus={vi.fn()}
                onAssign={vi.fn()}
            />
        </MemoryRouter>
    );
}

describe('TicketListRow Assignee Popover', () => {
    it('renders assignee button and opens agent list and shows confirmation modal when reassigning', async () => {
        const onAssign = vi.fn();
        render(
            <MemoryRouter>
                <TicketListRow
                    ticket={mockTicket}
                    index={0}
                    showSiteColumn={true}
                    canEdit={true}
                    isSelected={false}
                    agents={mockAgents}
                    onSelect={vi.fn()}
                    onUpdatePriority={vi.fn()}
                    onUpdateStatus={vi.fn()}
                    onAssign={onAssign}
                />
            </MemoryRouter>
        );

        // Find the Assignee button containing 'BENY SAPUTRA, S.KOM'
        const assigneeButtons = screen.getAllByText('BENY SAPUTRA, S.KOM');
        expect(assigneeButtons.length).toBeGreaterThan(0);

        // Click the desktop button
        const button = assigneeButtons[0].closest('button');
        expect(button).toBeInTheDocument();
        if (button) {
            fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
            fireEvent.click(button);
        }

        // Check if agent list is now displayed in popover
        const agentOption = await screen.findByText('RM BAGASTYO ANGGORO INDRASTOTO');
        expect(agentOption).toBeInTheDocument();
        expect(screen.getByText('Unassigned (Lepas Penugasan)')).toBeInTheDocument();

        // Click to select new agent -> triggers reassign confirmation dialog
        fireEvent.click(agentOption);

        // Confirmation modal should appear
        const confirmBtn = await screen.findByText('Konfirmasi Pengalihan');
        expect(confirmBtn).toBeInTheDocument();

        // Click confirm in modal
        fireEvent.click(confirmBtn);
        expect(onAssign).toHaveBeenCalledWith('ticket-1', 'agent-2', 'Beban Kerja Penuh / Overload');
    });

    it('directly assigns without modal when ticket is unassigned', async () => {
        const onAssign = vi.fn();
        const unassignedTicket: TicketRowData = {
            ...mockTicket,
            assignedTo: undefined,
        };

        render(
            <MemoryRouter>
                <TicketListRow
                    ticket={unassignedTicket}
                    index={0}
                    showSiteColumn={true}
                    canEdit={true}
                    isSelected={false}
                    agents={mockAgents}
                    onSelect={vi.fn()}
                    onUpdatePriority={vi.fn()}
                    onUpdateStatus={vi.fn()}
                    onAssign={onAssign}
                />
            </MemoryRouter>
        );

        // Find the Unassigned button
        const unassignedButtons = screen.getAllByText('Unassigned');
        expect(unassignedButtons.length).toBeGreaterThan(0);

        const button = unassignedButtons[0].closest('button');
        if (button) {
            fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
            fireEvent.click(button);
        }

        const agentOption = await screen.findByText('RM BAGASTYO ANGGORO INDRASTOTO');
        fireEvent.click(agentOption);

        expect(onAssign).toHaveBeenCalledWith('ticket-1', 'agent-2');
    });

    describe('TicketListRow Keyboard Navigation', () => {
        beforeEach(() => {
            mockNavigate.mockClear();
        });

        it('navigates to ticket when Enter or Space is pressed on the row itself', () => {
            render(
                <MemoryRouter>
                    <TicketListRow
                        ticket={mockTicket}
                        index={0}
                        showSiteColumn={true}
                        canEdit={true}
                        isSelected={false}
                        agents={mockAgents}
                        onSelect={vi.fn()}
                        onUpdatePriority={vi.fn()}
                        onUpdateStatus={vi.fn()}
                        onAssign={vi.fn()}
                    />
                </MemoryRouter>
            );

            const row = screen.getByRole('button', { name: /Open ticket 190826-GEN-0005/i });
            fireEvent.keyDown(row, { key: ' ' });
            expect(mockNavigate).toHaveBeenCalledTimes(1);
            expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1', expect.any(Object));

            mockNavigate.mockClear();
            fireEvent.keyDown(row, { key: 'Enter' });
            expect(mockNavigate).toHaveBeenCalledTimes(1);
            expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1', expect.any(Object));
        });

        it('does not navigate to ticket when Space is pressed inside child element or modal', () => {
            render(
                <MemoryRouter>
                    <TicketListRow
                        ticket={mockTicket}
                        index={0}
                        showSiteColumn={true}
                        canEdit={true}
                        isSelected={false}
                        agents={mockAgents}
                        onSelect={vi.fn()}
                        onUpdatePriority={vi.fn()}
                        onUpdateStatus={vi.fn()}
                        onAssign={vi.fn()}
                    />
                </MemoryRouter>
            );

            // Find a child button inside row, such as assignee or checkbox button
            const assigneeButtons = screen.getAllByText('BENY SAPUTRA, S.KOM');
            const button = assigneeButtons[0].closest('button');
            expect(button).toBeInTheDocument();

            if (button) {
                fireEvent.keyDown(button, { key: ' ' });
                // Should NOT trigger row navigation because event.target !== event.currentTarget
                expect(mockNavigate).not.toHaveBeenCalled();
            }
        });
    });
});
