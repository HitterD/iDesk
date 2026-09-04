import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KnowledgeBaseLanding } from '../KnowledgeBaseLanding';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
    },
}));

vi.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: string) => value,
}));

vi.mock('../hooks/useKBSocket', () => ({
    useKBSocket: vi.fn(),
}));

const mockArticles = [
    {
        id: 'art-1',
        title: 'Panduan Setting WatchGuard VPN',
        content: 'Langkah instalasi VPN WatchGuard di laptop kantor...',
        category: 'Network',
        tags: ['vpn', 'network'],
        viewCount: 42,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'art-2',
        title: 'Cara Reset Password Domain iDesk',
        content: 'Panduan melakukan reset password mandiri...',
        category: 'Security',
        tags: ['password', 'auth'],
        viewCount: 88,
        createdAt: new Date().toISOString(),
    },
];

const mockCategories = ['Network', 'Security', 'Hardware', 'Software', 'Email'];

const mockFeatured = {
    id: 'feat-1',
    title: 'Panduan Lengkap Penggunaan Portal User iDesk Enterprise',
    content: 'Panduan pengantar portal self-service...',
    category: 'General',
    viewCount: 150,
    createdAt: new Date().toISOString(),
};

describe('KnowledgeBaseLanding Component', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
        vi.clearAllMocks();

        (api.get as any).mockImplementation((url: string) => {
            if (url === '/kb/categories') {
                return Promise.resolve({ data: mockCategories });
            }
            if (url === '/kb/articles/featured') {
                return Promise.resolve({ data: mockFeatured });
            }
            if (url === '/kb/articles') {
                return Promise.resolve({
                    data: {
                        items: mockArticles,
                        total: mockArticles.length,
                        hasMore: false,
                    },
                });
            }
            return Promise.resolve({ data: null });
        });
    });

    const renderComponent = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <KnowledgeBaseLanding
                        title="Pusat Panduan"
                        subtitle="Cari solusi mandiri untuk kendala IT sehari-hari."
                        articleBasePath="/kb/articles"
                        createTicketPath="/tickets/create"
                        actions={{
                            createArticlePath: '/kb/create',
                            managePath: '/kb/manage',
                        }}
                    />
                </BrowserRouter>
            </QueryClientProvider>,
        );

    it('renders the header, title, and action buttons', async () => {
        renderComponent();

        expect(screen.getByText('Pusat Panduan')).toBeInTheDocument();
        expect(screen.getByText(/Cari solusi mandiri/i)).toBeInTheDocument();
        expect(screen.getByText('Buat Artikel')).toBeInTheDocument();
        expect(screen.getByText('Kelola')).toBeInTheDocument();
    });

    it('renders search input and quick suggestion chips', async () => {
        renderComponent();

        const searchInput = screen.getByPlaceholderText(/Cari solusi atau kata kunci panduan/i);
        expect(searchInput).toBeInTheDocument();

        expect(screen.getByText('VPN WatchGuard')).toBeInTheDocument();
        expect(screen.getByText('Reset Password')).toBeInTheDocument();
    });

    it('renders quick topics bento and spotlight card when browsing', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Spotlight Panduan Utama')).toBeInTheDocument();
            expect(screen.getByText('VPN & Jaringan')).toBeInTheDocument();
            expect(screen.getByText('Akun & Keamanan')).toBeInTheDocument();
        });
    });

    it('switches between Grid and List view mode', async () => {
        renderComponent();

        await waitFor(() => {
            expect(screen.getByText('Panduan Setting WatchGuard VPN')).toBeInTheDocument();
        });

        const listButton = screen.getByTitle('Tampilan Baris (List)');
        fireEvent.click(listButton);

        expect(screen.getByText('Panduan Setting WatchGuard VPN')).toBeInTheDocument();
    });

    it('updates search query when clicking a quick suggestion chip', async () => {
        renderComponent();

        const vpnChip = screen.getByText('VPN WatchGuard');
        fireEvent.click(vpnChip);

        const searchInput = screen.getByPlaceholderText(/Cari solusi atau kata kunci panduan/i) as HTMLInputElement;
        expect(searchInput.value).toBe('VPN');
    });

    it('renders support escalation bridge at the bottom', async () => {
        renderComponent();

        expect(screen.getByText(/Belum menemukan solusi untuk kendala Anda/i)).toBeInTheDocument();
        expect(screen.getByText(/Rata-rata respon IT < 15 menit/i)).toBeInTheDocument();
    });
});
