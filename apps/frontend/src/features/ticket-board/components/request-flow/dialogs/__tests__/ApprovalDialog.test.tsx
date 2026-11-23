import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDialog } from '../ApprovalDialog';

vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => (
        <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>
    ),
}));

afterEach(cleanup);

const baseProps = {
    open: true, onClose: vi.fn(), signerName: 'Hendra', requesterName: 'Leony', title: 'Laptop Design', summary: ['Laptop i5 × 2'],
};

describe('ApprovalDialog', () => {
    it('approve is the default and needs a signature before it can be sent', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ApprovalDialog {...baseProps} onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: /Setujui & tanda tangani/ });
        expect(send).toBeDisabled();
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ decision: 'APPROVE', signatureData: 'data:image/png;base64,AAAA' }));
    });

    it.each([
        ['Kembalikan ke IT', 'RETURN'],
        ['Tolak', 'REJECT'],
    ] as const)('%s needs a reason of at least 5 characters and no signature', async (label, decision) => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ApprovalDialog {...baseProps} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
        const send = screen.getByRole('button', { name: new RegExp(`^${label}$`) });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: 'abc' } });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/Alasan/), { target: { value: 'Barang terlalu mahal' } });
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ decision, note: 'Barang terlalu mahal' }));
    });

    it('keeps the dialog open and shows the server message when sending fails', async () => {
        const onSubmit = vi.fn(async () => { throw new Error('Status tiket berubah. Muat ulang detail tiket.'); });
        const onClose = vi.fn();
        render(<ApprovalDialog {...baseProps} onClose={onClose} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        fireEvent.click(screen.getByRole('button', { name: /Setujui & tanda tangani/ }));
        expect(await screen.findByText('Status tiket berubah. Muat ulang detail tiket.')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });
});
