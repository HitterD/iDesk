import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '../segmented-control';

const OPTIONS = [
    { value: 'all', label: 'Semua' },
    { value: 'mine', label: 'Tugas Saya' },
    { value: 'created', label: 'Saya Buat' },
] as const;

describe('SegmentedControl', () => {
    it('exposes a labelled pressed-button group with one decorative sliding thumb', () => {
        render(<SegmentedControl aria-label="Cakupan" options={OPTIONS} value="mine" onValueChange={() => {}} />);
        const group = screen.getByRole('group', { name: 'Cakupan' });
        expect(group).toHaveClass('portal-seg', 'has-thumb');
        expect(screen.getByRole('button', { name: 'Tugas Saya' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Semua' })).toHaveAttribute('aria-pressed', 'false');
        const thumb = group.querySelector('.seg-thumb');
        expect(thumb).toHaveAttribute('aria-hidden', 'true');
        expect(group.querySelectorAll('.seg-thumb')).toHaveLength(1);
    });

    it('reports clicks (including the selected segment) and moves focus with arrow keys', () => {
        const onValueChange = vi.fn();
        render(<SegmentedControl aria-label="Cakupan" options={OPTIONS} value="all" onValueChange={onValueChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Saya Buat' }));
        fireEvent.click(screen.getByRole('button', { name: 'Semua' }));
        expect(onValueChange.mock.calls).toEqual([['created'], ['all']]);
        const first = screen.getByRole('button', { name: 'Semua' });
        first.focus();
        fireEvent.keyDown(first, { key: 'ArrowLeft' });
        expect(screen.getByRole('button', { name: 'Saya Buat' })).toHaveFocus();
    });

    it('hides the thumb when no value is selected', () => {
        render(<SegmentedControl aria-label="Cakupan" options={OPTIONS} value={null} onValueChange={() => {}} />);
        expect(screen.getByRole('group').querySelector('.seg-thumb')).toHaveProperty('hidden', true);
        screen.getAllByRole('button').forEach((button) => expect(button).toHaveAttribute('aria-pressed', 'false'));
    });
});
