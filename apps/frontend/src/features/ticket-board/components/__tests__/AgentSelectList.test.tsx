import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
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
    it('preserves duplicate-name identity, groups and avatars with keyboard selection', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const duplicates = mockAgents.map((agent, i) => ({ ...agent, fullName: 'Nama Sama yang Sangat Panjang', avatarUrl: i === 0 ? '/avatar.png' : undefined }));
        render(<AgentSelectList agents={duplicates} selectedId="agent-3" isAdmin={false} onSelect={onSelect} />);
        const rows = screen.getAllByRole('option', { name: /Nama Sama/ });
        expect(rows.map(row => row.getAttribute('data-checked'))).toEqual(['false', 'false', 'true', 'false']);
        expect(document.querySelector('img')).toHaveAttribute('src', '/avatar.png');
        const input = screen.getByRole('combobox', { name: 'Cari agent atau site…' });
        await user.type(input, 'beny031185');
        await user.keyboard('{ArrowDown}{Enter}');
        expect(onSelect).toHaveBeenCalledWith('agent-2');
    });

    it('shows no results and keeps externally controlled search authoritative', () => {
        const { rerender } = render(<AgentSelectList agents={mockAgents} isAdmin={true} onSelect={vi.fn()} searchQuery="zzzz" />);
        expect(screen.getByText('Tidak ada agent ditemukan')).toBeVisible();
        rerender(<AgentSelectList agents={mockAgents} isAdmin={true} onSelect={vi.fn()} searchQuery="SMG" />);
        expect(screen.getByText('Agent SMG')).toBeVisible();
        expect(screen.queryByText('Beny Saputra, S.Kom')).not.toBeInTheDocument();
    });
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

    it('displays Admin badge for ADMIN and AGENT_ADMIN roles', () => {
        const adminAgents: Agent[] = [
            {
                id: 'admin-1',
                fullName: 'System Administrator',
                email: 'admin@idesk.com',
                role: 'ADMIN',
                site: { code: 'SPJ', name: 'Santos Premium Jaya' },
            },
            {
                id: 'agent-admin-1',
                fullName: 'Alfith',
                email: 'alfith@idesk.com',
                role: 'AGENT_ADMIN',
                site: { code: 'SPJ', name: 'Santos Premium Jaya' },
            },
        ];

        render(
            <AgentSelectList
                agents={adminAgents}
                isAdmin={true}
                onSelect={vi.fn()}
            />
        );

        const adminBadges = screen.getAllByText('Admin');
        expect(adminBadges).toHaveLength(2);
    });
});
