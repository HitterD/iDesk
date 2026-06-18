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

    it('renders legend chips', () => {
        render(<ZoomCalendarSubBar {...baseProps} />, { wrapper });
        expect(screen.getAllByText(/saya/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/tim/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/external/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/blokir/i).length).toBeGreaterThan(0);
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
});
