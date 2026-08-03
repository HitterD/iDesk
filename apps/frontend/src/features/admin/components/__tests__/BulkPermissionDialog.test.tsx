import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import api from '@/lib/api';
import { BulkPermissionDialog } from '../BulkPermissionDialog';

const PRESETS = [
    { id: 'p-user', name: 'User Standard', targetRole: 'USER', permissions: {}, pageAccess: {} },
    { id: 'p-admin', name: 'Admin Full', targetRole: 'ADMIN', permissions: {}, pageAccess: {} },
];

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) =>
            url === '/permissions/presets'
                ? Promise.resolve({ data: PRESETS })
                : Promise.resolve({ data: [] })
        ),
        post: vi.fn(() => Promise.resolve({ data: { updated: 2 } })),
    },
}));

const renderDialog = (selectedUsers: Array<{ id: string; fullName: string; role: string }>) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <BulkPermissionDialog isOpen={true} onClose={vi.fn()} selectedUsers={selectedUsers} />
        </QueryClientProvider>
    );
};

describe('BulkPermissionDialog', () => {
    it('offers only presets valid for every selected role', async () => {
        renderDialog([
            { id: 'u1', fullName: 'Ana', role: 'USER' },
            { id: 'u2', fullName: 'Budi', role: 'USER' },
        ]);

        expect(await screen.findByRole('radio', { name: /User Standard/i })).toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /Admin Full/i })).not.toBeInTheDocument();
    });

    it('offers nothing and warns when the selection spans incompatible roles', async () => {
        renderDialog([
            { id: 'u1', fullName: 'Ana', role: 'USER' },
            { id: 'u2', fullName: 'Budi', role: 'ADMIN' },
        ]);

        expect(await screen.findByRole('alert')).toHaveTextContent(/No preset fits every selected user/i);
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('requires confirmation before applying to all selected users', async () => {
        const user = userEvent.setup();
        renderDialog([
            { id: 'u1', fullName: 'Ana', role: 'USER' },
            { id: 'u2', fullName: 'Budi', role: 'USER' },
        ]);

        await user.click(await screen.findByRole('radio', { name: /User Standard/i }));
        await user.click(screen.getByRole('button', { name: /Apply to All/i }));

        // Nothing sent yet — the confirmation must be answered first.
        expect(api.post).not.toHaveBeenCalled();
        expect(await screen.findByText(/Apply preset to all selected users\?/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /^Apply$/i }));
        expect(api.post).toHaveBeenCalledWith('/permissions/bulk-apply', {
            userIds: ['u1', 'u2'],
            presetId: 'p-user',
        });
    });
});
