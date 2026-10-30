import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelectCheckbox } from '../BulkActionsBar';

describe('SelectCheckbox as a queue cell', () => {
    it('toggles from anywhere in the cell and never bubbles to the row', () => {
        const onChange = vi.fn();
        const onRowClick = vi.fn();
        render(
            <div role="presentation" onClick={onRowClick}>
                <SelectCheckbox cell checked={false} onChange={onChange} label="Pilih semua tiket yang tampil" />
            </div>,
        );
        const checkbox = screen.getByRole('checkbox', { name: 'Pilih semua tiket yang tampil' });
        const cell = checkbox.closest('.queue-select-cell');
        expect(cell).not.toBeNull();
        fireEvent.click(cell!);
        expect(onChange).toHaveBeenCalledWith(true);
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it('keeps the plain inline checkbox for other callers', () => {
        const onChange = vi.fn();
        render(<SelectCheckbox checked onChange={onChange} />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox.closest('.queue-select-cell')).toBeNull();
        fireEvent.click(checkbox);
        expect(onChange).toHaveBeenCalledWith(false);
    });
});
