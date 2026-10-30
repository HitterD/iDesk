import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '@/lib/api';
import { toast } from 'sonner';
import { DocumentNumberField, GmApprovalPanel, numberError } from '../EformPaperwork';
import type { EFormRequest } from '../../../api/eform-request.api';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request = (overrides: Partial<EFormRequest> = {}): EFormRequest => ({
    id: 'ef-1', formType: 'VPN', status: 'PENDING_GM', requesterId: 'u-1', requesterName: 'Budi', formData: {},
    termsAccepted: true, createdAt: '2026-10-24T08:00:00Z', updatedAt: '2026-10-24T08:00:00Z',
    documentNumber: 'F/ICT/04/0012', ...overrides,
});

const renderIn = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const pdf = new File(['%PDF-1.7'], 'form-ttd-gm.pdf', { type: 'application/pdf' });

describe('numberError', () => {
    it('accepts the codes the forms use and refuses what the server would', () => {
        expect(numberError(' F/ICT/04-W/0007 ')).toBeNull();
        expect(numberError('')).toMatch(/wajib/);
        expect(numberError('F ICT 04')).toMatch(/Hanya/);
        expect(numberError('x'.repeat(51))).toMatch(/Maksimal/);
    });
});

describe('DocumentNumberField', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the number read-only to anyone outside ICT', () => {
        renderIn(<dl><div><DocumentNumberField request={request()} canEdit={false} /></div></dl>);
        expect(screen.getByText('F/ICT/04/0012')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ubah nomor dokumen' })).not.toBeInTheDocument();
    });

    it('lets ICT correct it and saves the trimmed value', async () => {
        vi.mocked(api.patch).mockResolvedValue({ data: request({ documentNumber: 'F/ICT/04/0050' }) });
        renderIn(<dl><div><DocumentNumberField request={request()} canEdit /></div></dl>);
        fireEvent.click(screen.getByRole('button', { name: 'Ubah nomor dokumen' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Nomor dokumen' }), { target: { value: ' F/ICT/04/0050 ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan nomor dokumen' }));
        await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/eform-request/ef-1/document-number', { documentNumber: 'F/ICT/04/0050' }, { skipToast: true }));
        expect(toast.success).toHaveBeenCalled();
    });

    it('says why a number cannot be saved and keeps the save button off', () => {
        renderIn(<dl><div><DocumentNumberField request={request()} canEdit /></div></dl>);
        fireEvent.click(screen.getByRole('button', { name: 'Ubah nomor dokumen' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Nomor dokumen' }), { target: { value: 'F ICT' } });
        expect(screen.getByRole('alert')).toHaveTextContent('Hanya huruf, angka');
        expect(screen.getByRole('button', { name: 'Simpan nomor dokumen' })).toBeDisabled();
    });

    it('shows the server answer for a duplicate number', async () => {
        vi.mocked(api.patch).mockRejectedValue({ response: { data: { message: 'Nomor F/ICT/04/0001 sudah dipakai dokumen lain' } } });
        renderIn(<dl><div><DocumentNumberField request={request()} canEdit /></div></dl>);
        fireEvent.click(screen.getByRole('button', { name: 'Ubah nomor dokumen' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Nomor dokumen' }), { target: { value: 'F/ICT/04/0001' } });
        fireEvent.click(screen.getByRole('button', { name: 'Simpan nomor dokumen' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Nomor F/ICT/04/0001 sudah dipakai dokumen lain'));
    });
});

describe('GmApprovalPanel', () => {
    beforeEach(() => vi.clearAllMocks());

    it('tells the requester ICT is collecting the GM signature, with nothing to do', () => {
        renderIn(<GmApprovalPanel request={request()} isICT={false} onReject={vi.fn()} />);
        expect(screen.getByText('Menunggu tanda tangan GM')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Unggah PDF TTD GM/ })).not.toBeInTheDocument();
    });

    it('lets ICT upload the signed PDF', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: request({ status: 'PENDING_ICT' }) });
        const { container } = renderIn(<GmApprovalPanel request={request()} isICT onReject={vi.fn()} />);
        fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [pdf] } });
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/eform-request/ef-1/gm-approval', expect.any(FormData), { skipToast: true }));
        expect((vi.mocked(api.post).mock.calls[0][1] as FormData).get('file')).toBe(pdf);
        expect(toast.success).toHaveBeenCalledWith('TTD GM tersimpan. Pengajuan siap diproses ICT.');
    });

    it('refuses anything but a PDF before uploading', () => {
        const { container } = renderIn(<GmApprovalPanel request={request()} isICT onReject={vi.fn()} />);
        const image = new File(['x'], 'scan.jpg', { type: 'image/jpeg' });
        fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [image] } });
        expect(api.post).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalled();
    });

    it('offers rejecting when the GM does not sign', () => {
        const onReject = vi.fn();
        renderIn(<GmApprovalPanel request={request()} isICT onReject={onReject} />);
        fireEvent.click(screen.getByRole('button', { name: /GM tidak menyetujui/ }));
        expect(onReject).toHaveBeenCalled();
    });

    it('afterwards offers the signed copy to download, and nothing before the GM step', () => {
        const { rerender } = renderIn(<GmApprovalPanel request={request({ status: 'PENDING_MANAGER' })} isICT onReject={vi.fn()} />);
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        rerender(
            <QueryClientProvider client={new QueryClient()}>
                <GmApprovalPanel request={request({ status: 'CONFIRMED', gmApprovalFileName: 'ttd-gm.pdf', gmApprovedAt: '2026-10-24T09:00:00Z' })} isICT onReject={vi.fn()} />
            </QueryClientProvider>,
        );
        expect(screen.getByText('Ditandatangani GM')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Unduh/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Ganti/ })).not.toBeInTheDocument();
    });
});
