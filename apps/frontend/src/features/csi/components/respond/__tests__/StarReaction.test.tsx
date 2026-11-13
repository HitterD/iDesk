import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StarReaction } from '../StarReaction';

const LABEL = 'Kecepatan untuk Andi';

/** Controlled like the real form: the parent stores the score. */
function Harness({ initial, onChange }: { initial?: number; onChange: (n: number) => void }) {
    const [value, setValue] = useState(initial);
    return <StarReaction value={value} label={LABEL} onChange={(n) => { setValue(n); onChange(n); }} />;
}

const group = () => within(screen.getByRole('radiogroup', { name: LABEL }));

afterEach(cleanup);

describe('StarReaction', () => {
    it('shows the empty prompt before a value', () => {
        render(<StarReaction label={LABEL} onChange={vi.fn()} />);
        expect(group().getAllByRole('radio')).toHaveLength(5);
        expect(screen.getByText('Pilih bintang')).toBeInTheDocument();
        expect(group().getByRole('radio', { name: '1 bintang' })).toHaveAttribute('tabindex', '0');
    });

    it('clicking the 5th star calls onChange(5) and shows 🤩 and "Sangat memuaskan"', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        await userEvent.setup().click(group().getByRole('radio', { name: '5 bintang' }));
        expect(onChange).toHaveBeenCalledWith(5);
        expect(screen.getByText('🤩')).toBeInTheDocument();
        expect(screen.getByText('Sangat memuaskan')).toBeInTheDocument();
        expect(group().getByRole('radio', { name: '5 bintang' })).toHaveAttribute('aria-checked', 'true');
    });

    it('hover previews without calling onChange', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<StarReaction value={4} label={LABEL} onChange={onChange} />);
        await user.hover(group().getByRole('radio', { name: '2 bintang' }));
        expect(screen.getByText('😕')).toHaveAttribute('data-preview', 'true');
        expect(screen.getByText('Kurang')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        await user.unhover(screen.getByRole('radiogroup', { name: LABEL }));
        expect(screen.getByText('😊')).not.toHaveAttribute('data-preview');
        expect(screen.getByText('Puas')).toBeInTheDocument();
    });

    it('ArrowLeft lowers the value', () => {
        const onChange = vi.fn();
        render(<Harness initial={4} onChange={onChange} />);
        fireEvent.keyDown(group().getByRole('radio', { name: '4 bintang' }), { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(group().getByRole('radio', { name: '3 bintang' })).toHaveFocus();
        fireEvent.keyDown(group().getByRole('radio', { name: '3 bintang' }), { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith(4);
    });

    it('ArrowLeft while hovering shows the new value', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<Harness initial={4} onChange={onChange} />);
        await user.hover(group().getByRole('radio', { name: '5 bintang' }));
        expect(screen.getByText('Sangat memuaskan')).toBeInTheDocument();
        fireEvent.keyDown(group().getByRole('radio', { name: '4 bintang' }), { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith(3);
        expect(screen.getByText('Cukup')).toBeInTheDocument();
        expect(screen.getByText('😐')).not.toHaveAttribute('data-preview');
        expect(screen.queryByText('Sangat memuaskan')).not.toBeInTheDocument();
    });
});
