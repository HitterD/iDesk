import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogBasket } from '../CatalogBasket';
import { EditItemsDialog } from '../../dialogs/EditItemsDialog';
import type { BasketLine, CatalogEntry } from '../basket';

afterEach(cleanup);

/** A catalog entry button; the basket's own buttons carry the same item name, so look only inside the catalog list. */
const pick = (name: RegExp) => fireEvent.click(within(screen.getByRole('listbox', { name: 'Katalog' })).getByRole('button', { name }));

const catalog: CatalogEntry[] = [
    { id: 'c-1', code: 'LAPTOP_STD', name: 'Laptop Standar', category: 'LAPTOP', requiredFields: [] },
    { id: 'c-2', code: 'MON_27', name: 'Monitor 27 inci', category: 'MONITOR', requiredFields: [] },
    { id: 'c-3', code: 'SW', name: 'Lisensi Software', category: 'SOFTWARE', requiredFields: [{ key: 'seat', label: 'Jumlah seat', type: 'number', required: true }] },
];

function Harness({ initial = [] as BasketLine[], onChange = vi.fn() }) {
    const [lines, setLines] = useState<BasketLine[]>(initial);
    return <CatalogBasket catalog={catalog} lines={lines} onChange={(next) => { setLines(next); onChange(next); }} />;
}

describe('CatalogBasket', () => {
    it('clicking an item adds it; clicking it again adds one more unit', () => {
        render(<Harness />);
        pick(/Laptop Standar/);
        pick(/Laptop Standar/);
        expect(screen.getByLabelText('Jumlah Laptop Standar')).toHaveValue(2);
    });

    it('filters the catalog by what is typed', () => {
        render(<Harness />);
        fireEvent.change(screen.getByPlaceholderText(/Cari barang/), { target: { value: 'monitor' } });
        expect(screen.queryByRole('button', { name: /Laptop Standar/ })).toBeNull();
        expect(screen.getByRole('button', { name: /Monitor 27 inci/ })).toBeInTheDocument();
    });

    it('a manual item is written by hand and added to the basket', () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('Barang lain'), { target: { value: 'Kabel HDMI 5 meter' } });
        fireEvent.click(screen.getByRole('button', { name: 'Tambah' }));
        expect(screen.getByText('Kabel HDMI 5 meter')).toBeInTheDocument();
    });

    it('shows the required field of an item, and tells what is missing', () => {
        render(<Harness />);
        pick(/Lisensi Software/);
        expect(screen.getByLabelText('Jumlah seat')).toBeInTheDocument();
        expect(screen.getByText('Isian "Jumlah seat" wajib untuk Lisensi Software')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Jumlah seat'), { target: { value: '5' } });
        expect(screen.queryByText(/wajib untuk Lisensi Software/)).toBeNull();
    });

    it('"Ganti" swaps a line for another catalog item and marks what it replaces', () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        pick(/Laptop Standar/);
        fireEvent.click(screen.getByRole('button', { name: 'Ganti Laptop Standar' }));
        fireEvent.click(screen.getByRole('option', { name: /Monitor 27 inci/ }));
        expect(screen.getByText(/Pengganti dari Laptop Standar/)).toBeInTheDocument();
    });

    it('removing a line takes it out', () => {
        render(<Harness />);
        pick(/Laptop Standar/);
        fireEvent.click(screen.getByRole('button', { name: 'Hapus Laptop Standar' }));
        expect(screen.queryByLabelText('Jumlah Laptop Standar')).toBeNull();
    });
});

describe('EditItemsDialog', () => {
    const existing: BasketLine[] = [
        { catalogId: 'c-1', name: 'Laptop Standar', quantity: 2, fields: {}, requiredFields: [], existingItemIds: ['u-1', 'u-2'] },
    ];

    it('needs a reason of at least 5 characters before the change can be saved', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<EditItemsDialog open onClose={vi.fn()} catalog={catalog} initial={existing} onSubmit={onSubmit} />);
        const save = screen.getByRole('button', { name: 'Simpan perubahan' });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Alasan perubahan'), { target: { value: 'abc' } });
        expect(save).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Alasan perubahan'), { target: { value: 'Stok laptop habis' } });
        expect(save).toBeEnabled();
        fireEvent.click(save);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            items: [{ catalogId: 'c-1', quantity: 2, existingItemIds: ['u-1', 'u-2'] }], reason: 'Stok laptop habis',
        }));
    });

    it('keeps the kept units when the quantity goes down, and the save stays blocked while a required field is empty', () => {
        render(<EditItemsDialog open onClose={vi.fn()} catalog={catalog} initial={existing} onSubmit={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Alasan perubahan'), { target: { value: 'Stok laptop habis' } });
        pick(/Lisensi Software/);
        expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeDisabled();
    });
});
