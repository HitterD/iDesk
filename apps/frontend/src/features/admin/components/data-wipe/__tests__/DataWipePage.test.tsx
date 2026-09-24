import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataWipePage } from '../../../pages/DataWipePage';

const post = vi.fn();

vi.mock('@/lib/api', () => ({
    default: {
        get post() {
            return post;
        },
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const previewResponse = {
    data: {
        preview: {
            token: 'token-1',
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            domains: ['TICKETING'],
            tables: [
                { table: 'tickets', label: 'Tiket', rows: 12, outOfScope: false },
                {
                    table: 'access_requests',
                    label: 'Permintaan Akses',
                    rows: 3,
                    outOfScope: true,
                    reason: 'Terhubung ke tiket melalui foreign key tanpa ON DELETE.',
                },
            ],
            totalRows: 15,
            files: { folders: ['tickets'], fileCount: 4, bytes: 2048 },
            counterResets: [],
            warnings: ['Penomoran tiket akan dimulai ulang dari 0001.'],
        },
    },
};

/** Types into the confirmation input rendered inside the dialog. */
const typePhrase = (value: string) => {
    fireEvent.change(screen.getByLabelText('Frasa konfirmasi penghapusan data'), {
        target: { value },
    });
};

describe('DataWipePage', () => {
    beforeEach(() => {
        post.mockReset();
    });

    it('keeps the delete button disabled until a preview has run', async () => {
        post.mockResolvedValue(previewResponse);
        render(<DataWipePage />);

        const deleteButton = screen.getByRole('button', { name: /hapus data permanen/i });
        expect(deleteButton).toBeDisabled();

        // Selecting a domain alone is not enough.
        fireEvent.click(screen.getByRole('checkbox', { name: /tiketing/i }));
        expect(deleteButton).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: /jalankan pratinjau/i }));
        await waitFor(() => expect(deleteButton).toBeEnabled());
    });

    it('cannot preview before a domain is selected', () => {
        render(<DataWipePage />);
        expect(screen.getByRole('button', { name: /jalankan pratinjau/i })).toBeDisabled();
        expect(post).not.toHaveBeenCalled();
    });

    it('discards the preview when the selection changes', async () => {
        post.mockResolvedValue(previewResponse);
        render(<DataWipePage />);

        fireEvent.click(screen.getByRole('checkbox', { name: /tiketing/i }));
        fireEvent.click(screen.getByRole('button', { name: /jalankan pratinjau/i }));
        await screen.findByText('Tiket');

        fireEvent.click(screen.getByRole('checkbox', { name: /e-form/i }));

        expect(screen.queryByText('Tiket')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /hapus data permanen/i })).toBeDisabled();
    });

    it('surfaces out-of-scope tables in the preview', async () => {
        post.mockResolvedValue(previewResponse);
        render(<DataWipePage />);

        fireEvent.click(screen.getByRole('checkbox', { name: /tiketing/i }));
        fireEvent.click(screen.getByRole('button', { name: /jalankan pratinjau/i }));

        expect(await screen.findByText('Permintaan Akses')).toBeInTheDocument();
        expect(screen.getByText(/di luar 3 domain/i)).toBeInTheDocument();
        expect(
            screen.getByText(/Penomoran tiket akan dimulai ulang dari 0001./),
        ).toBeInTheDocument();
    });

    describe('confirmation dialog', () => {
        const openDialog = async () => {
            post.mockResolvedValue(previewResponse);
            render(<DataWipePage />);
            fireEvent.click(screen.getByRole('checkbox', { name: /tiketing/i }));
            fireEvent.click(screen.getByRole('button', { name: /jalankan pratinjau/i }));
            await screen.findByText('Tiket');
            fireEvent.click(screen.getByRole('button', { name: /hapus data permanen/i }));
        };

        it('does not enable confirmation for a wrong phrase', async () => {
            await openDialog();
            const confirm = screen.getByRole('button', { name: /^hapus permanen$/i });
            expect(confirm).toBeDisabled();

            typePhrase('hapus semua data');
            expect(confirm).toBeDisabled();

            typePhrase('HAPUS SEMUA');
            expect(confirm).toBeDisabled();
        });

        it('enables confirmation only for the exact phrase', async () => {
            await openDialog();
            typePhrase('HAPUS SEMUA DATA');
            expect(screen.getByRole('button', { name: /^hapus permanen$/i })).toBeEnabled();
        });

        it('sends the preview token and the exact phrase on confirm', async () => {
            await openDialog();
            post.mockResolvedValue({
                data: {
                    result: {
                        backupPath: '/backups/pre-wipe/dump.sql.gz',
                        backupSizeBytes: 4096,
                        deleted: { tickets: 12, access_requests: 3 },
                        totalRowsDeleted: 15,
                        countersReset: 2,
                        filesDeleted: 4,
                        bytesFreed: 2048,
                        auditLogId: 'audit-1234-5678',
                        durationMs: 1500,
                    },
                },
            });

            typePhrase('HAPUS SEMUA DATA');
            fireEvent.click(screen.getByRole('button', { name: /^hapus permanen$/i }));

            await waitFor(() =>
                expect(post).toHaveBeenLastCalledWith('/admin/data-wipe/execute', {
                    token: 'token-1',
                    confirmPhrase: 'HAPUS SEMUA DATA',
                }),
            );

            expect(await screen.findByText(/penghapusan data selesai/i)).toBeInTheDocument();
            expect(screen.getByText('/backups/pre-wipe/dump.sql.gz')).toBeInTheDocument();
        });
    });
});
