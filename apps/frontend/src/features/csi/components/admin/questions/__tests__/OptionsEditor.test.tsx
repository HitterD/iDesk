import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CsiOption } from '../../../../types';
import { OptionsEditor } from '../OptionsEditor';

afterEach(cleanup);

const SCALE: CsiOption[] = [{ label: 'Baik', points: 5 }, { label: 'Buruk', points: 1 }];
const CHOICE: CsiOption[] = [{ label: 'Sering', points: null }, { label: 'Jarang', points: null }];

describe('OptionsEditor', () => {
    it('SCALE preset Kepuasan fills 5 options with points 5..1', async () => {
        const onChange = vi.fn();
        render(<OptionsEditor type="SCALE" options={[]} onChange={onChange} />);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Kepuasan' }));
        const saved = onChange.mock.calls[0][0] as CsiOption[];
        expect(saved).toHaveLength(5);
        expect(saved.map((option) => option.points)).toEqual([5, 4, 3, 2, 1]);
    });

    it('offers Kepuasan and Kualitas for SCALE but only Frekuensi for CHOICE', () => {
        const { rerender } = render(<OptionsEditor type="SCALE" options={SCALE} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Kualitas' })).toBeInTheDocument();
        rerender(<OptionsEditor type="CHOICE" options={CHOICE} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Frekuensi' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Kepuasan' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Poin/)).not.toBeInTheDocument();
    });

    it('saves the whole options array on label blur only when changed', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<OptionsEditor type="SCALE" options={SCALE} onChange={onChange} />);
        const first = screen.getByLabelText('Label pilihan 1');
        await user.click(first);
        await user.tab();
        expect(onChange).not.toHaveBeenCalled();
        await user.clear(first);
        await user.type(first, 'Bagus');
        await user.tab();
        expect(onChange).toHaveBeenCalledWith([{ label: 'Bagus', points: 5 }, { label: 'Buruk', points: 1 }]);
    });

    it('changes points through the select and saves', async () => {
        const onChange = vi.fn();
        render(<OptionsEditor type="SCALE" options={SCALE} onChange={onChange} />);
        await userEvent.setup().selectOptions(screen.getByLabelText('Poin pilihan 2'), '2');
        expect(onChange).toHaveBeenCalledWith([{ label: 'Baik', points: 5 }, { label: 'Buruk', points: 2 }]);
    });

    it('shows "Minimal 2 pilihan" and does not save when fewer than 2 remain', async () => {
        const onChange = vi.fn();
        render(<OptionsEditor type="CHOICE" options={CHOICE} onChange={onChange} />);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Hapus pilihan Jarang' }));
        expect(screen.getByText('Minimal 2 pilihan')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('adds an empty option locally and saves once it has a label', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<OptionsEditor type="CHOICE" options={CHOICE} onChange={onChange} />);
        await user.click(screen.getByRole('button', { name: 'Tambah pilihan' }));
        expect(onChange).not.toHaveBeenCalled();
        await user.type(screen.getByLabelText('Label pilihan 3'), 'Kadang');
        await user.tab();
        expect(onChange).toHaveBeenCalledWith([...CHOICE, { label: 'Kadang', points: null }]);
    });

    it('Escape reverts a label edit', async () => {
        const user = userEvent.setup();
        render(<OptionsEditor type="SCALE" options={SCALE} onChange={vi.fn()} />);
        const first = screen.getByLabelText('Label pilihan 1');
        await user.type(first, 'xyz');
        await user.keyboard('{Escape}');
        expect(first).toHaveValue('Baik');
    });
});
