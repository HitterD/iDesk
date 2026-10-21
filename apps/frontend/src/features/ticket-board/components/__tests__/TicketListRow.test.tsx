vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

    it('selects a card row without navigating to the ticket', () => {
        const onSelect = vi.fn();
        render(<MemoryRouter><TicketListRow ticket={mockTicket} index={0} showSiteColumn canEdit
            isSelected={false} agents={mockAgents} onSelect={onSelect}
            onUpdatePriority={vi.fn()} onUpdateStatus={vi.fn()} onAssign={vi.fn()} /></MemoryRouter>);
        mockNavigate.mockClear();
        // Card and desktop layouts both render in jsdom (CSS hides one); [0] is the card.
        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Pilih tiket 190826-GEN-0005' })[0]);
        expect(onSelect).toHaveBeenCalledWith('ticket-1', true);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it.each([0, 1])('toggles selection from anywhere in checkbox cell %i without opening the ticket', (cellIndex) => {
        const onSelect = vi.fn();
        render(<MemoryRouter><TicketListRow ticket={mockTicket} index={0} showSiteColumn canEdit
            isSelected={false} agents={mockAgents} onSelect={onSelect}
            onUpdatePriority={vi.fn()} onUpdateStatus={vi.fn()} onAssign={vi.fn()} /></MemoryRouter>);
        mockNavigate.mockClear();
        // [0] = card layout, [1] = desktop table row; both cells are the whole hit target.
        const checkbox = screen.getAllByRole('checkbox', { name: 'Pilih tiket 190826-GEN-0005' })[cellIndex];
        const cell = checkbox.closest('.queue-select-cell');
        expect(cell).not.toBeNull();
        fireEvent.click(cell!);
        expect(onSelect).toHaveBeenCalledWith('ticket-1', true);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps the desktop row checkbox visible before hover', () => {
        renderRow(mockTicket);
        const cell = screen.getAllByRole('checkbox', { name: 'Pilih tiket 190826-GEN-0005' })[1].closest('.queue-select-cell');
        expect(cell?.className ?? '').not.toMatch(/opacity-0/);
    });

    it('still opens the ticket when the row outside the checkbox cell is clicked', () => {
        renderRow(mockTicket);
        mockNavigate.mockClear();
        fireEvent.click(screen.getAllByText('Password terkunci')[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1', expect.any(Object));
    });

    it('keeps readonly roles free of selection and editor controls', () => {
        renderRow(mockTicket, false);
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByRole('button', { name: /Ganti PIC|Prioritas:|Status:/ })).toBeNull();
        expect(screen.getAllByText('Open')).toHaveLength(2);
    });

    it('locks only status for CLOSED while keeping permitted priority and PIC editors', () => {
        renderRow({ ...mockTicket, status: 'CLOSED' });
        expect(screen.queryByRole('button', { name: /Status:/ })).toBeNull();
        expect(screen.getAllByRole('button', { name: /Prioritas:/ })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: /Ganti PIC/ })).toHaveLength(2);
        expect(screen.getAllByText('Closed')).toHaveLength(2);
    });

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

describe('TicketListRow quick actions (round 2)', () => {
    const renderRow = (ticket: TicketRowData, canEdit = true, onSelect = vi.fn()) => render(
        <MemoryRouter>
            <TicketListRow ticket={ticket} index={0} showSiteColumn canEdit={canEdit}
                isSelected={false} agents={mockAgents} onSelect={onSelect}
                onUpdatePriority={vi.fn()} onUpdateStatus={vi.fn().mockResolvedValue(undefined)} onAssign={vi.fn()} />
        </MemoryRouter>
    );
    beforeEach(() => mockNavigate.mockClear());

    it('labels the ⋯ menu per ticket and opening it never navigates', async () => {
        const user = userEvent.setup();
        renderRow(mockTicket);
        const triggers = screen.getAllByRole('button', { name: 'Aksi lainnya #190826-GEN-0005' });
        // Mobile card (always visible) + desktop row (hover/focus).
        expect(triggers).toHaveLength(2);
        await user.click(triggers[1]);
        const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
        expect(items).toEqual(['Buka tiket', 'Tandai selesai', 'Ganti PIC', 'Salin nomor tiket']);
        expect(mockNavigate).not.toHaveBeenCalled();
        await user.click(screen.getByRole('menuitem', { name: 'Buka tiket' }));
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/ticket-1', expect.anything());
    });

    it('offers quick resolve only where the old hover resolve was allowed', () => {
        const { unmount } = renderRow(mockTicket);
        fireEvent.click(screen.getByRole('button', { name: 'Tandai selesai #190826-GEN-0005' }));
        expect(mockNavigate).not.toHaveBeenCalled();
        unmount();
        renderRow({ ...mockTicket, status: 'RESOLVED' });
        expect(screen.queryByRole('button', { name: /Tandai selesai/ })).not.toBeInTheDocument();
        cleanupAndRender(() => renderRow({ ...mockTicket, status: 'CLOSED' }));
        cleanupAndRender(() => renderRow(mockTicket, false));
    });

    it('lists hardware and bulk selection in the mobile card menu', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        renderRow({ ...mockTicket, isHardwareInstallation: true, ictBudgetRequestId: 'hr-9' }, true, onSelect);
        await user.click(screen.getAllByRole('button', { name: 'Aksi lainnya #190826-GEN-0005' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Pilih untuk aksi massal' }));
        expect(onSelect).toHaveBeenCalledWith('ticket-1', true);
        await user.click(screen.getAllByRole('button', { name: 'Aksi lainnya #190826-GEN-0005' })[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Buka Hardware Request' }));
        expect(mockNavigate).toHaveBeenCalledWith('/hardware-requests/hr-9?highlight=installation');
    });
});

function cleanupAndRender(renderFn: () => void) {
    cleanup();
    renderFn();
    expect(screen.queryByRole('button', { name: /Tandai selesai/ })).not.toBeInTheDocument();
}
