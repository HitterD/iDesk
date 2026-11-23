import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaperSignDialog, qrVerdict } from '../PaperSignDialog';

afterEach(cleanup);

describe('qrVerdict', () => {
    it('matches the ticket and the latest version', () => {
        expect(qrVerdict('221126-QC-0035/v4', '221126-QC-0035', 4)).toEqual({ ok: true });
    });

    it('refuses an older version of the same ticket and says which one it is', () => {
        const verdict = qrVerdict('221126-QC-0035/v3', '221126-QC-0035', 4);
        expect(verdict.ok).toBe(false);
        expect(verdict.ok === false && verdict.reason).toMatch(/v3.*v4/);
    });

    it('refuses another ticket, and text that is not our QR', () => {
        expect(qrVerdict('999999-XX-0001/v4', '221126-QC-0035', 4).ok).toBe(false);
        expect(qrVerdict('hello', '221126-QC-0035', 4).ok).toBe(false);
        expect(qrVerdict(null, '221126-QC-0035', 4).ok).toBe(false);
    });
});

describe('PaperSignDialog', () => {
    const file = new File(['%PDF'], 'ttd.pdf', { type: 'application/pdf' });

    it('walks through download, sign, upload and cannot send before a matching scan is read', async () => {
        const onSubmit = vi.fn(async () => undefined);
        const readQr = vi.fn(async () => '221126-QC-0035/v4');
        render(<PaperSignDialog open onClose={vi.fn()} ticketNumber="221126-QC-0035" version={4} onDownload={vi.fn()} readQr={readQr} onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Impor tanda tangan' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Berkas hasil scan'), { target: { files: [file] } });
        expect(await screen.findByText(/Cocok/)).toBeInTheDocument();
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(file, '221126-QC-0035/v4'));
    });

    it('rejects a scan of an older version and keeps the button off', async () => {
        render(<PaperSignDialog open onClose={vi.fn()} ticketNumber="221126-QC-0035" version={4} onDownload={vi.fn()} readQr={async () => '221126-QC-0035/v2'} onSubmit={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Berkas hasil scan'), { target: { files: [file] } });
        expect(await screen.findByText(/v2.*v4/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Impor tanda tangan' })).toBeDisabled();
    });

    it('says so when no QR could be read', async () => {
        render(<PaperSignDialog open onClose={vi.fn()} ticketNumber="221126-QC-0035" version={4} onDownload={vi.fn()} readQr={async () => null} onSubmit={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Berkas hasil scan'), { target: { files: [file] } });
        expect(await screen.findByText(/QR tidak terbaca/)).toBeInTheDocument();
    });
});
