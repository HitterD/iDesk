import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewDialog, reviewPayload, reviewReady } from '../ReviewDialog';

// The real picker loads users over the network; the dialog only needs "pick a person".
vi.mock('@/features/request-center/components/eform/ManagerSelector', () => ({
    ManagerSelector: ({ label, onSelect, selectedId }: { label?: string; onSelect: (id: string) => void; selectedId?: string }) => (
        <button type="button" onClick={() => onSelect(selectedId ? '' : `${label}-id`)}>{label}: {selectedId || 'belum dipilih'}</button>
    ),
}));

afterEach(cleanup);

describe('reviewReady', () => {
    it('route NONE needs nothing more', () => {
        expect(reviewReady({ route: 'NONE', managerId: '', gmId: '', hardwareSource: 'IT_STOCK' }, true)).toBe(true);
    });

    it('MANAGER needs a manager; MANAGER_GM needs a manager and a GM', () => {
        expect(reviewReady({ route: 'MANAGER', managerId: '', gmId: '', hardwareSource: 'NON_BUDGET' }, true)).toBe(false);
        expect(reviewReady({ route: 'MANAGER', managerId: 'm', gmId: '', hardwareSource: 'NON_BUDGET' }, true)).toBe(true);
        expect(reviewReady({ route: 'MANAGER_GM', managerId: 'm', gmId: '', hardwareSource: 'NON_BUDGET' }, true)).toBe(false);
        expect(reviewReady({ route: 'MANAGER_GM', managerId: 'm', gmId: 'g', hardwareSource: 'NON_BUDGET' }, true)).toBe(true);
    });

    it('a hardware request also needs the source of the items; an e-form does not', () => {
        expect(reviewReady({ route: 'NONE', managerId: '', gmId: '', hardwareSource: null }, true)).toBe(false);
        expect(reviewReady({ route: 'NONE', managerId: '', gmId: '', hardwareSource: null }, false)).toBe(true);
    });
});

describe('reviewPayload', () => {
    it('drops people the route does not use and the source of an e-form', () => {
        expect(reviewPayload({ route: 'NONE', managerId: 'm', gmId: 'g', hardwareSource: 'IT_STOCK' }, true, ' halo ')).toEqual({ route: 'NONE', hardwareSource: 'IT_STOCK', message: 'halo' });
        expect(reviewPayload({ route: 'MANAGER', managerId: 'm', gmId: 'g', hardwareSource: null }, false, '')).toEqual({ route: 'MANAGER', managerId: 'm' });
        expect(reviewPayload({ route: 'MANAGER_GM', managerId: 'm', gmId: 'g', hardwareSource: 'NON_BUDGET' }, true, '')).toEqual({ route: 'MANAGER_GM', managerId: 'm', gmId: 'g', hardwareSource: 'NON_BUDGET' });
    });
});

describe('ReviewDialog', () => {
    it('starts from what the requester proposed and sends the chosen route', async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(<ReviewDialog open onClose={vi.fn()} isHardware proposedManagerId="m-1" onSubmit={onSubmit} />);
        const send = screen.getByRole('button', { name: 'Kirim ke penyetuju' });
        expect(send).toBeDisabled(); // hardware: the source is still to choose
        fireEvent.click(screen.getByRole('radio', { name: /Non-budget/ }));
        expect(send).toBeEnabled();
        fireEvent.click(send);
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ route: 'MANAGER', managerId: 'm-1', hardwareSource: 'NON_BUDGET' }));
    });

    it('choosing "Tanpa persetujuan" changes the button to process directly', () => {
        render(<ReviewDialog open onClose={vi.fn()} isHardware={false} onSubmit={vi.fn()} />);
        fireEvent.click(screen.getByRole('radio', { name: /Tanpa persetujuan/ }));
        expect(screen.getByRole('button', { name: 'Langsung proses' })).toBeEnabled();
    });

    it('shows a GM picker only for Atasan + GM', () => {
        render(<ReviewDialog open onClose={vi.fn()} isHardware={false} proposedManagerId="m-1" onSubmit={vi.fn()} />);
        expect(screen.queryByText(/GM:/)).toBeNull();
        fireEvent.click(screen.getByRole('radio', { name: /Atasan \+ GM/ }));
        expect(screen.getByText(/GM:/)).toBeInTheDocument();
    });
});
