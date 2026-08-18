import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AgentCard } from '../AgentCard';
import type { AgentStats } from '../agent-types';

const agent: AgentStats = {
    id: 'a1',
    fullName: 'Bagas Adi Nugroho Wicaksono',
    email: 'bagas.adi.nugroho@example.co.id',
    role: 'AGENT',
    site: { id: 's1', code: 'SPJ', name: 'Sidoarjo' },
    openTickets: 4,
    inProgressTickets: 3,
    resolvedThisWeek: 6,
    resolvedThisMonth: 21,
    resolvedTotal: 140,
    slaCompliance: 95,
    appraisalPoints: 82,
    activeWorkloadPoints: 12,
};

const renderCard = (overrides: Partial<React.ComponentProps<typeof AgentCard>> = {}) =>
    render(
        <AgentCard
            agent={agent}
            onView={vi.fn()}
            onSelect={vi.fn()}
            isSelected={false}
            {...overrides}
        />
    );

describe('AgentCard', () => {
    it('renders the agent name as the card heading', () => {
        renderCard();
        // Regression: the name used to render at text-sm beside four 44px icon
        // buttons, so it was both out-ranked and squeezed out of the row.
        const name = screen.getByRole('heading', { name: agent.fullName });
        expect(name).toBeInTheDocument();
        expect(name.className).toContain('text-base');
    });

    it('labels the card by the agent name', () => {
        renderCard();
        expect(screen.getByRole('article', { name: agent.fullName })).toBeInTheDocument();
    });

    it('keeps only the selection control beside the name', () => {
        renderCard();
        // Everything else moved into the overflow menu; anything more in this row
        // starves the name again.
        expect(screen.getByRole('checkbox', { name: `Select ${agent.fullName}` })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    it('exposes edit, reset password and deactivate inside the actions menu', async () => {
        const onEdit = vi.fn();
        const onResetPassword = vi.fn();
        const onToggleActive = vi.fn();
        renderCard({ onEdit, onResetPassword, onToggleActive });

        await userEvent.click(screen.getByRole('button', { name: `More actions for ${agent.fullName}` }));

        expect(await screen.findByRole('menuitem', { name: /edit user/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /reset password/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /deactivate account/i })).toBeInTheDocument();

        await userEvent.click(screen.getByRole('menuitem', { name: /edit user/i }));
        expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('offers activation instead of deactivation for an inactive agent', async () => {
        renderCard({ isActive: false, onToggleActive: vi.fn() });
        await userEvent.click(screen.getByRole('button', { name: `More actions for ${agent.fullName}` }));
        expect(await screen.findByRole('menuitem', { name: /activate account/i })).toBeInTheDocument();
    });

    it('reports workload against capacity on the progress bar', () => {
        renderCard();
        const bar = screen.getByRole('progressbar', { name: `Workload for ${agent.fullName}` });
        expect(bar).toHaveAttribute('aria-valuenow', String(agent.activeWorkloadPoints));
        expect(bar).toHaveAttribute('aria-valuemax', '50');
    });

    it('falls back to open plus in-progress tickets when workload points are absent', () => {
        renderCard({ agent: { ...agent, activeWorkloadPoints: undefined } });
        expect(screen.getByRole('progressbar', { name: `Workload for ${agent.fullName}` }))
            .toHaveAttribute('aria-valuenow', String(agent.openTickets + agent.inProgressTickets));
    });

    it('names the view action after the agent', async () => {
        const onView = vi.fn();
        renderCard({ onView });
        await userEvent.click(screen.getByRole('button', { name: `View details for ${agent.fullName}` }));
        expect(onView).toHaveBeenCalledTimes(1);
    });

    it('opens the agent from anywhere on the card', async () => {
        const onView = vi.fn();
        renderCard({ onView });
        // The whole card is the hit area via a stretched-link overlay on the view
        // button, so clicking dead space — here the email line — still opens it.
        // jsdom has no layout, so the overlay cannot be hit by coordinates; assert
        // the mechanism instead: one action element whose overlay spans the card.
        const action = screen.getByRole('button', { name: `View details for ${agent.fullName}` });
        expect(action.className).toContain('after:absolute');
        expect(action.className).toContain('after:inset-0');

        const card = screen.getByRole('article', { name: agent.fullName });
        expect(card.className).toContain('relative');
        expect(card.className).toContain('cursor-pointer');
    });

    it('keeps the other controls above the click overlay', () => {
        renderCard({ onEdit: vi.fn() });
        // Without `z-10` these would sit under the stretched link and open the
        // agent instead of doing their own job.
        expect(screen.getByRole('checkbox', { name: `Select ${agent.fullName}` }).className).toContain('z-10');
        expect(screen.getByRole('button', { name: `More actions for ${agent.fullName}` }).className).toContain('z-10');
    });

    it('selects without opening the agent', async () => {
        const onView = vi.fn();
        const onSelect = vi.fn();
        renderCard({ onView, onSelect });
        await userEvent.click(screen.getByRole('checkbox', { name: `Select ${agent.fullName}` }));
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onView).not.toHaveBeenCalled();
    });

    it('opens the actions menu without opening the agent', async () => {
        const onView = vi.fn();
        renderCard({ onView, onEdit: vi.fn() });
        await userEvent.click(screen.getByRole('button', { name: `More actions for ${agent.fullName}` }));
        expect(await screen.findByRole('menuitem', { name: /edit user/i })).toBeInTheDocument();
        expect(onView).not.toHaveBeenCalled();
    });

    // The avatar dot used to be coloured by `inProgressTickets`, which everyone
    // read as "online". Workload is now stated in words and the dot is presence
    // only — see AgentCard.presence.test.tsx for the online/offline behaviour.
    it('states the in-progress workload in words, not colour alone', () => {
        renderCard();
        expect(screen.getByText('3 in progress')).toBeInTheDocument();
    });
});
