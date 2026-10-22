import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const get = vi.fn();
const patch = vi.fn(() => Promise.resolve({ data: { isActive: false } }));
const del = vi.fn(() => Promise.resolve({ data: {} }));
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a), post: vi.fn() } }));
vi.mock('../RuleBuilder', () => ({ RuleBuilder: () => <div>builder</div> }));

const rules = [
    { id: 'r1', name: 'Eskalasi Blocker', description: null, isActive: true, priority: 1, trigger: { type: 'TICKET_CREATED' }, conditions: [{ field: 'priority', operator: 'EQUALS', value: 'CRITICAL' }], actions: [{ type: 'SEND_NOTIFICATION' }], executionCount: 41, lastExecutedAt: '2026-10-20T03:00:00Z', createdBy: null, createdAt: '2026-01-01' },
    { id: 'r2', name: 'Naikkan prioritas', description: null, isActive: false, priority: 2, trigger: { type: 'SLA_BREACHED' }, conditions: [], actions: [{ type: 'CHANGE_PRIORITY' }], executionCount: 12, lastExecutedAt: null, createdBy: null, createdAt: '2026-01-01' },
];

const { AutomationRulesPage } = await import('../AutomationRulesPage');
const renderPage = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AutomationRulesPage /></QueryClientProvider>);

describe('AutomationRulesPage (round-2 cards)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        get.mockImplementation((url: string) => Promise.resolve({ data: url.includes('templates') ? [] : rules }));
    });

    it('renders rule cards with trigger flow, runs and an accessible switch', async () => {
        renderPage();
        expect(await screen.findByText('Eskalasi Blocker')).toBeInTheDocument();
        expect(screen.getByText('2 rules • 1 active')).toBeInTheDocument();
        const card = screen.getByRole('article', { name: 'Eskalasi Blocker' });
        expect(within(card).getByText('Ticket Created')).toBeInTheDocument();
        expect(within(card).getByText('1 condition')).toBeInTheDocument();
        expect(within(card).getByText(/41 runs/)).toBeInTheDocument();
        await userEvent.click(within(card).getByRole('switch', { name: 'Aktifkan Eskalasi Blocker' }));
        expect(patch).toHaveBeenCalledWith('/automation/rules/r1/toggle');
    });

    it('deleting asks for confirmation in a dialog, not window.confirm', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        renderPage();
        const card = await screen.findByRole('article', { name: 'Naikkan prioritas' });
        await userEvent.click(within(card).getByRole('button', { name: 'Aksi lainnya untuk Naikkan prioritas' }));
        await userEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(del).not.toHaveBeenCalled();
        await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
        expect(del).toHaveBeenCalledWith('/automation/rules/r2');
    });
});
