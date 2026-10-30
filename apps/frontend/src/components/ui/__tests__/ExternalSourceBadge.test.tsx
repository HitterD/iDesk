import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { APP_COLORS, ExternalSourceBadge, colorForSource, externalSourceOf } from '../ExternalSourceBadge';

vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { role: 'AGENT' } }) }));
vi.mock('@/lib/api', () => ({
    default: { get: vi.fn(async () => ({ data: [{ source: 'EBBK', name: 'E-BBK', color: 'amber' }] })) },
}));

const renderBadge = (props: React.ComponentProps<typeof ExternalSourceBadge>) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ExternalSourceBadge {...props} />
    </QueryClientProvider>,
);

describe('ExternalSourceBadge', () => {
    it('labels iPop tickets with the iPop dot, no "via" and no violet', () => {
        renderBadge({ source: 'IPOP' });
        const badge = screen.getByText('iPop');
        expect(badge).toHaveClass('src-badge');
        expect(badge).toHaveAttribute('data-src', 'ipop');
        expect(badge.className).not.toMatch(/violet|purple/);
    });

    it('renders nothing for tickets created in iDesk', () => {
        const { container } = renderBadge({ source: 'WEB' });
        expect(container).toBeEmptyDOMElement();
    });

    it('names a connected app with its configured name and colour', async () => {
        renderBadge({ source: 'API', externalSource: 'EBBK' });
        const badge = await screen.findByText('E-BBK');
        expect(badge).toHaveAttribute('data-src', 'amber');
        expect(badge).toHaveAttribute('title', 'Tiket dibuat dari aplikasi E-BBK lewat API');
    });

    it('falls back to the client id and a stable, never-green colour', () => {
        const origin = externalSourceOf('API', 'HRIS');
        expect(origin).toEqual(expect.objectContaining({ label: 'HRIS', color: colorForSource('hris') }));
        expect(APP_COLORS).not.toContain('green');
        expect(externalSourceOf('API', null)).toBeUndefined();
    });
});
