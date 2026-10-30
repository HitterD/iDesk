import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CsiDimension, UpdateCsiDimension } from '../../../../types';
import { QuestionCard } from '../QuestionCard';

afterEach(cleanup);

const QUESTION: CsiDimension = {
    id: 'q1', scope: 'ICT', name: 'Kecepatan respon', description: null, type: 'SCALE', required: true, isActive: true, sortOrder: 0,
    options: [{ label: 'Baik', points: 5 }, { label: 'Buruk', points: 1 }], createdAt: '', updatedAt: '',
};
const HANDLE = <button type="button" aria-label="Ubah urutan pertanyaan">grip</button>;

/** Mirrors the list: a successful save updates the question prop. */
function Harness({ onSave }: { onSave: (id: string, payload: UpdateCsiDimension) => Promise<unknown> }) {
    const [question, setQuestion] = useState(QUESTION);
    const save = async (id: string, payload: UpdateCsiDimension) => {
        await onSave(id, payload);
        setQuestion((current) => ({ ...current, ...payload } as CsiDimension));
    };
    return <QuestionCard question={question} handle={HANDLE} onSave={save} />;
}

describe('QuestionCard', () => {
    it('switching to TEXT hides options and clears them', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<Harness onSave={onSave} />);
        expect(screen.getByLabelText('Label pilihan 1')).toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole('radio', { name: 'Jawaban teks' }));
        expect(onSave).toHaveBeenCalledWith('q1', { type: 'TEXT', options: [] });
        expect(await screen.findByRole('radio', { name: 'Jawaban teks', checked: true })).toBeInTheDocument();
        expect(screen.queryByLabelText('Label pilihan 1')).not.toBeInTheDocument();
    });

    it('seeds the Frekuensi preset when switching an empty STAR question to CHOICE', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const star = { ...QUESTION, type: 'STAR' as const, options: [] };
        render(<QuestionCard question={star} handle={HANDLE} onSave={onSave} />);
        await userEvent.setup().click(screen.getByRole('radio', { name: 'Pilihan tanpa nilai' }));
        const payload = onSave.mock.calls[0][1] as UpdateCsiDimension;
        expect(payload.type).toBe('CHOICE');
        expect(payload.options?.map((option) => option.label)).toEqual(['< 5 kali', '5 - 10 kali', '> 10 kali']);
    });

    it('saves the title on blur only when it changed, with the trimmed value', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<QuestionCard question={QUESTION} handle={HANDLE} onSave={onSave} />);
        const title = screen.getByRole('textbox', { name: 'Pertanyaan' });
        await user.click(title);
        await user.tab();
        expect(onSave).not.toHaveBeenCalled();
        await user.clear(title);
        await user.type(title, '  Ketepatan solusi ');
        await user.tab();
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith('q1', { name: 'Ketepatan solusi' });
    });

    it('Enter saves once and the following blur does not save again', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<Harness onSave={onSave} />);
        const title = screen.getByRole('textbox', { name: 'Pertanyaan' });
        await user.type(title, ' baru{Enter}');
        await user.tab();
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('Escape reverts an inline edit without saving', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<QuestionCard question={QUESTION} handle={HANDLE} onSave={onSave} />);
        const title = screen.getByRole('textbox', { name: 'Pertanyaan' });
        await user.type(title, ' tambahan');
        await user.keyboard('{Escape}');
        expect(title).toHaveValue('Kecepatan respon');
        await user.tab();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('does not save an empty title and shows a message', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<QuestionCard question={QUESTION} handle={HANDLE} onSave={onSave} />);
        await user.clear(screen.getByRole('textbox', { name: 'Pertanyaan' }));
        await user.tab();
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('Pertanyaan tidak boleh kosong')).toBeInTheDocument();
    });

    it('keeps the edit and shows the server message when saving fails', async () => {
        const user = userEvent.setup();
        const failure = Object.assign(new Error('x'), { response: { data: { message: 'Pertanyaan sudah dipakai' } } });
        render(<QuestionCard question={QUESTION} handle={HANDLE} onSave={vi.fn().mockRejectedValue(failure)} />);
        const title = screen.getByRole('textbox', { name: 'Pertanyaan' });
        await user.type(title, ' x');
        await user.tab();
        expect(await screen.findByText('Pertanyaan sudah dipakai')).toBeInTheDocument();
        expect(title).toHaveValue('Kecepatan respon x');
    });

    it('toggles required and active state with one click each', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<QuestionCard question={QUESTION} handle={HANDLE} onSave={onSave} />);
        await user.click(screen.getByRole('switch', { name: 'Wajib diisi' }));
        expect(onSave).toHaveBeenCalledWith('q1', { required: false });
        await user.click(screen.getByRole('button', { name: 'Nonaktifkan' }));
        expect(onSave).toHaveBeenCalledWith('q1', { isActive: false });
    });

    it('offers Aktifkan for an inactive question', () => {
        render(<QuestionCard question={{ ...QUESTION, isActive: false }} handle={HANDLE} onSave={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Aktifkan' })).toBeInTheDocument();
    });
});
