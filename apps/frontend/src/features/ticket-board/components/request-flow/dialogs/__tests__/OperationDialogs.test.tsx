import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArrivalDialog } from '../ArrivalDialog';
import { CredentialDialog } from '../CredentialDialog';
import { DocNumberDialog } from '../DocNumberDialog';
import { FulfillDialog, fulfillReady } from '../FulfillDialog';
import { ProcurementDialog, procureLines } from '../ProcurementDialog';

vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => (
        <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>
    ),
}));

afterEach(cleanup);

const items = [
    { id: 'i-1', name: 'Laptop', recipient: 'Leony', deliveryStatus: 'PENDING', procurementDecision: null },
    { id: 'i-2', name: 'Monitor', recipient: 'Budi', deliveryStatus: 'PENDING', procurementDecision: null },
];

describe('procureLines', () => {
    it('groups units decided the same way into one line, and drops the cancelled ones without vendor data', () => {
        const lines = procureLines([
            { id: 'a', decision: 'APPROVED', vendor: 'Dell', unitCost: '15000000', invoiceNumber: '', invoiceDate: '' },
            { id: 'b', decision: 'APPROVED', vendor: 'Dell', unitCost: '15000000', invoiceNumber: '', invoiceDate: '' },
            { id: 'c', decision: 'REJECTED', vendor: 'ignored', unitCost: '1', invoiceNumber: '', invoiceDate: '' },
        ]);
        expect(lines).toEqual([
            { itemIds: ['a', 'b'], decision: 'APPROVED', vendor: 'Dell', unitCost: 15000000 },
            { itemIds: ['c'], decision: 'REJECTED' },
        ]);
    });
});

describe('ProcurementDialog', () => {
    it('every unit is Beli or Batal, a bought one needs a vendor and a price', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ProcurementDialog open onClose={vi.fn()} items={items} onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Simpan keputusan' });
        expect(send).toBeDisabled();
        const rows = screen.getAllByRole('group');
        fireEvent.click(within(rows[0]).getByRole('radio', { name: 'Beli' }));
        fireEvent.change(within(rows[0]).getByLabelText('Vendor'), { target: { value: 'Dell' } });
        fireEvent.change(within(rows[0]).getByLabelText('Harga satuan'), { target: { value: '15000000' } });
        fireEvent.click(within(rows[1]).getByRole('radio', { name: 'Batal' }));
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ lines: [
            { itemIds: ['i-1'], decision: 'APPROVED', vendor: 'Dell', unitCost: 15000000 },
            { itemIds: ['i-2'], decision: 'REJECTED' },
        ] }));
    });
});

describe('ProcurementDialog: cancelling every unit', () => {
    it('asks for a reason of 5+ characters (the backend refuses otherwise) and sends it as the note', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ProcurementDialog open onClose={vi.fn()} items={items} onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Simpan keputusan' });
        expect(screen.queryByLabelText('Alasan pembatalan')).not.toBeInTheDocument();
        screen.getAllByRole('group').forEach((row) => fireEvent.click(within(row).getByRole('radio', { name: 'Batal' })));
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Alasan pembatalan'), { target: { value: 'ok' } });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Alasan pembatalan'), { target: { value: 'Vendor tidak menyediakan' } });
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            lines: [{ itemIds: ['i-1', 'i-2'], decision: 'REJECTED' }], note: 'Vendor tidak menyediakan',
        }));
    });
});

describe('ArrivalDialog', () => {
    it('lists only the bought units still on the way and sends the ticked ones', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ArrivalDialog open onClose={vi.fn()} items={[
            { ...items[0], procurementDecision: 'APPROVED' }, { ...items[1], procurementDecision: 'REJECTED' },
            { id: 'i-3', name: 'Mouse', recipient: '', deliveryStatus: 'ARRIVED', procurementDecision: 'APPROVED' },
        ]} onSubmit={onSubmit} />);
        expect(screen.getAllByRole('checkbox')).toHaveLength(1);
        const send = screen.getByRole('button', { name: 'Barang sudah tiba' });
        expect(send).toBeEnabled(); // everything still on the way is ticked at first
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ itemIds: ['i-1'] }));
    });
});

describe('fulfillReady', () => {
    it('credentials need a username and a password; no credentials needs a note of 3+ characters', () => {
        expect(fulfillReady({ mode: 'CREDENTIALS', username: 'a', password: '', note: '' })).toBe(false);
        expect(fulfillReady({ mode: 'CREDENTIALS', username: 'a', password: 'b', note: '' })).toBe(true);
        expect(fulfillReady({ mode: 'NO_CREDENTIALS', username: '', password: '', note: 'ok' })).toBe(false);
        expect(fulfillReady({ mode: 'NO_CREDENTIALS', username: '', password: '', note: 'Folder ditambahkan' })).toBe(true);
    });
});

describe('FulfillDialog', () => {
    it('sends credentials with IT\'s signature', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<FulfillDialog open onClose={vi.fn()} signerName="Yudi" formType="VPN" onSubmit={onSubmit} />);
        fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'leony.r' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'S3cret!x' } });
        const send = screen.getByRole('button', { name: 'Berikan akses' });
        expect(send).toBeDisabled();
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'CREDENTIALS', username: 'leony.r', password: 'S3cret!x', signatureData: 'data:image/png;base64,AAAA',
        })));
    });

    it('a NAS access defaults to "no credentials" and asks for a note', () => {
        render(<FulfillDialog open onClose={vi.fn()} signerName="Yudi" formType="SYNOLOGY_NAS" onSubmit={vi.fn()} />);
        expect(screen.queryByLabelText('Password')).toBeNull();
        expect(screen.getByLabelText(/Catatan/)).toBeInTheDocument();
    });
});

describe('CredentialDialog', () => {
    it('hides the password until the eye is pressed and copies on request', async () => {
        const writeText = vi.fn(async () => undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(<CredentialDialog open onClose={vi.fn()} credentials={{ username: 'leony.r', password: 'S3cret!x', server: 'vpn.example.com', note: 'Ganti password' }} />);
        expect(screen.queryByText('S3cret!x')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Tampilkan password' }));
        expect(screen.getByText('S3cret!x')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Salin password' }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('S3cret!x'));
    });
});

describe('DocNumberDialog', () => {
    it('sends the new number, trimmed, and is off for an empty or unchanged one', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<DocNumberDialog open onClose={vi.fn()} current="F/ICT/04/0120" onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Simpan nomor' });
        expect(send).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Nomor dokumen'), { target: { value: ' F/ICT/04/0999 ' } });
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('F/ICT/04/0999'));
    });

    it('warns that a new number makes a new document version', () => {
        render(<DocNumberDialog open onClose={vi.fn()} current="F/1" onSubmit={vi.fn()} />);
        expect(screen.getByText(/versi baru/i)).toBeInTheDocument();
    });
});
