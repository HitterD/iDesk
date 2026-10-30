import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PresetDrawer } from '../PresetDrawer';
import api from '@/lib/api';

const USER_SYSTEM_PRESET = { id: 'system', name: 'User', isSystem: true, targetRole: 'USER', permissions: {}, pageAccess: {} };

const mockState = vi.hoisted(() => ({ presets: [] as unknown[] }));

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/permissions/presets') {
                return Promise.resolve({ data: mockState.presets });
            }
            return Promise.resolve({ data: [] });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        put: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

const renderDrawer = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <PresetDrawer isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
    );
};

describe('PresetDrawer', () => {
    beforeEach(() => {
        mockState.presets = [USER_SYSTEM_PRESET];
        vi.mocked(api.put).mockClear();
    });

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

    it('confirms before discarding unsaved edits instead of closing silently', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <PresetDrawer isOpen={true} onClose={onClose} />
            </QueryClientProvider>
        );

        // "New Preset" starts a dirty draft.
        await user.click(await screen.findByRole('button', { name: /New Preset/i }));
        await user.click(screen.getByRole('button', { name: /Close permission presets/i }));

        expect(onClose).not.toHaveBeenCalled();
        expect(await screen.findByText(/Discard unsaved changes\?/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /^Discard$/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('allows toggling permissions and editing description on system presets while keeping name locked', async () => {
        const user = userEvent.setup();
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <PresetDrawer isOpen={true} onClose={vi.fn()} />
            </QueryClientProvider>
        );

        // Name input is disabled for system presets
        const nameInput = await screen.findByRole('textbox', { name: /Preset Name/i });
        expect(nameInput).toBeDisabled();

        // Permission toggle switch is enabled
        const ticketsSwitch = screen.getByRole('switch', { name: /Access to tickets/i });
        expect(ticketsSwitch).not.toBeDisabled();

        // Save button is initially disabled (no unsaved changes)
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).toBeDisabled();

        // Toggle the permission switch
        await user.click(ticketsSwitch);

        // Save button should now be enabled
        expect(saveButton).not.toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(/Unsaved changes/i);
    });

    it('keeps csi_admin_ict when selecting and saving a preset that grants it', async () => {
        const user = userEvent.setup();
        mockState.presets = [{
            id: 'admin', name: 'Admin', isSystem: true, targetRole: 'ADMIN', permissions: {},
            pageAccess: { tickets: true, csi_admin_ict: true },
        }];
        renderDrawer();

        await user.click(await screen.findByRole('switch', { name: /Access to tickets/i }));
        await user.click(screen.getByRole('button', { name: /Save/i }));

        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
        const [url, payload] = vi.mocked(api.put).mock.calls[0] as unknown as [string, { pageAccess: Record<string, boolean> }];
        expect(url).toBe('/permissions/presets/admin');
        expect(payload.pageAccess.csi_admin_ict).toBe(true);
        expect(payload.pageAccess.tickets).toBe(false);
    });

    it('shows CSI admin toggles enabled for ADMIN/MANAGER presets', async () => {
        mockState.presets = [{ id: 'mgr', name: 'Manager', isSystem: false, targetRole: 'MANAGER', permissions: {}, pageAccess: { csi_admin_hc: true } }];
        renderDrawer();

        const hcSwitch = await screen.findByRole('switch', { name: /Access to csi_admin_hc/i });
        expect(hcSwitch).not.toBeDisabled();
        expect(hcSwitch).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('switch', { name: /Access to csi_admin_ict/i })).not.toBeDisabled();
        expect(screen.getByText(/Survei Kepuasan \(CSI\)/i)).toBeInTheDocument();
    });

    it('disables CSI admin toggles for presets not targeting ADMIN/MANAGER', async () => {
        renderDrawer();

        expect(await screen.findByRole('switch', { name: /Access to csi_admin_ict/i })).toBeDisabled();
        expect(screen.getByRole('switch', { name: /Access to csi_admin_hc/i })).toBeDisabled();
        expect(screen.getAllByText(/Hanya untuk role Admin atau Manager/i).length).toBeGreaterThan(0);
    });
});
