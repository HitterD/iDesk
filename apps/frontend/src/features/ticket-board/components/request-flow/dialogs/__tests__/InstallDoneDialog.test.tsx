import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallDoneDialog, assetCodeErrors } from '../InstallDoneDialog';

vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => (
        <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>
    ),
}));

afterEach(cleanup);

const items = [
    { id: 'i-1', name: 'Laptop', quantity: 2, recipient: 'Leony' },
    { id: 'i-2', name: 'Monitor', quantity: 1, recipient: 'Budi' },
];

describe('assetCodeErrors', () => {
    it('flags an empty, too short, badly written or repeated code', () => {
        expect(assetCodeErrors(['AST-001', '', 'ab', 'AST 002', 'AST-001'])).toEqual([
            'Kode ganda', 'Isi kode aset', 'Minimal 4 karakter', 'Hanya huruf, angka, - dan _', 'Kode ganda',
        ]);
    });

    it('is clean for unique valid codes, ignoring case when comparing', () => {
        expect(assetCodeErrors(['AST-001', 'AST-002'])).toEqual([null, null]);
        expect(assetCodeErrors(['ast-001', 'AST-001'])).toEqual(['Kode ganda', 'Kode ganda']);
    });
});

describe('InstallDoneDialog', () => {
    it('asks for one code per unit: a line per unit, named after the item and its recipient', () => {
        render(<InstallDoneDialog open onClose={vi.fn()} signerName="Yudi" items={items} onSubmit={vi.fn()} />);
        expect(screen.getAllByRole('textbox', { name: /Kode aset/ })).toHaveLength(3);
        expect(screen.getAllByText(/Laptop/).length).toBeGreaterThan(0);
    });

    it('cannot be sent with empty or duplicate codes, or without the signature', () => {
        render(<InstallDoneDialog open onClose={vi.fn()} signerName="Yudi" items={items} onSubmit={vi.fn()} />);
        const send = screen.getByRole('button', { name: 'Selesaikan pemasangan' });
        const fields = screen.getAllByRole('textbox', { name: /Kode aset/ });
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        expect(send).toBeDisabled();
        fireEvent.change(fields[0], { target: { value: 'AST-001' } });
        fireEvent.change(fields[1], { target: { value: 'AST-001' } });
        fireEvent.change(fields[2], { target: { value: 'AST-003' } });
        expect(send).toBeDisabled();
        expect(screen.getAllByText('Kode ganda')).toHaveLength(2);
    });

    it('sends every unit with its own code and the signature', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<InstallDoneDialog open onClose={vi.fn()} signerName="Yudi" items={items} onSubmit={onSubmit} />);
        const fields = screen.getAllByRole('textbox', { name: /Kode aset/ });
        ['AST-001', 'AST-002', 'AST-003'].forEach((code, index) => fireEvent.change(fields[index], { target: { value: code } }));
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        fireEvent.click(screen.getByRole('button', { name: 'Selesaikan pemasangan' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            assets: [{ itemId: 'i-1', code: 'AST-001' }, { itemId: 'i-1', code: 'AST-002' }, { itemId: 'i-2', code: 'AST-003' }],
            signatureData: 'data:image/png;base64,AAAA',
        }));
    });
});
