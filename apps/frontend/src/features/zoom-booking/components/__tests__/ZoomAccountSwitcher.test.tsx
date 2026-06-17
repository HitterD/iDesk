import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomAccountSwitcher } from '../ZoomAccountSwitcher';
import type { AccountLoad } from '../../utils/autoPickAccount';

const accounts: AccountLoad[] = Array.from({ length: 10 }, (_, i) => ({
    id: `acc-${i + 1}`,
    name: `Account ${i + 1}`,
    colorHex: `hsl(${i * 36}, 70%, 50%)`,
    meetingsAtTime: i,
}));

describe('ZoomAccountSwitcher', () => {
    it('renders Gabungan option with DEFAULT badge when current is gabungan', () => {
        render(
            <ZoomAccountSwitcher
                open={true}
                accounts={accounts}
                currentAccountId="gabungan"
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getAllByText(/gabungan/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/default|aktif/i).length).toBeGreaterThan(0);
    });

    it('renders all 10 accounts in the grid', () => {
        render(
            <ZoomAccountSwitcher
                open={true}
                accounts={accounts}
                currentAccountId="gabungan"
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />
        );
        accounts.forEach((acc) => {
            expect(screen.getByText(acc.name)).toBeInTheDocument();
        });
    });

    it('calls onSelect with account id when an account card is clicked', async () => {
        const onSelect = vi.fn();
        render(
            <ZoomAccountSwitcher
                open={true}
                accounts={accounts}
                currentAccountId="gabungan"
                onSelect={onSelect}
                onClose={vi.fn()}
            />
        );
        await userEvent.click(screen.getByText('Account 1'));
        expect(onSelect).toHaveBeenCalledWith('acc-1');
    });

    it('calls onSelect with "gabungan" when Gabungan card clicked', async () => {
        const onSelect = vi.fn();
        render(
            <ZoomAccountSwitcher
                open={true}
                accounts={accounts}
                currentAccountId="acc-1"
                onSelect={onSelect}
                onClose={vi.fn()}
            />
        );
        await userEvent.click(screen.getByText(/gabungan/i).closest('button')!);
        expect(onSelect).toHaveBeenCalledWith('gabungan');
    });

    it('renders nothing when closed', () => {
        render(
            <ZoomAccountSwitcher
                open={false}
                accounts={accounts}
                currentAccountId="gabungan"
                onSelect={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.queryByText('Account 1')).not.toBeInTheDocument();
    });
});
