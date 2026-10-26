import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CsiApi } from '../../../../api/csi.api';
import type { CsiDimension } from '../../../../types';
import { renderWithQuery } from '../../__tests__/renderWithQuery';
import { QuestionList } from '../QuestionList';

vi.mock('../../../../api/csi.api', () => ({
    CsiApi: { dimensions: vi.fn(), createDimension: vi.fn(), updateDimension: vi.fn(), reorderDimensions: vi.fn(), applyTemplate: vi.fn() },
}));

const make = (id: string, name: string, over: Partial<CsiDimension> = {}): CsiDimension => ({
    id, scope: 'ICT', name, description: null, type: 'STAR', required: true, isActive: true, sortOrder: 0, options: [], createdAt: '', updatedAt: '', ...over,
});
const FIRST = make('q1', 'Kecepatan');
const INACTIVE = make('q2', 'Lama', { isActive: false });

beforeEach(() => {
    vi.mocked(CsiApi.dimensions).mockResolvedValue([FIRST, INACTIVE]);
    vi.mocked(CsiApi.updateDimension).mockResolvedValue(FIRST);
    vi.mocked(CsiApi.reorderDimensions).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('QuestionList', () => {
    it('loads every question including inactive ones but shows only active ones by default', async () => {
        renderWithQuery(<QuestionList scope="ict" />);
        expect(await screen.findByDisplayValue('Kecepatan')).toBeInTheDocument();
        expect(CsiApi.dimensions).toHaveBeenCalledWith('ict', true);
        expect(screen.queryByDisplayValue('Lama')).not.toBeInTheDocument();
        await userEvent.setup().click(screen.getByRole('switch', { name: 'Tampilkan nonaktif' }));
        expect(await screen.findByDisplayValue('Lama')).toBeInTheDocument();
    });

    it('new question appended and saved on blur', async () => {
        const created = make('q3', 'Pertanyaan baru');
        vi.mocked(CsiApi.createDimension).mockImplementation(async () => {
            vi.mocked(CsiApi.dimensions).mockResolvedValue([FIRST, INACTIVE, created]);
            return created;
        });
        const user = userEvent.setup();
        renderWithQuery(<QuestionList scope="ict" />);
        await screen.findByDisplayValue('Kecepatan');
        await user.click(screen.getByRole('button', { name: 'Tambah pertanyaan' }));
        expect(CsiApi.createDimension).toHaveBeenCalledWith('ict', { name: 'Pertanyaan baru', type: 'STAR', required: true });
        const input = await screen.findByDisplayValue('Pertanyaan baru');
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard('Ketepatan solusi');
        await user.tab();
        await waitFor(() => expect(CsiApi.updateDimension).toHaveBeenCalledWith('ict', 'q3', { name: 'Ketepatan solusi' }));
    });

    it('shows an inline error when creating fails and does not throw', async () => {
        vi.mocked(CsiApi.createDimension).mockRejectedValue({ response: { data: { message: 'Terlalu banyak pertanyaan' } } });
        const user = userEvent.setup();
        renderWithQuery(<QuestionList scope="ict" />);
        await screen.findByDisplayValue('Kecepatan');
        await user.click(screen.getByRole('button', { name: 'Tambah pertanyaan' }));
        expect(await screen.findByText('Terlalu banyak pertanyaan')).toBeInTheDocument();
    });

    it('template button calls API after confirm', async () => {
        vi.mocked(CsiApi.applyTemplate).mockResolvedValue([]);
        const user = userEvent.setup();
        renderWithQuery(<QuestionList scope="ict" />);
        await screen.findByDisplayValue('Kecepatan');
        await user.click(screen.getByRole('button', { name: 'Gunakan template CSI 2025' }));
        expect(screen.getByText('Template menambahkan 9 pertanyaan di akhir daftar.')).toBeInTheDocument();
        expect(CsiApi.applyTemplate).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Gunakan template' }));
        await waitFor(() => expect(CsiApi.applyTemplate).toHaveBeenCalledWith('ict'));
    });
});
