import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModernDateTimePicker } from '../ModernDateTimePicker';

function Picker({ initial, minDate }: { initial: Date; minDate?: Date }) {
    const [value, setValue] = useState(initial);
    return <>
        <ModernDateTimePicker value={value} onChange={setValue} minDate={minDate} />
        <output aria-label="Nilai">{value.getDate()} {value.getHours()}:{value.getMinutes()}</output>
    </>;
}

const open = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('ModernDateTimePicker', () => {
    it('shows only the days of the viewed month', () => {
        render(<Picker initial={new Date(2030, 4, 15, 9, 0)} />);
        open(/15 Mei 2030/);

        expect(screen.getByRole('button', { name: '31 Mei 2030' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '30 April 2030' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '1 Juni 2030' })).not.toBeInTheDocument();
    });

    it('cannot pick a quick hour or a month that is already past', () => {
        const minDate = new Date(2030, 4, 15, 13, 20);
        render(<Picker initial={new Date(2030, 4, 15, 14, 0)} minDate={minDate} />);
        open(/15 Mei 2030/);

        expect(screen.getByRole('button', { name: '09.00' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '16.00' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Bulan sebelumnya' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '14 Mei 2030' })).toBeDisabled();
    });

    it('keeps the time when another day is picked, and marks the chosen quick hour', () => {
        render(<Picker initial={new Date(2030, 4, 15, 9, 0)} />);
        open(/15 Mei 2030/);

        fireEvent.click(screen.getByRole('button', { name: '20 Mei 2030' }));
        expect(screen.getByLabelText('Nilai')).toHaveTextContent('20 9:0');
        expect(screen.getByRole('button', { name: '20 Mei 2030' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: '14.00' }));
        expect(screen.getByLabelText('Nilai')).toHaveTextContent('20 14:0');
        expect(screen.getByRole('button', { name: '14.00' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('moves between months with the header arrows', () => {
        render(<Picker initial={new Date(2030, 4, 15, 9, 0)} />);
        open(/15 Mei 2030/);

        fireEvent.click(screen.getByRole('button', { name: 'Bulan berikutnya' }));

        expect(screen.getByRole('heading', { name: /juni 2030/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1 Juni 2030' })).toBeInTheDocument();
    });
});
