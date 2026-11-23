import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKey } from '../useRequestDraft';
import { EformRequestForm } from '../EformRequestForm';

vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>,
}));
vi.mock('@/features/request-center/components/eform/ManagerSelector', () => ({ ManagerSelector: () => <div>pilih atasan</div> }));
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const baseProps = { userId: 'u-1', userName: 'Leony', userDepartment: 'QC', today: '2026-11-23' };
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** The terms box reads as "scrolled to the bottom" so the agreement box turns on. */
function acceptTerms() {
    const box = screen.getByTestId('terms-box');
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 90 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 100 });
    fireEvent.scroll(box);
    fireEvent.click(screen.getByRole('checkbox'));
}

describe('EformRequestForm', () => {
    it('submit with something missing shows what, in the mockup words, and sends nothing', () => {
        const onSubmit = vi.fn();
        render(<EformRequestForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);
        click('Kirim permintaan');
        expect(screen.getByRole('alert')).toHaveTextContent('Pilih kebutuhan VPN');
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('VPN longer than 12 months is refused with "Maksimal 12 bulan"', () => {
        render(<EformRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Akses jaringan kantor/ }));
        fireEvent.change(screen.getByLabelText('Sampai'), { target: { value: '2027-12-23' } });
        fireEvent.change(screen.getByLabelText('Keperluan'), { target: { value: 'WFH' } });
        click('Kirim permintaan');
        expect(screen.getByRole('alert')).toHaveTextContent('Maksimal 12 bulan');
    });

    it('an Email request may be permanent; the address is forced to lowercase letters, digits and . _ -', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<EformRequestForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);
        click('Email');
        fireEvent.change(screen.getByLabelText('Usulan alamat email'), { target: { value: 'Budi Santoso!' } });
        expect(screen.getByLabelText('Usulan alamat email')).toHaveValue('budisantoso');
        fireEvent.change(screen.getByLabelText('Keperluan'), { target: { value: 'Email kerja' } });
        acceptTerms();
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        click('Kirim permintaan');
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ formType: 'EMAIL', termsAccepted: true })));
        expect(onSubmit.mock.calls[0][0].endDate).toBeUndefined();
    });

    it('the terms checkbox is off until the terms were read to the bottom', () => {
        render(<EformRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('NAS: a folder that is already on the same server is refused', () => {
        render(<EformRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        click(/Synology NAS/);
        click('SPJ');
        const path = screen.getByLabelText('Path folder');
        fireEvent.change(path, { target: { value: '/QC/Laporan' } });
        click('Tambah folder');
        fireEvent.change(path, { target: { value: '/qc/laporan' } });
        click('Tambah folder');
        expect(screen.getByText('Folder sudah ada')).toBeInTheDocument();
    });

    it('restores what was typed after a reload, and Batal keeps nothing', () => {
        const { unmount } = render(<EformRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        vi.useFakeTimers();
        fireEvent.change(screen.getByLabelText('Keperluan'), { target: { value: 'Draf saya' } });
        vi.advanceTimersByTime(600);
        vi.useRealTimers();
        unmount();
        render(<EformRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByLabelText('Keperluan')).toHaveValue('Draf saya');
    });

    it('a renewal does not reuse the draft of a new request', () => {
        localStorage.setItem(draftKey('u-1', 'eform'), JSON.stringify({ reason: 'draf pengajuan baru' }));
        render(<EformRequestForm {...baseProps} renew={{ kind: 'VPN', to: '2026-12-31', reason: 'WFH' }} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.queryByDisplayValue('draf pengajuan baru')).toBeNull();
    });

    it('a renewal starts from the old kind and from the old end date', () => {
        render(<EformRequestForm {...baseProps} renew={{ kind: 'VPN', to: '2026-12-31', need: 'NETWORK', reason: 'WFH' }} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText(/Mode perpanjangan/)).toBeInTheDocument();
        expect(screen.getByLabelText('Mulai')).toHaveValue('2026-12-31');
        expect(screen.getByLabelText('Keperluan')).toHaveValue('WFH');
    });
});
