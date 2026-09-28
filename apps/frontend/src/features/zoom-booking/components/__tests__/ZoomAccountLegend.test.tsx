import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomAccountLegend } from '../ZoomAccountLegend';
import { ACCOUNT_PALETTE, buildAccountColorMap } from '../../utils/accountColors';

const accounts = [
    { id: 'a1', name: 'Zoom Admin 1', colorHex: '#007AFF', meetingsCount: 27 },
    { id: 'a2', name: 'Zoom Admin 2', colorHex: '#FF9500', meetingsCount: 20 },
];

const renderLegend = (overrides: Partial<React.ComponentProps<typeof ZoomAccountLegend>> = {}) => {
    const props = {
        accounts,
        visibleAccountIds: new Set(['a1', 'a2']),
        accountScope: 'gabungan',
        onToggleAccount: vi.fn(),
        onShowOnly: vi.fn(),
        onShowAll: vi.fn(),
        onOpenShortcuts: vi.fn(),
        onOpenSettings: vi.fn(),
        ...overrides,
    };
    render(<ZoomAccountLegend {...props} />);
    return props;
};

describe('ZoomAccountLegend', () => {
    it('lists every account as a checked color checkbox with its meeting count', () => {
        renderLegend();
        const boxes = screen.getAllByRole('checkbox');
        expect(boxes).toHaveLength(2);
        expect(boxes[0]).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText('27')).toBeInTheDocument();
        expect(screen.getByText('47 meeting')).toBeInTheDocument();
    });

    it('toggles an account and offers "show all" once one is hidden', async () => {
        const props = renderLegend({ visibleAccountIds: new Set(['a1']) });
        expect(screen.getAllByRole('checkbox')[1]).toHaveAttribute('aria-checked', 'false');
        await userEvent.click(screen.getByRole('checkbox', { name: /Zoom Admin 2/ }));
        expect(props.onToggleAccount).toHaveBeenCalledWith('a2');
        await userEvent.click(screen.getByRole('button', { name: 'Tampilkan semua akun' }));
        expect(props.onShowAll).toHaveBeenCalled();
    });

    it('shows only one account via "Hanya ini"', async () => {
        const props = renderLegend();
        await userEvent.click(screen.getByRole('button', { name: 'Hanya Zoom Admin 1' }));
        expect(props.onShowOnly).toHaveBeenCalledWith('a1');
    });
});

describe('account colors', () => {
    it('gives legacy look-alike defaults distinct palette colors but keeps custom ones', () => {
        const map = buildAccountColorMap([
            { id: 'a', colorHex: '#2563EB', displayOrder: 1 },
            { id: 'b', colorHex: '#0284C7', displayOrder: 4 },
            { id: 'c', colorHex: '#123456', displayOrder: 2 },
        ]);
        expect(map.get('a')).toBe(ACCOUNT_PALETTE[0]);
        expect(map.get('b')).toBe(ACCOUNT_PALETTE[3]);
        expect(map.get('c')).toBe('#123456');
        expect(new Set(ACCOUNT_PALETTE).size).toBe(ACCOUNT_PALETTE.length);
    });
});
