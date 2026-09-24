import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientArticleDetailPage } from '../ClientArticleDetailPage';

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/api', () => ({
    default: {
        get: (...args: any[]) => mockGet(...args),
        post: (...args: any[]) => mockPost(...args),
    },
}));

const mockUpdateUser = vi.fn();
let mockUser: any = null;

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        updateUser: mockUpdateUser,
    }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
    toast: {
        success: (...args: any[]) => mockToastSuccess(...args),
        error: (...args: any[]) => mockToastError(...args),
        info: vi.fn(),
    },
}));

vi.mock('@/features/knowledge-base/hooks/useKBSocket', () => ({
    useKBSocket: vi.fn(),
}));

describe('ClientArticleDetailPage - Guidebook Acknowledgment Banner', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPost.mockResolvedValue({ data: {} });
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
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

    const renderWithRouter = (articleId = 'c3670f4a-9ba1-479a-9e2b-6969128e1fb5') => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/client/kb/articles/${articleId}`]}>
                    <Routes>
                        <Route path="/client/kb/articles/:id" element={<ClientArticleDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('renders clean acknowledgment banner at the top of the portal guidebook article for USER role', async () => {
        mockGet.mockImplementation((url: string) => {
            if (url.includes('/viewers')) {
                return Promise.resolve({ data: { recentViewers: [], totalViewers: 10 } });
            }
            return Promise.resolve({
                data: {
                    id: 'c3670f4a-9ba1-479a-9e2b-6969128e1fb5',
                    title: 'Panduan Lengkap Penggunaan Portal User iDesk Enterprise',
                    content: '## Bab 1\nIsi panduan...',
                    category: 'General',
                    tags: ['Panduan User'],
                    viewCount: 15,
                    helpfulCount: 2,
                    createdAt: '2026-09-20T00:00:00.000Z',
                    updatedAt: '2026-09-20T00:00:00.000Z',
                },
            });
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('Konfirmasi Pemahaman Panduan Portal')).toBeInTheDocument();
        });

        const ackButton = screen.getByRole('button', { name: /Saya Mengerti & Acknowledge/i });
        expect(ackButton).toBeInTheDocument();
    });

    it('allows user to acknowledge the guidebook directly from the banner', async () => {
        mockGet.mockImplementation((url: string) => {
            if (url.includes('/viewers')) {
                return Promise.resolve({ data: { recentViewers: [] } });
            }
            return Promise.resolve({
                data: {
                    id: 'c3670f4a-9ba1-479a-9e2b-6969128e1fb5',
                    title: 'Panduan Lengkap Penggunaan Portal User iDesk Enterprise',
                    content: 'Isi panduan...',
                    category: 'General',
                },
            });
        });

        const fakeTimestamp = '2026-09-24T10:00:00.000Z';
        mockPost.mockResolvedValueOnce({
            data: { acknowledged: true, acknowledgedAt: fakeTimestamp },
        });

        renderWithRouter();

        const ackButton = await screen.findByRole('button', { name: /Saya Mengerti & Acknowledge/i });
        fireEvent.click(ackButton);

        await waitFor(() => {
            expect(mockPost).toHaveBeenCalledWith('/users/me/acknowledge-guidebook');
            expect(mockUpdateUser).toHaveBeenCalledWith({
                guidebookAcknowledgedAt: fakeTimestamp,
            });
            expect(mockToastSuccess).toHaveBeenCalledWith(
                expect.stringContaining('berhasil di-acknowledge')
            );
        });
    });

    it('does NOT render acknowledgment banner for unrelated KB articles', async () => {
        mockGet.mockImplementation((url: string) => {
            if (url.includes('/viewers')) {
                return Promise.resolve({ data: { recentViewers: [] } });
            }
            return Promise.resolve({
                data: {
                    id: 'wifi-123',
                    title: 'Cara Mengatasi WiFi Kantor Putus-Putus',
                    content: 'Tutorial WiFi...',
                    category: 'Network',
                    tags: ['wifi'],
                },
            });
        });

        renderWithRouter('wifi-123');

        await waitFor(() => {
            expect(screen.getAllByText('Cara Mengatasi WiFi Kantor Putus-Putus').length).toBeGreaterThan(0);
        });

        expect(screen.queryByText('Konfirmasi Pemahaman Panduan Portal')).not.toBeInTheDocument();
    });
});
