import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { AgentRatingsSection } from '../AgentRatingsSection';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));

const overview = {
    // Backend order: unrounded average first, then count.
    agents: [
        { agentId: 'victor', fullName: 'VICTOR SANTOSO', average: 5, count: 1 },
        { agentId: 'andrew', fullName: 'ANDREW ALFONSO SETIAWAN', average: 4.97, count: 30 },
    ],
    recent: [],
};
const andrewRatings = [
    { raterName: 'MEGA DRESTI', ticketId: 't-1', ticketNumber: '281026-HC-0086', rating: 5, comment: 'Cepat tanggap', createdAt: '2026-10-28T09:33:00Z' },
    { raterName: 'DIFA ANTONO', ticketId: 't-2', ticketNumber: '281026-PMW-0082', rating: 4, comment: null, createdAt: '2026-10-27T09:07:00Z' },
];

function renderSection(siteCode?: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter><AgentRatingsSection siteCode={siteCode} /></MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('AgentRatingsSection', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
        vi.mocked(api.get).mockImplementation(async (url: string) => ({
            data: url.startsWith('/agent-ratings/agents/') ? andrewRatings : overview,
        }));
    });

    it('shows averages to two decimals so a 4.97 is not mistaken for 5.0', async () => {
        renderSection();
        const rows = await screen.findAllByRole('row');
        const andrew = rows.find((r) => r.textContent?.includes('ANDREW'))!;
        expect(within(andrew).getByText('4,97')).toBeInTheDocument();
        expect(rows.find((r) => r.textContent?.includes('VICTOR'))!).toHaveTextContent('5,00');
    });

    it('asks only for the chosen site, and for every site when none is chosen', async () => {
        renderSection('SPJ');
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/agent-ratings?siteCode=SPJ', expect.anything()));
    });

    it('opens who rated an agent, with stars, comments and tickets, when the agent is clicked', async () => {
        renderSection();
        await userEvent.click(await screen.findByRole('button', { name: /Lihat rating ANDREW ALFONSO SETIAWAN/ }));

        const dialog = await screen.findByRole('dialog', { name: /ANDREW ALFONSO SETIAWAN/ });
        expect(api.get).toHaveBeenCalledWith('/agent-ratings/agents/andrew', expect.anything());
        expect(await within(dialog).findByText('MEGA DRESTI')).toBeInTheDocument();
        expect(within(dialog).getByText('Cepat tanggap')).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: /281026-HC-0086/ })).toHaveAttribute('href', '/tickets/t-1');
        expect(within(dialog).getByText('DIFA ANTONO')).toBeInTheDocument();
    });
});
