import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodPicker } from '../PeriodPicker';

afterEach(cleanup);

describe('PeriodPicker', () => {
    it('offers the presets of the kind; a preset sets the end date from the start', () => {
        const onChange = vi.fn();
        render(<PeriodPicker kind="VPN" from="2026-11-23" to="" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: '+3 bln' }));
        expect(onChange).toHaveBeenCalledWith({ from: '2026-11-23', to: '2027-02-23' });
    });

    it('a permanent kind can be left without an end date', () => {
        const onChange = vi.fn();
        render(<PeriodPicker kind="EMAIL" from="2026-11-23" to="2027-01-01" onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Permanen' }));
        expect(onChange).toHaveBeenCalledWith({ from: '2026-11-23', to: '' });
    });

    it('says how long the access lasts, and warns past 12 months for VPN', () => {
        const { rerender } = render(<PeriodPicker kind="VPN" from="2026-11-23" to="2026-12-23" onChange={vi.fn()} />);
        expect(screen.getByText(/30 hari/)).toBeInTheDocument();
        rerender(<PeriodPicker kind="VPN" from="2026-11-23" to="2027-12-23" onChange={vi.fn()} />);
        expect(screen.getByText(/melebihi 12 bulan/)).toBeInTheDocument();
    });

    it('an end before the start is called out; no end date reads Permanen for a permanent kind', () => {
        const { rerender } = render(<PeriodPicker kind="VPN" from="2026-11-23" to="2026-11-20" onChange={vi.fn()} />);
        expect(screen.getByText('Tanggal selesai sebelum mulai')).toBeInTheDocument();
        rerender(<PeriodPicker kind="WEBSITE" from="2026-11-23" to="" onChange={vi.fn()} />);
        expect(screen.getByText('Permanen', { selector: 'span' })).toBeInTheDocument();
    });

    it('typing a date reports it, and the end field cannot go before the start', () => {
        const onChange = vi.fn();
        render(<PeriodPicker kind="VPN" from="2026-11-23" to="" onChange={onChange} />);
        const end = screen.getByLabelText(/Sampai/);
        expect(end).toHaveAttribute('min', '2026-11-23');
        fireEvent.change(end, { target: { value: '2027-01-01' } });
        expect(onChange).toHaveBeenCalledWith({ from: '2026-11-23', to: '2027-01-01' });
    });
});
