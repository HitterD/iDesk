import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BentoTopbar } from '../BentoTopbar';
import { MobileBottomNav } from '../MobileBottomNav';

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: { tickets: [], users: [], articles: [], totalCount: 0, timing: 1 } })) },
}));

const authUser = vi.hoisted(() => ({ current: { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT' } }));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: authUser.current }),
}));

// The topbar keeps these implementations untouched; stub them to isolate shell markup.
vi.mock('../../notifications/NotificationPopover', () => ({
    NotificationPopover: () => <button type="button">Notifikasi</button>,
}));
vi.mock('../../notifications/ActionCommandCenter', () => ({
    ActionCommandCenter: () => <button type="button">Action Command Center</button>,
}));
vi.mock('../../ui/ThemeToggle', () => ({
    ThemeToggle: () => <button type="button">Switch theme</button>,
}));

describe('BentoTopbar', () => {
    beforeEach(() => {
        localStorage.clear();
        authUser.current = { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT' };
    });

    const renderTopbar = () =>
        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/tickets/list']}>
                    <BentoTopbar />
                </MemoryRouter>
            </QueryClientProvider>,
        );

    it('renders the labelled amber create-ticket link to the existing route', () => {
        renderTopbar();
        const cta = screen.getByRole('link', { name: 'Buat Tiket Baru' });
        expect(cta).toHaveAttribute('href', '/tickets/create');
        expect(cta).toHaveClass('idesk-cta');
    });

    it('uses the same role-aware create path as the bottom nav for AGENT_ORACLE', () => {
        authUser.current = { id: 'oracle-1', fullName: 'Oracle Agent', role: 'AGENT_ORACLE' };
        renderTopbar();
        expect(screen.getByRole('link', { name: 'Buat Tiket Baru' })).toHaveAttribute('href', '/tickets/create?type=oracle-request');
    });

    it('keeps the Ctrl+K search shortcut focusing the unified search', () => {
        renderTopbar();
        const search = screen.getByRole('combobox');
        expect(search).not.toHaveFocus();

        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(search).toHaveFocus();
    });

    it('keeps theme, action center and notifications, without a demo availability menu', () => {
        renderTopbar();
        expect(screen.getByRole('button', { name: 'Switch theme' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Action Command Center' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Notifikasi' })).toBeInTheDocument();
        expect(screen.queryByText(/Online|Sibuk|Tidak tersedia/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /status|ketersediaan|availability/i })).not.toBeInTheDocument();
    });

    it('does not duplicate the agent profile in the topbar', () => {
        renderTopbar();
        expect(screen.queryByText('Ops Agent')).not.toBeInTheDocument();
    });
});

describe('MobileBottomNav create action', () => {
    beforeEach(() => {
        authUser.current = { id: 'agent-1', fullName: 'Ops Agent', role: 'AGENT' };
    });

    it('pre-selects the Oracle request type for AGENT_ORACLE, matching the topbar', () => {
        authUser.current = { id: 'oracle-1', fullName: 'Oracle Agent', role: 'AGENT_ORACLE' };
        render(
            <MemoryRouter initialEntries={['/tickets/oracle-k2']}>
                <MobileBottomNav />
            </MemoryRouter>,
        );
        expect(screen.getByRole('link', { name: 'Buat Tiket Baru' })).toHaveAttribute('href', '/tickets/create?type=oracle-request');
    });

    it('shows a raised, text-labelled amber create action', () => {
        render(
            <MemoryRouter initialEntries={['/tickets/list']}>
                <MobileBottomNav />
            </MemoryRouter>,
        );
        const create = screen.getByRole('link', { name: 'Buat Tiket Baru' });
        expect(create).toHaveAttribute('href', '/tickets/create');
        // Visible text fits a 5-column tab bar; it is contained in the accessible name (WCAG 2.5.3).
        expect(create).toHaveTextContent('Tiket Baru');
        expect(create.querySelector('.idesk-cta')).not.toBeNull();
    });
});
