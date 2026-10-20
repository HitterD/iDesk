import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchablePicker } from '../searchable-picker';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../dialog';

// jsdom lacks the layout APIs used by cmdk and Radix (existing overlay test pattern).
globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};

const options = [
    { value: 'agent-a', label: 'Nama Sama', description: 'satu@idesk.test' },
    { value: 'agent-b', label: 'Nama Sama', description: 'dua@idesk.test' },
    { value: 'locked', label: 'Tidak tersedia', disabled: true },
];

function ControlledPicker() {
    const [value, setValue] = useState('agent-b');
    return <SearchablePicker value={value} options={options} onValueChange={setValue}
        label="Pilih PIC" searchPlaceholder="Cari PIC" />;
}

const zIndexOf = (element: Element) => {
    const match = element.className.toString().match(/z-\[(\d+)\]|z-(\d+)/);
    return match ? Number(match[1] ?? match[2]) : 0;
};

describe('SearchablePicker', () => {
    it('marks the committed selection by ID, not duplicate label or keyboard highlight', async () => {
        const user = userEvent.setup();
        render(<ControlledPicker />);
        const trigger = screen.getByRole('button', { name: 'Pilih PIC' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await user.click(trigger);
        const rows = screen.getAllByRole('option', { name: /Nama Sama/ });
        expect(rows[0]).toHaveAttribute('data-checked', 'false');
        expect(rows[1]).toHaveAttribute('data-checked', 'true');
        expect(within(rows[0]).queryByTestId('selected-check')).not.toBeInTheDocument();
        expect(within(rows[1]).getByTestId('selected-check')).toBeInTheDocument();
    });

    it('opens with arrows, searches descriptions, selects with Enter and restores focus', async () => {
        const user = userEvent.setup();
        render(<ControlledPicker />);
        const trigger = screen.getByRole('button', { name: 'Pilih PIC' });
        trigger.focus();
        await user.keyboard('{ArrowDown}');
        const search = await screen.findByRole('combobox', { name: 'Cari PIC' });
        expect(search).toHaveFocus();
        await user.type(search, 'satu@');
        await user.keyboard('{ArrowDown}{Enter}');
        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
        expect(trigger).toHaveFocus();
        await user.click(trigger);
        expect(screen.getByRole('option', { name: /satu@/ })).toHaveAttribute('data-checked', 'true');
        await user.keyboard('{Escape}');
        await waitFor(() => expect(trigger).toHaveFocus());
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows no results, does not select disabled options, and closes on outside click', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(<><button>Di luar</button><SearchablePicker value="" options={options}
            onValueChange={onValueChange} label="Pilih PIC" searchPlaceholder="Cari PIC" /></>);
        await user.click(screen.getByRole('button', { name: 'Pilih PIC' }));
        const disabled = screen.getByRole('option', { name: 'Tidak tersedia' });
        expect(disabled).toHaveAttribute('aria-disabled', 'true');
        await user.click(disabled);
        expect(onValueChange).not.toHaveBeenCalled();
        await user.type(screen.getByRole('combobox'), 'zzzz');
        expect(screen.getByText('Tidak ditemukan. Coba kata lain.')).toBeVisible();
        await user.keyboard('{Enter}');
        expect(onValueChange).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Di luar' }));
        expect(screen.getByRole('button', { name: 'Pilih PIC' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps disabled trigger closed and supports optional search', async () => {
        const user = userEvent.setup();
        const callback = vi.fn();
        const { rerender } = render(<SearchablePicker value="agent-a" options={options}
            onValueChange={callback} label="Pilih PIC" disabled />);
        await user.click(screen.getByRole('button', { name: 'Pilih PIC' }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(callback).not.toHaveBeenCalled();
        rerender(<SearchablePicker value="agent-a" options={options}
            onValueChange={callback} label="Pilih PIC" />);
        await user.click(screen.getByRole('button', { name: 'Pilih PIC' }));
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        await user.keyboard('{ArrowDown}{Enter}');
        expect(callback).toHaveBeenCalledWith('agent-b');
    });

    it('portals above a dialog, bounds the viewport and Escape leaves the dialog open', async () => {
        const user = userEvent.setup();
        render(<Dialog open><DialogContent><DialogTitle>Pengalihan</DialogTitle>
            <DialogDescription>Pilih PIC tiket</DialogDescription><ControlledPicker />
        </DialogContent></Dialog>);
        const trigger = screen.getByRole('button', { name: 'Pilih PIC' });
        await user.click(trigger);
        const list = screen.getByRole('listbox');
        const panel = list.closest('[data-radix-popper-content-wrapper]')!.firstElementChild!;
        const dialog = screen.getByRole('dialog', { name: 'Pengalihan' });
        expect(dialog).not.toContainElement(list);
        expect(zIndexOf(panel)).toBeGreaterThan(zIndexOf(dialog));
        expect(panel.className).toContain('picker-panel');
        await user.keyboard('{Escape}');
        expect(dialog).toBeVisible();
        await waitFor(() => expect(trigger).toHaveFocus());
    });
});
