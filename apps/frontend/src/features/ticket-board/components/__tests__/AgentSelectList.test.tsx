import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentSelectList, Agent } from '../AgentSelectList';

const mockAgents: Agent[] = [
    {
        id: 'agent-1',
        fullName: 'Alphin Santoso Herman',
        email: 'alphinsantoso@gmail.com',
        role: 'AGENT',
        site: { code: 'SPJ', name: 'Santos Premium Jaya' },
    },
    {
        id: 'agent-2',
        fullName: 'Beny Saputra, S.Kom',
        email: 'beny031185@gmail.com',
        role: 'AGENT',
        site: { code: 'SPJ', name: 'Santos Premium Jaya' },
    },
    {
        id: 'agent-3',
        fullName: 'Agent SMG',
        email: 'agent.smg@idesk.com',
        role: 'AGENT',
        site: { code: 'SMG', name: 'Semarang' },
    },
    {
        id: 'agent-4',
        fullName: 'Raymundus Nonnatus',
        email: 'raymundus.n.p@gmail.com',
        role: 'AGENT',
        site: { code: 'SMG', name: 'Semarang' },
    },
];

describe('AgentSelectList', () => {
    it('renders admin grouped site headers and scrollable agent items', () => {
        const onSelect = vi.fn();
        render(
            <AgentSelectList
                agents={mockAgents}
                selectedId="agent-1"
                isAdmin={true}
                onSelect={onSelect}
            />
        );

        // Verify Unassign option
        expect(screen.getByText('Unassigned (Lepas Penugasan)')).toBeInTheDocument();

        // Verify Site headers
        expect(screen.getByText(/Site SPJ/i)).toBeInTheDocument();
        expect(screen.getByText(/Site SMG/i)).toBeInTheDocument();

        // Verify agent rows
        expect(screen.getByText('Alphin Santoso Herman')).toBeInTheDocument();
        expect(screen.getByText('Agent SMG')).toBeInTheDocument();
    });

    it('filters agents dynamically when typing in search input', () => {
        const onSelect = vi.fn();
        render(
            <AgentSelectList
                agents={mockAgents}
                isAdmin={true}
                onSelect={onSelect}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Cari agent atau site/i);
        fireEvent.change(searchInput, { target: { value: 'Beny' } });

        expect(screen.getByText('Beny Saputra, S.Kom')).toBeInTheDocument();
        expect(screen.queryByText('Agent SMG')).not.toBeInTheDocument();
    });

    it('calls onSelect with empty string when unassign is clicked', () => {
        const onSelect = vi.fn();
        render(
            <AgentSelectList
                agents={mockAgents}
                selectedId="agent-1"
                isAdmin={true}
                onSelect={onSelect}
            />
        );

        fireEvent.click(screen.getByText('Unassigned (Lepas Penugasan)'));
        expect(onSelect).toHaveBeenCalledWith('');
    });
});
