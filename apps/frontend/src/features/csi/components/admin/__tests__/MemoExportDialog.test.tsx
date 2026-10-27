import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoExportDialog } from '../MemoExportDialog';
import type { CsiPeriodListItem } from '../../../types';

const mocks = vi.hoisted(() => ({ exportMemo: vi.fn(), download: vi.fn() }));
vi.mock('../../../hooks/useCsi', () => ({
    useCsiPeriods: () => ({ data: [{ id: 'p1', title: 'CSI November', publishStatus: 'PUBLISHED', endDate: '2026-11-30', teamLabel: 'Support', sites: [{ id: 's1', name: 'Sepanjang' }] }] as CsiPeriodListItem[] }),
    useCsiMemoSettings: () => ({ data: { to: 'Manager ICT', cc: '', number: '001/ICT', from: 'Supervisor', subject: 'Nilai CSI 2026', date: '2026-12-01', opening: '', closing: 'Terima kasih.', signerLeft: { name: 'A', title: 'Supervisor' }, signerRight: { name: 'B', title: 'Manager' } } }),
    useExportCsiMemo: () => ({ mutateAsync: mocks.exportMemo, isPending: false }),
}));
vi.mock('../../../lib/csiAdmin', () => ({ downloadBlob: mocks.download, blobErrorMessage: async () => 'Gagal membuat PDF' }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('MemoExportDialog', () => {
    it('prefills saved header and exports selected published survey ids', async () => {
        mocks.exportMemo.mockResolvedValue({ blob: new Blob(['pdf']), filename: 'memo.pdf' });
        render(<MemoExportDialog scope="ict" open onOpenChange={vi.fn()} />);
        expect(await screen.findByLabelText('Kepada')).toHaveValue('Manager ICT');
        fireEvent.click(screen.getByRole('checkbox', { name: 'CSI November' }));
        expect((screen.getByLabelText('Paragraf pembuka') as HTMLTextAreaElement).value).toContain('November 2026');
        fireEvent.click(screen.getByRole('button', { name: 'Buat PDF' }));
        await waitFor(() => expect(mocks.exportMemo).toHaveBeenCalledWith(expect.objectContaining({ periodIds: ['p1'], header: expect.objectContaining({ to: 'Manager ICT', subject: 'Nilai CSI 2026' }) })));
        expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), 'memo.pdf');
    });
    it('keeps the opening in sync with the chosen surveys after another field was edited, until the opening itself is edited', async () => {
        render(<MemoExportDialog scope="ict" open onOpenChange={vi.fn()} />);
        fireEvent.change(await screen.findByLabelText('Kepada'), { target: { value: 'Manager Baru' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'CSI November' }));
        const opening = screen.getByLabelText('Paragraf pembuka') as HTMLTextAreaElement;
        expect(opening.value).toContain('Sepanjang');
        fireEvent.change(opening, { target: { value: 'Teks pembuka sendiri.' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'CSI November' }));
        expect((screen.getByLabelText('Paragraf pembuka') as HTMLTextAreaElement).value).toBe('Teks pembuka sendiri.');
        expect(screen.getByLabelText('Kepada')).toHaveValue('Manager Baru');
    });
});
