import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StarRating } from '../StarRating';

afterEach(cleanup);

describe('StarRating', () => {
    it('memilih bintang 4 dan menampilkan label Puas', () => {
        const onChange = vi.fn();
        render(<StarRating value={4} onChange={onChange} label="Pelayanan" />);
        fireEvent.click(screen.getByRole('radio', { name: '4 dari 5' }));
        expect(onChange).toHaveBeenCalledWith(4);
        expect(screen.getByText('Puas')).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Pelayanan' })).toBeInTheDocument();
    });

    it('ArrowRight dari 4 memilih 5 dan memindahkan fokus', () => {
        const onChange = vi.fn();
        render(<StarRating value={4} onChange={onChange} label="Pelayanan" />);
        const selected = screen.getByRole('radio', { name: '4 dari 5' });
        selected.focus();
        fireEvent.keyDown(selected, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenCalledWith(5);
        expect(screen.getByRole('radio', { name: '5 dari 5' })).toHaveFocus();
        expect(selected).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: '1 dari 5' })).toHaveAttribute('tabindex', '-1');
    });

    it('read-only adalah gambar tanpa radio, tombol, atau perubahan saat input', () => {
        render(<StarRating value={4} label="Pelayanan" />);
        const image = screen.getByRole('img', { name: '4 dari 5 bintang' });
        fireEvent.click(image);
        fireEvent.keyDown(image, { key: 'ArrowRight' });
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByText('Puas')).toBeInTheDocument();
        expect(image).not.toHaveAttribute('tabindex');
    });

    it.each([
        ['ArrowUp', 4, 5], ['ArrowLeft', 4, 3], ['ArrowDown', 4, 3],
        ['ArrowRight', 5, 5], ['ArrowUp', 5, 5], ['ArrowLeft', 1, 1], ['ArrowDown', 1, 1],
        ['Home', 4, 1], ['End', 2, 5],
    ])('%s dari %s memilih %s', (key, value, expected) => {
        const onChange = vi.fn();
        render(<StarRating value={value} onChange={onChange} label="Pelayanan" />);
        fireEvent.keyDown(screen.getByRole('radio', { name: `${value} dari 5` }), { key });
        expect(onChange).toHaveBeenCalledWith(expected);
        expect(screen.getByRole('radio', { name: `${expected} dari 5` })).toHaveFocus();
    });

    it('nilai kosong men-tab bintang pertama dan pembaruan nilai memindahkan tab stop', () => {
        const onChange = vi.fn();
        const { rerender } = render(<StarRating value={0} onChange={onChange} label="Pelayanan" size="lg" />);
        expect(screen.getByRole('radio', { name: '1 dari 5' })).toHaveAttribute('tabindex', '0');
        rerender(<StarRating value={3} onChange={onChange} label="Pelayanan" size="sm" />);
        const selected = screen.getByRole('radio', { name: '3 dari 5' });
        expect(selected).toHaveAttribute('aria-checked', 'true');
        expect(selected).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: '1 dari 5' })).toHaveAttribute('tabindex', '-1');
        fireEvent.keyDown(selected, { key: 'Escape' });
        expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
        [1, 'Sangat Tidak Puas'], [2, 'Tidak Puas'], [3, 'Cukup'], [4, 'Puas'], [5, 'Sangat Puas'],
    ])('nilai %s memakai label %s', (value, text) => {
        render(<StarRating value={value} label="Pelayanan" />);
        expect(screen.getByText(text)).toBeInTheDocument();
    });
});
