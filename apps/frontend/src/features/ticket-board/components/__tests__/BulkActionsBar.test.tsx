import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionsBar } from '../BulkActionsBar';

vi.mock('@/stores/useAuth', () => ({
    useAuth: (selector?: (state: unknown) => unknown) => {
        const state = { user: { id: 'me', fullName: 'Agent Saya', role: 'AGENT_OPERATIONAL_SUPPORT' } };
        return selector ? selector(state) : state;
    },
}));

function Harness({ onChangeStatus = vi.fn().mockResolvedValue(undefined), onDelete, onMerge = vi.fn(), onAssign = vi.fn() }: {
    onChangeStatus?: (status: string) => Promise<void>; onDelete?: () => void; onMerge?: () => void; onAssign?: () => void;
}) {
    const [selected, setSelected] = React.useState(0);
    return (
        <>
            <button type="button" onClick={() => setSelected((n) => n + 1)}>pilih</button>
            <BulkActionsBar selectedCount={selected} onAssign={onAssign} onChangeStatus={onChangeStatus}
                onClear={() => setSelected(0)} onMerge={onMerge} onDelete={onDelete} />
        </>
    );
}

describe('BulkActionsBar (floating bar)', () => {
    it('appears on selection with the count and the close button clears it', () => {
        render(<Harness />);
        expect(screen.queryByRole('toolbar', { name: 'Aksi massal' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('pilih'));
        const bar = screen.getByRole('toolbar', { name: 'Aksi massal' });
        expect(bar).toHaveTextContent('1tiket dipilih');
        fireEvent.click(screen.getByRole('button', { name: 'Batal pilih' }));
        expect(screen.queryByRole('toolbar', { name: 'Aksi massal' })).not.toBeInTheDocument();
    });

    it('clears the selection with Escape', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('pilih'));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('toolbar', { name: 'Aksi massal' })).not.toBeInTheDocument();
    });

    it('enables Gabungkan only from two tickets and shows Hapus only when allowed', () => {
        const onMerge = vi.fn();
        const { unmount } = render(<Harness onMerge={onMerge} />);
        fireEvent.click(screen.getByText('pilih'));
        expect(screen.getByRole('button', { name: /Gabungkan/ })).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Hapus/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('pilih'));
        fireEvent.click(screen.getByRole('button', { name: /Gabungkan/ }));
        expect(onMerge).toHaveBeenCalledTimes(1);
        unmount();
        const onDelete = vi.fn();
        render(<Harness onDelete={onDelete} />);
        fireEvent.click(screen.getByText('pilih'));
        fireEvent.click(screen.getByRole('button', { name: /Hapus/ }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('keeps the production bulk statuses behind the Status menu', async () => {
        const user = userEvent.setup();
        const onChangeStatus = vi.fn().mockResolvedValue(undefined);
        render(<Harness onChangeStatus={onChangeStatus} />);
        await user.click(screen.getByText('pilih'));
        await user.click(screen.getByRole('button', { name: /Status/ }));
        const items = await screen.findAllByRole('menuitem');
        expect(items.map((item) => item.textContent)).toEqual(['In Progress', 'Resolved']);
        await user.click(screen.getByRole('menuitem', { name: 'Resolved' }));
        await waitFor(() => expect(onChangeStatus).toHaveBeenCalledWith('RESOLVED', {}));
    });
});
