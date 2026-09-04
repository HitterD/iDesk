import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketListRow, TicketRowData, Agent } from '../TicketListRow';
import { MemoryRouter } from 'react-router-dom';

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
});
