import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HardwareRequestForm } from '../HardwareRequestForm';
import type { CatalogEntry } from '@/features/ticket-board/components/request-flow/picker/basket';

vi.mock('@/components/ui/SignaturePad', () => ({
    SignaturePad: ({ onSave }: { onSave: (dataUrl: string) => void }) => <button type="button" onClick={() => onSave('data:image/png;base64,AAAA')}>Simpan tanda tangan</button>,
}));
vi.mock('@/features/request-center/components/eform/ManagerSelector', () => ({ ManagerSelector: () => <div>pilih atasan</div> }));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const catalog: CatalogEntry[] = [
    { id: 'c-1', code: 'LAPTOP_STD', name: 'Laptop Standar', category: 'LAPTOP', requiredFields: [] },
    { id: 'c-2', code: 'SW', name: 'Lisensi Software', category: 'SOFTWARE', requiredFields: [{ key: 'seat', label: 'Jumlah seat', type: 'number', required: true }] },
];
const baseProps = { userId: 'u-1', userName: 'Leony', userDepartment: 'QC', catalog };
const pick = (name: RegExp) => fireEvent.click(within(screen.getByRole('listbox', { name: 'Katalog' })).getByRole('button', { name }));
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Kirim permintaan' }));

describe('HardwareRequestForm', () => {
    it('sending with an empty basket says "Pilih minimal satu barang" and sends nothing', () => {
        const onSubmit = vi.fn();
        render(<HardwareRequestForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);
        send();
        expect(screen.getByRole('alert')).toHaveTextContent('Pilih minimal satu barang');
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('an item whose required field is empty is named: "Lengkapi <barang>: <isian>"', () => {
        render(<HardwareRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        pick(/Lisensi Software/);
        send();
        expect(screen.getAllByRole('alert').map((n) => n.textContent).join('|')).toContain('Lengkapi Lisensi Software: Jumlah seat');
    });

    it('the per-item recipient picker only appears when there are several recipients', () => {
        render(<HardwareRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        pick(/Laptop Standar/);
        const names = screen.getByLabelText('Nama penerima');
        fireEvent.change(names, { target: { value: 'Leony' } });
        fireEvent.keyDown(names, { key: 'Enter' });
        expect(screen.queryByLabelText('Untuk siapa Laptop Standar')).toBeNull();
        fireEvent.change(names, { target: { value: 'Budi' } });
        fireEvent.keyDown(names, { key: 'Enter' });
        expect(screen.getByLabelText('Untuk siapa Laptop Standar')).toBeInTheDocument();
    });

    it('a complete request is sent once, with the basket, recipients and signature', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<HardwareRequestForm {...baseProps} onSubmit={onSubmit} onCancel={vi.fn()} />);
        pick(/Laptop Standar/);
        const names = screen.getByLabelText('Nama penerima');
        fireEvent.change(names, { target: { value: 'Leony' } });
        fireEvent.keyDown(names, { key: 'Enter' });
        fireEvent.change(screen.getByLabelText('Alasan permintaan'), { target: { value: 'Staf baru' } });
        fireEvent.click(screen.getByText('Simpan tanda tangan'));
        send();
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
            justification: 'Staf baru', division: 'QC', recipients: ['Leony'], signatureData: 'data:image/png;base64,AAAA',
            items: [{ catalogId: 'c-1', quantity: 1, recipientName: 'Leony' }],
        }));
    });

    it('restores the draft after a reload', () => {
        const { unmount } = render(<HardwareRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        vi.useFakeTimers();
        fireEvent.change(screen.getByLabelText('Alasan permintaan'), { target: { value: 'Draf saya' } });
        vi.advanceTimersByTime(600);
        vi.useRealTimers();
        unmount();
        render(<HardwareRequestForm {...baseProps} onSubmit={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByLabelText('Alasan permintaan')).toHaveValue('Draf saya');
    });
});
