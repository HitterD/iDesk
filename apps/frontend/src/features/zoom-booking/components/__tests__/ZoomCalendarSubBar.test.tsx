import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ZoomCalendarSubBar } from '../ZoomCalendarSubBar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
);

const baseProps = {
    isLive: true,
    lastSyncAt: new Date(),
    onOpenShortcuts: vi.fn(),
    onOpenSettings: vi.fn(),
    accountScope: 'gabungan' as const,
    activeAccountName: 'Zoom Utama',
    activeAccountColor: '#3b82f6',
    showAutoPickHint: true,
};

describe('ZoomCalendarSubBar', () => {
    it('does not render Quick book buttons (1 hour / Custom)', () => {
        render(<ZoomCalendarSubBar {...baseProps} />, { wrapper });
        expect(screen.queryByRole('button', { name: /1 hour/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /custom/i })).not.toBeInTheDocument();
    });

    it('does not render view switcher (moved to header)', () => {
        render(<ZoomCalendarSubBar {...baseProps} />, { wrapper });
        expect(screen.queryByTestId('view-switcher')).not.toBeInTheDocument();
    });

    it('does not render legend chips (simplified UI)', () => {
        render(<ZoomCalendarSubBar {...baseProps} />, { wrapper });
        expect(screen.queryByText(/^tim$/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/^external$/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/^blokir$/i)).not.toBeInTheDocument();
    });

    it('shows Live indicator when isLive is true', () => {
        render(<ZoomCalendarSubBar {...baseProps} isLive={true} />, { wrapper });
        expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
    });

    it('shows Offline indicator when isLive is false', () => {
        render(<ZoomCalendarSubBar {...baseProps} isLive={false} />, { wrapper });
        expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    });

    it('shows Gabungan indicator with active account name', () => {
        render(
            <ZoomCalendarSubBar
                {...baseProps}
                accountScope="gabungan"
                activeAccountName="Zoom Cadangan"
            />,
            { wrapper }
        );
        expect(screen.getByTestId('gabungan-indicator')).toHaveTextContent(/gabungan/i);
        expect(screen.getByTestId('gabungan-indicator')).toHaveTextContent(/zoom cadangan/i);
    });

    it('does not show Gabungan indicator when an individual account is selected', () => {
        render(<ZoomCalendarSubBar {...baseProps} accountScope="zoom-1" />, { wrapper });
        expect(screen.queryByTestId('gabungan-indicator')).not.toBeInTheDocument();
    });

    it('calls onOpenShortcuts when shortcuts button is clicked', async () => {
        const onOpenShortcuts = vi.fn();
        const user = userEvent.setup();
        render(<ZoomCalendarSubBar {...baseProps} onOpenShortcuts={onOpenShortcuts} />, { wrapper });
        await user.click(screen.getByRole('button', { name: /keyboard shortcuts/i }));
        expect(onOpenShortcuts).toHaveBeenCalledOnce();
    });

    it('calls onOpenSettings when settings button is clicked', async () => {
        const onOpenSettings = vi.fn();
        const user = userEvent.setup();
        render(<ZoomCalendarSubBar {...baseProps} onOpenSettings={onOpenSettings} />, { wrapper });
        await user.click(screen.getByRole('button', { name: /^settings$/i }));
        expect(onOpenSettings).toHaveBeenCalledOnce();
    });

    it('renders interactive account filter chips with count and handles toggle in Gabungan mode', async () => {
        const onToggle = vi.fn();
        const accounts = [
            { id: 'acc-1', name: 'Zoom 1', colorHex: '#ef4444', meetingsCount: 12 },
            { id: 'acc-2', name: 'Zoom 2', colorHex: '#3b82f6', meetingsCount: 5 },
        ];
        const user = userEvent.setup();

        render(
            <ZoomCalendarSubBar
                {...baseProps}
                accounts={accounts}
                activeFilterAccountIds={new Set(['acc-1', 'acc-2'])}
                onToggleAccountFilter={onToggle}
            />,
            { wrapper }
        );

        expect(screen.getByText('Zoom 1')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('Zoom 2')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();

        await user.click(screen.getByText('Zoom 1'));
        expect(onToggle).toHaveBeenCalledWith('acc-1');
    });

    it('renders Reset button when filters are active in Gabungan mode and calls onSelectAllAccounts', async () => {
        const onSelectAll = vi.fn();
        const accounts = [
            { id: 'acc-1', name: 'Zoom 1', colorHex: '#ef4444', meetingsCount: 12 },
            { id: 'acc-2', name: 'Zoom 2', colorHex: '#3b82f6', meetingsCount: 5 },
        ];
        const user = userEvent.setup();

        render(
            <ZoomCalendarSubBar
                {...baseProps}
                accounts={accounts}
                activeFilterAccountIds={new Set(['acc-1'])} // acc-2 unselected
                onSelectAllAccounts={onSelectAll}
            />,
            { wrapper }
        );

        const resetBtn = screen.getByRole('button', { name: /reset/i });
        expect(resetBtn).toBeInTheDocument();
        await user.click(resetBtn);
        expect(onSelectAll).toHaveBeenCalledOnce();
    });

    it('in single account mode, renders button to switch back to Gabungan', async () => {
        const onSelectAccount = vi.fn();
        const user = userEvent.setup();

        render(
            <ZoomCalendarSubBar
                {...baseProps}
                accountScope="acc-1"
                activeAccountName="Zoom Admin 1"
                onSelectAccount={onSelectAccount}
            />,
            { wrapper }
        );

        const gabunganBtn = screen.getByRole('button', { name: /ke mode gabungan/i });
        expect(gabunganBtn).toBeInTheDocument();
        await user.click(gabunganBtn);
        expect(onSelectAccount).toHaveBeenCalledWith('gabungan');
    });
});
