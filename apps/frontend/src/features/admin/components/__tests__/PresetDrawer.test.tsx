import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import { PresetDrawer } from '../PresetDrawer';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/permissions/presets') {
                return Promise.resolve({
                    data: [{ id: 'system', name: 'User', isSystem: true, targetRole: 'USER', permissions: {}, pageAccess: {} }],
                });
            }
            return Promise.resolve({ data: [] });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        put: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

describe('PresetDrawer', () => {
    it('allows save but hides delete for a system preset', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <PresetDrawer isOpen={true} onClose={vi.fn()} />
            </QueryClientProvider>
        );

        expect(await screen.findByRole('button', { name: /Save/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    });
});
