import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiReadiness } from '../../../types';
import { ReadinessList } from '../ReadinessList';

afterEach(cleanup);

const readiness = (warnings?: CsiReadiness['warnings']): CsiReadiness => ({
    ready: true, checks: [{ key: 'departments', ok: true, label: 'Minimal 1 departemen aktif' }], ...(warnings ? { warnings } : {}),
});

describe('ReadinessList hidden-ratee warnings', () => {
    it('shows each warning with an Ubah that opens Info survei', async () => {
        const onEdit = vi.fn();
        render(<ReadinessList readiness={readiness([{ key: 'teamHidden', label: '2 tim tidak akan tampil karena Penilaian tim dimatikan' }])} onEdit={onEdit} />);
        const list = screen.getByRole('list', { name: 'Peringatan' });
        expect(list).toHaveTextContent('2 tim tidak akan tampil karena Penilaian tim dimatikan');
        await userEvent.click(within(list).getByRole('button', { name: /Ubah/ }));
        expect(onEdit).toHaveBeenCalledWith('info');
    });

    it('renders nothing extra without warnings (older payloads too)', () => {
        render(<ReadinessList readiness={readiness()} onEdit={vi.fn()} />);
        expect(screen.queryByRole('list', { name: 'Peringatan' })).toBeNull();
    });
});
