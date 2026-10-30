import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CsiApi } from '../../../api/csi.api';
import type { CsiDepartment } from '../../../types';
import { InlineMasterList } from '../InlineMasterList';
import { renderWithQuery } from './renderWithQuery';

vi.mock('../../../api/csi.api', () => ({
    CsiApi: { departments: vi.fn(), createDepartment: vi.fn(), updateDepartment: vi.fn(), reorderDepartments: vi.fn() },
}));

const dept = (id: string, name: string, over: Partial<CsiDepartment> = {}): CsiDepartment =>
    ({ id, scope: 'ICT', name, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '', ...over });
const FINANCE = dept('d1', 'Finance');

beforeEach(() => {
    vi.mocked(CsiApi.departments).mockResolvedValue([FINANCE, dept('d2', 'Lama', { isActive: false })]);
    vi.mocked(CsiApi.updateDepartment).mockResolvedValue(FINANCE);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('InlineMasterList', () => {
    it('department added inline at the bottom without a dialog and keeps focus for the next one', async () => {
        vi.mocked(CsiApi.createDepartment).mockResolvedValue(dept('d3', 'Produksi'));
        const user = userEvent.setup();
        renderWithQuery(<InlineMasterList scope="ict" />);
        await screen.findByDisplayValue('Finance');
        const add = screen.getByPlaceholderText('Tambah departemen…');
        await user.type(add, 'Produksi{Enter}');
        await waitFor(() => expect(CsiApi.createDepartment).toHaveBeenCalledWith('ict', { name: 'Produksi' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(add).toHaveValue(''));
        expect(add).toHaveFocus();
    });

    it('does not create from an empty input', async () => {
        const user = userEvent.setup();
        renderWithQuery(<InlineMasterList scope="ict" />);
        await user.type(await screen.findByPlaceholderText('Tambah departemen…'), '   {Enter}');
        expect(CsiApi.createDepartment).not.toHaveBeenCalled();
    });

    it('Escape reverts an inline edit', async () => {
        const user = userEvent.setup();
        renderWithQuery(<InlineMasterList scope="ict" />);
        const name = await screen.findByDisplayValue('Finance');
        await user.type(name, ' Group');
        await user.keyboard('{Escape}');
        expect(name).toHaveValue('Finance');
        await user.tab();
        expect(CsiApi.updateDepartment).not.toHaveBeenCalled();
    });

    it('saves a renamed department on blur', async () => {
        const user = userEvent.setup();
        renderWithQuery(<InlineMasterList scope="ict" />);
        const name = await screen.findByDisplayValue('Finance');
        await user.type(name, ' Group');
        await user.tab();
        await waitFor(() => expect(CsiApi.updateDepartment).toHaveBeenCalledWith('ict', 'd1', { name: 'Finance Group' }));
    });

    it('hides inactive departments until asked and offers Aktifkan for them', async () => {
        const user = userEvent.setup();
        renderWithQuery(<InlineMasterList scope="ict" />);
        await screen.findByDisplayValue('Finance');
        expect(screen.queryByDisplayValue('Lama')).not.toBeInTheDocument();
        await user.click(screen.getByRole('switch', { name: 'Tampilkan nonaktif' }));
        expect(await screen.findByDisplayValue('Lama')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Aktifkan' }));
        await waitFor(() => expect(CsiApi.updateDepartment).toHaveBeenCalledWith('ict', 'd2', { isActive: true }));
    });
});
