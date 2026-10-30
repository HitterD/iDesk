import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionField } from '../QuestionField';
import type { CsiFormDimension } from '../../../types';

type Answer = Parameters<typeof QuestionField>[0]['answer'];
const dimension = (patch: Partial<CsiFormDimension>): CsiFormDimension => ({
    periodRateeDimensionId: 'q1', name: 'Pertanyaan', description: null, type: 'STAR', required: true, options: [], ...patch,
});
const OPTIONS = [{ label: 'Sangat baik', points: 5 }, { label: 'Cukup', points: 3 }, { label: 'Buruk', points: 1 }];
const element = (patch: Partial<CsiFormDimension>, answer?: Answer, missing = false, onChange = vi.fn()) => (
    <QuestionField dimension={dimension(patch)} rateeName="Andi" answer={answer} missing={missing} onChange={onChange} />
);

afterEach(cleanup);

describe('QuestionField', () => {
    it('STAR renders large stars and reports the score', () => {
        const onChange = vi.fn();
        render(element({ name: 'Kecepatan', description: 'Seberapa cepat' }, undefined, false, onChange));
        expect(screen.getByText('Seberapa cepat')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Kecepatan untuk Andi' })).getByRole('radio', { name: '4 dari 5' }));
        expect(onChange).toHaveBeenCalledWith({ score: 4 });
    });

    it('SCALE renders radio cards without points and reports optionIndex', async () => {
        const onChange = vi.fn();
        render(element({ name: 'Keramahan', type: 'SCALE', options: OPTIONS }, undefined, false, onChange));
        const group = screen.getByRole('radiogroup', { name: /Keramahan/ });
        expect(within(group).getAllByRole('radio')).toHaveLength(3);
        expect(group).not.toHaveTextContent(/\d/);
        await userEvent.setup().click(within(group).getByRole('radio', { name: 'Cukup' }));
        expect(onChange).toHaveBeenCalledWith({ optionIndex: 1 });
    });

    it('CHOICE shows the selected option', () => {
        render(element({ name: 'Frekuensi', type: 'CHOICE', options: [{ label: 'Sering', points: null }, { label: 'Jarang', points: null }] }, { optionIndex: 1 }));
        expect(screen.getByRole('radio', { name: 'Jarang' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Sering' })).toHaveAttribute('aria-checked', 'false');
    });

    it('ChoiceList arrow keys move the selection', () => {
        const onChange = vi.fn();
        render(element({ type: 'SCALE', options: OPTIONS }, { optionIndex: 0 }, false, onChange));
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sangat baik' }), { key: 'ArrowDown' });
        expect(onChange).toHaveBeenLastCalledWith({ optionIndex: 1 });
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sangat baik' }), { key: 'ArrowUp' });
        expect(onChange).toHaveBeenLastCalledWith({ optionIndex: 2 });
    });

    it('TEXT renders a limited textarea with a counter near the limit', () => {
        const onChange = vi.fn();
        const text = { name: 'Saran', type: 'TEXT' as const, required: false };
        const { rerender } = render(element(text, undefined, false, onChange));
        const box = screen.getByRole('textbox', { name: /Saran/ });
        expect(box).toHaveAttribute('maxlength', '1000');
        expect(screen.queryByText(/\/1000/)).not.toBeInTheDocument();
        fireEvent.change(box, { target: { value: 'Bagus' } });
        expect(onChange).toHaveBeenCalledWith({ text: 'Bagus' });
        rerender(element(text, { text: 'x'.repeat(900) }, false, onChange));
        expect(screen.getByText('900/1000')).toBeInTheDocument();
    });

    it('shows a required marker only for required questions', () => {
        const { unmount } = render(element({ name: 'Wajib', required: true }));
        expect(screen.getByText('wajib')).toHaveClass('sr-only');
        unmount();
        render(element({ name: 'Opsional', required: false }));
        expect(screen.queryByText('wajib')).not.toBeInTheDocument();
    });

    it('missing required gets the ring and an sr-only note', () => {
        const { container } = render(element({ type: 'SCALE', options: OPTIONS }, undefined, true));
        expect(container.querySelector('[data-missing]')).toBeInTheDocument();
        expect(screen.getByText('Belum dijawab')).toHaveClass('sr-only');
    });
});
