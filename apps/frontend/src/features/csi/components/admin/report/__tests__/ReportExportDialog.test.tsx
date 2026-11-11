import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../../../api/csi.api';
import { ReportExportDialog } from '../ReportExportDialog';

vi.mock('../../../../api/csi.api', () => ({
    CsiApi: { exportPdf: vi.fn(), exportPeriod: vi.fn(), exportPeriodRaw: vi.fn(), reportSignoff: vi.fn(), saveReportSignoff: vi.fn(), resetReportSignoff: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const LAYOUT = { columns: 2, slots: [{ title: 'Disiapkan oleh', name: 'Admin ICT', role: 'Supervisor', align: 'left' as const, showDate: true }] };

beforeEach(() => {
    vi.mocked(CsiApi.exportPdf).mockReset().mockResolvedValue({ blob: new Blob(['%PDF-']), filename: 'laporan.pdf' });
    vi.mocked(CsiApi.exportPeriod).mockReset().mockResolvedValue({ blob: new Blob(['x']), filename: 'csi.xlsx' });
    vi.mocked(CsiApi.exportPeriodRaw).mockReset().mockResolvedValue({ blob: new Blob(['x']), filename: 'csi - DATA MENTAH (RAHASIA).xlsx' });
    vi.mocked(CsiApi.reportSignoff).mockReset().mockResolvedValue(LAYOUT);
    vi.mocked(CsiApi.saveReportSignoff).mockReset().mockResolvedValue(LAYOUT);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const renderDialog = () => render(<ReportExportDialog scope="ict" periodId="p1" siteId="s2" open onOpenChange={vi.fn()} />);

describe('ReportExportDialog', () => {
    it('loads the PDF preview for the site', async () => {
        renderDialog();
        expect(await screen.findByTitle('Pratinjau laporan CSI')).toHaveAttribute('src', 'blob:preview');
        expect(CsiApi.exportPdf).toHaveBeenCalledWith('ict', 'p1', { siteId: 's2', notes: '', signoff: null });
    });

    it('notes are applied to the preview before download; Excel gets the same notes', async () => {
        const user = userEvent.setup();
        renderDialog();
        await screen.findByTitle('Pratinjau laporan CSI');
        await user.type(screen.getByLabelText(/Catatan & tindak lanjut/), 'Pelatihan tim');
        expect(screen.getByRole('button', { name: 'Unduh PDF' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Terapkan catatan ke pratinjau' }));
        await waitFor(() => expect(CsiApi.exportPdf).toHaveBeenLastCalledWith('ict', 'p1', { siteId: 's2', notes: 'Pelatihan tim', signoff: null }));
        await screen.findByTitle('Pratinjau laporan CSI');
        await user.click(screen.getByRole('button', { name: /Unduh Excel/ }));
        expect(CsiApi.exportPeriod).toHaveBeenCalledWith('ict', 'p1', 'Pelatihan tim');
    });

    it('raw data is a separate, labelled download (lock icon, warning) from its own endpoint', async () => {
        const user = userEvent.setup();
        renderDialog();
        await screen.findByTitle('Pratinjau laporan CSI');
        const raw = screen.getByRole('button', { name: /Unduh data mentah \(rahasia\)/ });
        expect(raw).toHaveAccessibleDescription(/nama penilai/);
        await user.click(raw);
        expect(CsiApi.exportPeriodRaw).toHaveBeenCalledWith('ict', 'p1');
        expect(CsiApi.exportPeriod).not.toHaveBeenCalled();
    });

    it('the sign-off editor starts from the saved layout and re-renders the preview on apply', async () => {
        const user = userEvent.setup();
        renderDialog();
        await screen.findByTitle('Pratinjau laporan CSI');
        await user.click(screen.getByRole('button', { name: 'Tanda tangan' }));
        expect(await screen.findByDisplayValue('Admin ICT')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Terapkan ke PDF ini' }));
        await waitFor(() => expect(CsiApi.exportPdf).toHaveBeenLastCalledWith('ict', 'p1', { siteId: 's2', notes: '', signoff: LAYOUT }));
        await user.click(screen.getByRole('button', { name: 'Simpan sebagai default' }));
        expect(CsiApi.saveReportSignoff).toHaveBeenCalledWith('ict', LAYOUT);
    });
});
