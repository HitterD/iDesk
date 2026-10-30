import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentUser: { id: string; role: string } | null = null;
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => undefined)) } }));

import { useHasFeaturePermission, useHasPageAccess, useHasPermission } from '../usePermissions';

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe('permission hooks keep their hook order when the user changes', () => {
    beforeEach(() => { currentUser = { id: 'u1', role: 'USER' }; });

    it.each([
        ['useHasPermission', () => useHasPermission('tickets')],
        ['useHasPageAccess', () => useHasPageAccess('tickets')],
        ['useHasFeaturePermission', () => useHasFeaturePermission('tickets', 'view')],
    ])('%s: USER -> ADMIN re-render does not throw and grants access', (_name, hook) => {
        const { result, rerender } = renderHook(hook, { wrapper });
        currentUser = { id: 'u1', role: 'ADMIN' };
        expect(() => rerender()).not.toThrow();
        const value = result.current as unknown;
        expect(value === true || (value as { hasPermission?: boolean; hasAccess?: boolean }).hasPermission || (value as { hasAccess?: boolean }).hasAccess).toBe(true);
    });
});
