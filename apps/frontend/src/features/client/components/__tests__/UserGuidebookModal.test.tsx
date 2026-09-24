import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserGuidebookModal, GUIDEBOOK_DISMISSED_STORAGE_KEY } from '../UserGuidebookModal';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockGet = vi.fn();
vi.mock('@/lib/api', () => ({
    default: {
        get: (...args: any[]) => mockGet(...args),
        post: vi.fn(),
    },
}));

let mockUser: any = null;

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        updateUser: vi.fn(),
    }),
}));

describe('UserGuidebookModal (Clean Enterprise Redesign)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        mockGet.mockResolvedValue({
            data: {
                id: 'c3670f4a-9ba1-479a-9e2b-6969128e1fb5',
                title: 'Panduan Lengkap Penggunaan Portal User iDesk Enterprise',
            },
        });
        mockUser = {
            id: 'user-1',
            email: 'user.spj@idesk.com',
            fullName: 'User SPJ',
            role: 'USER',
            guidebookAcknowledgedAt: null,
        };
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    const renderComponent = (props = {}) => {
        return render(
            <MemoryRouter>
                <UserGuidebookModal {...props} />
            </MemoryRouter>
        );
    };

    it('renders clean modal without AI sparkle icons or capsule badges for USER role', async () => {
        renderComponent();

        expect(screen.getByText('Panduan Penggunaan Portal')).toBeInTheDocument();
        expect(
            screen.getByText(/Panduan resmi penggunaan sistem iDesk untuk pengajuan tiket IT/i)
        ).toBeInTheDocument();

        // 2 clean buttons
        expect(screen.getByRole('button', { name: /Buka Panduan/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Nanti Saja/i })).toBeInTheDocument();

        // No AI Sparkles or weird pills
        expect(screen.queryByText(/Panduan Pengguna Baru/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Acknowledge Langsung/i)).not.toBeInTheDocument();
    });

    it('does NOT render modal when role is not USER (e.g. ADMIN)', () => {
        mockUser = {
            id: 'admin-1',
            email: 'admin@idesk.com',
            fullName: 'Admin',
            role: 'ADMIN',
            guidebookAcknowledgedAt: null,
        };

        renderComponent();
        expect(screen.queryByText('Panduan Penggunaan Portal')).not.toBeInTheDocument();
    });

    it('does NOT render modal when user has already acknowledged the guidebook', () => {
        mockUser = {
            id: 'user-1',
            email: 'user.spj@idesk.com',
            fullName: 'User SPJ',
            role: 'USER',
            guidebookAcknowledgedAt: '2026-09-24T08:00:00.000Z',
        };

        renderComponent();
        expect(screen.queryByText('Panduan Penggunaan Portal')).not.toBeInTheDocument();
    });

    it('does NOT render modal when user dismissed it in the current session', () => {
        sessionStorage.setItem(GUIDEBOOK_DISMISSED_STORAGE_KEY, 'true');

        renderComponent();
        expect(screen.queryByText('Panduan Penggunaan Portal')).not.toBeInTheDocument();
    });

    it('dismisses modal temporarily when "Nanti Saja" is clicked', async () => {
        renderComponent();

        const dismissBtn = screen.getByRole('button', { name: /Nanti Saja/i });
        fireEvent.click(dismissBtn);

        expect(sessionStorage.getItem(GUIDEBOOK_DISMISSED_STORAGE_KEY)).toBe('true');
        await waitFor(() => {
            expect(screen.queryByText('Panduan Penggunaan Portal')).not.toBeInTheDocument();
        });
    });

    it('redirects to the exact KB article URL when "Buka Panduan" is clicked', async () => {
        renderComponent();

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith('/kb/articles/portal-guidebook');
        });

        const openBtn = screen.getByRole('button', { name: /Buka Panduan/i });
        fireEvent.click(openBtn);

        expect(mockNavigate).toHaveBeenCalledWith('/client/kb/articles/c3670f4a-9ba1-479a-9e2b-6969128e1fb5');
        expect(sessionStorage.getItem(GUIDEBOOK_DISMISSED_STORAGE_KEY)).toBe('true');
    });
});
