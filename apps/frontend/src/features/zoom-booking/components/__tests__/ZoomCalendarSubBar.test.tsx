import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ZoomCalendarSubBar } from '../ZoomCalendarSubBar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
);

const defaultProps = {
    view: 'week' as const,
    onViewChange: vi.fn(),
    onBook1Hour: vi.fn(),
    onBookCustom: vi.fn(),
    onOpenShortcuts: vi.fn(),
    onOpenSettings: vi.fn(),
    isLive: true,
    lastSyncAt: new Date(),
};

describe('ZoomCalendarSubBar', () => {
    it('renders all 4 view switcher buttons', () => {
        render(<ZoomCalendarSubBar {...defaultProps} />, { wrapper });
        expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /day/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /my bookings/i })).toBeInTheDocument();
    });

    it('renders 1-hour and custom quick-book buttons', () => {
        render(<ZoomCalendarSubBar {...defaultProps} />, { wrapper });
        expect(screen.getByRole('button', { name: /^1 hour$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /custom/i })).toBeInTheDocument();
    });

    it('calls onBook1Hour when 1-hour button is clicked', async () => {
        const onBook1Hour = vi.fn();
        render(<ZoomCalendarSubBar {...defaultProps} onBook1Hour={onBook1Hour} />, { wrapper });
        await userEvent.click(screen.getByRole('button', { name: /^1 hour$/i }));
        expect(onBook1Hour).toHaveBeenCalledOnce();
    });

    it('calls onBookCustom when Custom button is clicked', async () => {
        const onBookCustom = vi.fn();
        render(<ZoomCalendarSubBar {...defaultProps} onBookCustom={onBookCustom} />, { wrapper });
        await userEvent.click(screen.getByRole('button', { name: /custom/i }));
        expect(onBookCustom).toHaveBeenCalledOnce();
    });

    it('shows Live indicator when isLive is true', () => {
        render(<ZoomCalendarSubBar {...defaultProps} isLive={true} />, { wrapper });
        expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
    });

    it('shows Offline indicator when isLive is false', () => {
        render(<ZoomCalendarSubBar {...defaultProps} isLive={false} />, { wrapper });
        expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    });

    it('renders legend chips', () => {
        render(<ZoomCalendarSubBar {...defaultProps} />, { wrapper });
        expect(screen.getAllByText(/saya/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/tim/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/external/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/blokir/i).length).toBeGreaterThan(0);
    });
});
