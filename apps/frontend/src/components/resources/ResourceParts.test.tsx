import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ResTable, ResRow } from './ResourceParts';
import { CatalogTable } from '@/features/hardware-request/components/catalog/CatalogTable';
import type { HardwareCatalog } from '@/features/hardware-request/types';

it('keeps hardware catalog controls inside semantic cells', () => {
    const item = { id: 'i1', name: 'Laptop', code: 'HW1', category: 'LAPTOP', active: true, displayOrder: 1 } as HardwareCatalog;
    render(<ResTable label="Katalog" cols="repeat(6, 120px)" head={<><span>Urutan</span><span>Kode</span><span>Nama</span><span>Kategori</span><span>Status</span><span>Aksi</span></>}>
        <CatalogTable items={[item]} onEdit={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} />
    </ResTable>);
    const table = screen.getByRole('table', { name: 'Katalog' });
    expect(within(table).getAllByRole('cell')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Edit Laptop' }).closest('[role="cell"]')).not.toBeNull();
});

it('provides a complete named table with header, body and interactive cells', () => {
    const toggle = vi.fn();
    render(<ResTable label="Resources" cols="200px 120px" head={<><span>Nama</span><span>Aksi</span></>}>
        <ResRow><span>Hardware</span><button onClick={toggle}>Buka detail</button></ResRow>
    </ResTable>);
    const table = screen.getByRole('table', { name: 'Resources' });
    expect(within(table).getAllByRole('rowgroup')).toHaveLength(2);
    expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getAllByRole('cell')).toHaveLength(2);
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Buka detail' }));
    expect(toggle).toHaveBeenCalledOnce();
    expect(table.parentElement).toHaveClass('res-table-scroll');
});
