import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SynologyBackupSettings from '../SynologyBackupSettings';
import api from '@/lib/api';
import { toast } from 'sonner';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('SynologyBackupSettings', () => {
    const mockConfigs = [
        {
            id: 'cfg-1',
            name: 'Daily backup database',
            synologyHost: '192.168.2.17',
            synologyPort: 30001,
            synologyUsername: 'ict',
            destinationFolder: '/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup',
            backupType: 'FULL',
            scheduleCron: '0 2 * * *',
            retentionDays: 30,
            isActive: true,
            lastBackupAt: new Date().toISOString(),
            lastBackupStatus: 'SUCCESS',
        },
    ];

    const mockHistory = [
        {
            id: 'hist-1',
            configId: 'cfg-1',
            status: 'SUCCESS',
            backupType: 'FULL',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            filePath: '/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup/full/123',
            fileSizeBytes: 1048576,
            errorMessage: null,
            config: mockConfigs[0],
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup/configs')) return Promise.resolve({ data: mockConfigs });
            if (url.includes('/backup/history')) return Promise.resolve({ data: mockHistory });
            return Promise.resolve({ data: [] });
        });
    });

    it('renders heading and Sync File ke Synology button', async () => {
        render(<SynologyBackupSettings />);

        expect(await screen.findByText('Synology NAS Backup & Restore')).toBeInTheDocument();
        expect(screen.getByText('Sync File ke Synology')).toBeInTheDocument();
        expect(screen.getByText('Restore Database')).toBeInTheDocument();
        expect(screen.getByText('Add Configuration')).toBeInTheDocument();
    });

    it('displays configurations with FULL badge and destination folder', async () => {
        render(<SynologyBackupSettings />);

        expect(await screen.findByText('Daily backup database')).toBeInTheDocument();
        expect(screen.getByText('FULL (DB + Files)')).toBeInTheDocument();
        expect(screen.getByText('/sja/SJA SPJ/ICT/OPERATIONAL SUPPORT/Backup')).toBeInTheDocument();
        expect(screen.getByText('192.168.2.17:30001')).toBeInTheDocument();
    });

    it('triggers sync-uploads when clicking Sync File ke Synology', async () => {
        (api.post as any).mockResolvedValueOnce({
            data: { success: true, message: 'Sinkronisasi selesai: 10/10 file berhasil' },
        });

        render(<SynologyBackupSettings />);

        const syncButton = await screen.findByText('Sync File ke Synology');
        fireEvent.click(syncButton);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/backup/sync-uploads');
            expect(toast.success).toHaveBeenCalledWith('Sinkronisasi selesai: 10/10 file berhasil');
        });
    });
});
