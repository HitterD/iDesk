import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesktopAppDownloadBanner } from '../DesktopAppDownloadBanner';
import { useAuth } from '@/stores/useAuth';

vi.mock('@/stores/useAuth', () => ({
    useAuth: vi.fn(),
}));

describe('DesktopAppDownloadBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ defaultDisplayMode: 'both' }),
        } as any);
    });

    it('renders clean user view without developer diagnostics when showAdminTools is false', async () => {
        (useAuth as any).mockReturnValue({
            user: { role: 'USER', fullName: 'John Doe' },
        });

        render(<DesktopAppDownloadBanner showAdminTools={false} />);

        await waitFor(() => {
            expect(screen.getByText('SJA Desktop Notifier')).toBeInTheDocument();
        });

        // Core banner elements are visible
        expect(screen.getByText(/Windows App/i)).toBeInTheDocument();
        expect(screen.getByText('Unduh (.zip)')).toBeInTheDocument();
        expect(screen.getByText('Tes Notifikasi')).toBeInTheDocument();
        expect(screen.getByText('Panduan & Integrasi')).toBeInTheDocument();

        // Preference cards are present
        expect(screen.getByText('Hanya Toast')).toBeInTheDocument();
        expect(screen.getByText('Hanya Popup Window')).toBeInTheDocument();

        // Technical testing tools are hidden for users
        expect(screen.queryByText(/Uji 5 Skenario/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Tes Terassign/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Bilah Diagnostik SJA Notifier/i)).not.toBeInTheDocument();
    });

    it('renders diagnostic tools when showAdminTools is true', async () => {
        (useAuth as any).mockReturnValue({
            user: { role: 'ADMIN', fullName: 'Admin User' },
        });

        render(<DesktopAppDownloadBanner showAdminTools={true} />);

        await waitFor(() => {
            expect(screen.getByText('SJA Desktop Notifier')).toBeInTheDocument();
        });

        // Diagnostic bar and admin tools are now visible
        expect(screen.getByText('Bilah Diagnostik SJA Notifier')).toBeInTheDocument();
        expect(screen.getByText('Uji 5 Skenario')).toBeInTheDocument();
        expect(screen.getByText('Tes Terassign')).toBeInTheDocument();
    });

    it('allows changing desktop display preference', async () => {
        (useAuth as any).mockReturnValue({
            user: { role: 'USER', fullName: 'John Doe' },
        });

        render(<DesktopAppDownloadBanner showAdminTools={false} />);

        await waitFor(() => {
            expect(screen.getByText('Hanya Toast')).toBeInTheDocument();
        });

        const toastOption = screen.getByText('Hanya Toast');
        fireEvent.click(toastOption);

        expect(toastOption).toBeInTheDocument();
    });
});
