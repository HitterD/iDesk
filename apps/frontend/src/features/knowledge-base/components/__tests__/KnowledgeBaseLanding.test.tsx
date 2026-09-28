import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

    const searchBox = () => screen.getByRole('searchbox', { name: /cari artikel panduan/i }) as HTMLInputElement;

    it('renders the Apple-style header, search and author actions', async () => {
        renderComponent();

        expect(screen.getByRole('heading', { level: 1, name: 'Ada yang bisa kami bantu?' })).toBeInTheDocument();
        expect(screen.getByText('Pusat Panduan')).toBeInTheDocument();
        expect(screen.getByText(/Cari solusi mandiri/i)).toBeInTheDocument();
        expect(searchBox()).toBeInTheDocument();
        expect(screen.getByText('Buat Artikel')).toBeInTheDocument();
        expect(screen.getByText('Kelola')).toBeInTheDocument();
    });

    it('shows one filter surface: topics from the database, no chips or view toggle', async () => {
        renderComponent();

        const topics = await screen.findByRole('navigation', { name: /topik panduan/i });
        for (const category of mockCategories) {
            expect(within(topics).getByRole('button', { name: category })).toBeInTheDocument();
        }
        expect(screen.queryByText('VPN WatchGuard')).not.toBeInTheDocument();
        expect(screen.queryByText('Semua Kategori')).not.toBeInTheDocument();
        expect(screen.queryByTitle(/Tampilan Baris/i)).not.toBeInTheDocument();
    });

    it('renders the featured guide as a "Mulai di sini" row and the popular list', async () => {
        renderComponent();

        expect(await screen.findByText(mockFeatured.title)).toBeInTheDocument();
        expect(screen.getByText(/Mulai di sini/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Artikel populer' })).toBeInTheDocument();
        expect(await screen.findByText('Panduan Setting WatchGuard VPN')).toBeInTheDocument();
    });

    it('switches to results mode when a topic is picked, and back on reset', async () => {
        renderComponent();

        const topics = await screen.findByRole('navigation', { name: /topik panduan/i });
        fireEvent.click(within(topics).getByRole('button', { name: 'Network' }));

        expect(screen.getByRole('heading', { name: 'Network' })).toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: /topik panduan/i })).not.toBeInTheDocument();
        expect(screen.queryByText(mockFeatured.title)).not.toBeInTheDocument();
        await waitFor(() =>
            expect(api.get).toHaveBeenCalledWith('/kb/articles', expect.objectContaining({
                params: expect.objectContaining({ category: 'Network' }),
            })),
        );

        fireEvent.click(screen.getByRole('button', { name: /kembali ke semua topik/i }));
        expect(await screen.findByRole('navigation', { name: /topik panduan/i })).toBeInTheDocument();
    });

    it('shows a results heading with the count when searching', async () => {
        renderComponent();

        fireEvent.change(searchBox(), { target: { value: 'VPN' } });

        expect(await screen.findByText('2 hasil')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '“VPN”' })).toBeInTheDocument();
    });

    it('changes sort via the segmented control', async () => {
        renderComponent();

        fireEvent.click(screen.getByRole('radio', { name: 'Terbaru' }));

        expect(screen.getByRole('radio', { name: 'Terbaru' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('heading', { name: 'Artikel terbaru' })).toBeInTheDocument();
    });

    it('renders the help card at the bottom', async () => {
        renderComponent();

        expect(screen.getByRole('heading', { name: 'Masih butuh bantuan?' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /buat tiket/i })).toHaveAttribute('href', '/tickets/create');
        expect(screen.getByText(/Rata-rata respon IT < 15 menit/i)).toBeInTheDocument();
    });
});
