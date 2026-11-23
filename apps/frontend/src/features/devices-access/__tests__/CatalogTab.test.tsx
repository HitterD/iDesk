import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { CatalogTab } from '../tabs/CatalogTab';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/features/hardware-request/api/http', () => ({ hrHttp: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { hrHttp } from '@/features/hardware-request/api/http';

afterEach(cleanup);

const row = (over: Record<string, unknown> = {}) => ({
    id: 'c-1', code: 'LAPTOP_STD', name: 'Laptop Standar', category: 'LAPTOP', defaultSpecs: { spec: 'i5 / 16GB' }, requiredFields: [], active: true, displayOrder: 10, ...over,
});
const ITEMS = [row(), row({ id: 'c-2', code: 'MON_27', name: 'Monitor 27 inci', category: 'MONITOR', active: false, displayOrder: 20 })];

function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><CatalogTab /></QueryClientProvider>);
}
const ok = (data: unknown) => ({ data: { success: true, data } });

describe('CatalogTab', () => {
    beforeEach(() => {
        vi.mocked(hrHttp.get).mockReset(); vi.mocked(hrHttp.post).mockReset(); vi.mocked(hrHttp.patch).mockReset();
        vi.mocked(hrHttp.get).mockResolvedValue(ok(ITEMS));
        vi.mocked(hrHttp.post).mockResolvedValue(ok(row()));
        vi.mocked(hrHttp.patch).mockResolvedValue(ok(row()));
    });

    it('asks for every item including the hidden ones, and counts them in the KPIs', async () => {
        renderTab();
        expect(await screen.findByText('Laptop Standar')).toBeInTheDocument();
        expect(hrHttp.get).toHaveBeenCalledWith('/catalog', { params: { includeInactive: true } });
        expect(screen.getByText('Monitor 27 inci')).toBeInTheDocument();
        expect(screen.getByLabelText('Total barang')).toHaveTextContent('2');
        expect(screen.getByLabelText('Disembunyikan')).toHaveTextContent('1');
    });

    it('filters by hardware category', async () => {
        renderTab();
        await screen.findByText('Laptop Standar');
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter kategori' }), { target: { value: 'MONITOR' } });
        expect(screen.getByText('Monitor 27 inci')).toBeInTheDocument();
        expect(screen.queryByText('Laptop Standar')).not.toBeInTheDocument();
    });

    it('requires confirmation before deleting a catalogue entry', async () => {
        vi.mocked(hrHttp.delete).mockResolvedValue(ok(undefined));
        renderTab();
        fireEvent.click(await screen.findByRole('button', { name: 'Hapus Laptop Standar' }));
        expect(hrHttp.delete).not.toHaveBeenCalled();
        fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Hapus barang' }));
        await waitFor(() => expect(hrHttp.delete).toHaveBeenCalledWith('/catalog/c-1'));
    });

    it('a hidden item is shown with the status filter "Disembunyikan"', async () => {
        renderTab();
        await screen.findByText('Laptop Standar');
        fireEvent.change(screen.getByLabelText('Filter status'), { target: { value: 'false' } });
        expect(screen.queryByText('Laptop Standar')).toBeNull();
        expect(screen.getByText('Monitor 27 inci')).toBeInTheDocument();
    });

    it('the switch "Tampil di form" saves the new visibility', async () => {
        renderTab();
        fireEvent.click(await screen.findByRole('switch', { name: 'Tampil di form: Laptop Standar' }));
        await waitFor(() => expect(hrHttp.patch).toHaveBeenCalledWith('/catalog/c-1', { active: false }));
    });

    it('a new item: the code is forced to upper case with underscores, and saved with the next order', async () => {
        renderTab();
        await screen.findByText('Laptop Standar');
        fireEvent.click(screen.getByRole('button', { name: 'Tambah barang' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Nama barang'), { target: { value: 'Mouse Wireless' } });
        fireEvent.change(within(dialog).getByLabelText('Kode'), { target: { value: 'mouse wl 2' } });
        expect(within(dialog).getByLabelText('Kode')).toHaveValue('MOUSE_WL_2');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
        await waitFor(() => expect(hrHttp.post).toHaveBeenCalledWith('/catalog', expect.objectContaining({ code: 'MOUSE_WL_2', name: 'Mouse Wireless', active: true, displayOrder: 30 })));
    });

    it('a code another item already uses is refused before anything is sent', async () => {
        renderTab();
        await screen.findByText('Laptop Standar');
        fireEvent.click(screen.getByRole('button', { name: 'Tambah barang' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Nama barang'), { target: { value: 'Laptop lain' } });
        fireEvent.change(within(dialog).getByLabelText('Kode'), { target: { value: 'laptop_std' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
        expect(within(dialog).getByText('Kode sudah dipakai barang lain')).toBeInTheDocument();
        expect(hrHttp.post).not.toHaveBeenCalled();
    });

    it('an extra field of type Pilihan needs at least one option', async () => {
        renderTab();
        await screen.findByText('Laptop Standar');
        fireEvent.click(screen.getByRole('button', { name: 'Tambah barang' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Nama barang'), { target: { value: 'Kabel' } });
        fireEvent.change(within(dialog).getByLabelText('Kode'), { target: { value: 'kabel' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah isian' }));
        fireEvent.change(within(dialog).getByLabelText('Nama isian 1'), { target: { value: 'Warna' } });
        fireEvent.change(within(dialog).getByLabelText('Tipe isian 1'), { target: { value: 'select' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
        expect(within(dialog).getByText('Isian "Warna" bertipe Pilihan butuh minimal satu opsi')).toBeInTheDocument();
        expect(hrHttp.post).not.toHaveBeenCalled();
    });

    it('editing keeps the own code allowed and sends only what the form holds', async () => {
        renderTab();
        fireEvent.click(await screen.findByRole('button', { name: 'Ubah Laptop Standar' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Urutan tampil'), { target: { value: '5' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
        await waitFor(() => expect(hrHttp.patch).toHaveBeenCalledWith('/catalog/c-1', expect.objectContaining({ code: 'LAPTOP_STD', displayOrder: 5 })));
    });
});
