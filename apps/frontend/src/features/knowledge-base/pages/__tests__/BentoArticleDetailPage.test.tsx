import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BentoArticleDetailPage } from '../BentoArticleDetailPage';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', fullName: 'Bagas Admin', role: 'ADMIN' },
    }),
}));

vi.mock('../../hooks/useKBSocket', () => ({
    useKBSocket: vi.fn(),
}));

const mockArticle = {
    id: 'art-123',
    title: 'Panduan Setup VPN Kantor',
    content: `
## 1. Persiapan Koneksi
Pastikan komputer terhubung ke internet.

## 2. Instalasi Client
Download installer dari portal IT.

### Langkah 1: Jalankan Installer
Klik ganda file installer.

### Langkah 2: Masukkan Kredensial
Gunakan username dan password domain Anda.
    `.trim(),
    category: 'Network',
    tags: ['vpn', 'remote'],
    status: 'published',
    visibility: 'public',
    viewCount: 42,
    helpfulCount: 15,
    authorName: 'IT Helpdesk Lead',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-10T10:00:00Z',
};

describe('BentoArticleDetailPage (Modern Enterprise Docs UI)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        // Mock API responses
        (api.get as any).mockImplementation((url: string) => {
            if (url === '/kb/articles/art-123') {
                return Promise.resolve({ data: mockArticle });
            }
            if (url === '/kb/articles/art-123/viewers') {
                return Promise.resolve({
                    data: {
                        recentViewers: [
                            { id: 'v1', fullName: 'Alice Staff' },
                            { id: 'v2', fullName: 'Bob Tech' },
                        ],
                        totalViewers: 12,
                    },
                });
            }
            return Promise.reject(new Error(`Unhandled GET: ${url}`));
        });

        (api.post as any).mockResolvedValue({
            data: { ...mockArticle, helpfulCount: 16 },
        });
    });

    const renderPage = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/kb/articles/art-123']}>
                    <Routes>
                        <Route path="/kb/articles/:id" element={<BentoArticleDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('renders article header with authentic metadata and estimated reading time', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { level: 1, name: 'Panduan Setup VPN Kantor' })).toBeInTheDocument();
        expect(screen.getAllByText('Network').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText('IT Helpdesk Lead')).toBeInTheDocument();
        expect(screen.getByText('42 views')).toBeInTheDocument();
        expect(screen.getByText(/mnt baca/i)).toBeInTheDocument();

        // Check author byline without cheesy fake badges
        expect(screen.queryByText(/✓ Terverifikasi/i)).toBeNull();
    });

    it('renders hierarchical Table of Contents and step progress', async () => {
        renderPage();

        expect(await screen.findByText('Daftar Isi')).toBeInTheDocument();
        expect(screen.getAllByText('1. Persiapan Koneksi').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('2. Instalasi Client').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Langkah 1: Jalankan Installer').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Langkah 2: Masukkan Kredensial').length).toBeGreaterThanOrEqual(1);

        // Step tracker
        expect(screen.getByText('Progres Solusi')).toBeInTheDocument();
        expect(screen.getByText('0/2 Selesai')).toBeInTheDocument();
    });

    it('submits helpful vote cleanly without redundant reaction circus', async () => {
        renderPage();

        const voteBtn = await screen.findByRole('button', { name: /Ya, Membantu/i });
        expect(voteBtn).toBeInTheDocument();

        fireEvent.click(voteBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/kb/articles/art-123/helpful');
        });
    });

    it('renders single direct IT Helpdesk assistance widget without hardcoded fake difficulty', async () => {
        renderPage();

        expect(await screen.findByText('Butuh Bantuan Langsung?')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Buat Tiket Bantuan/i })).toBeInTheDocument();

        // Verify hardcoded fake data is eliminated
        expect(screen.queryByText(/Mudah \/ Pemula/i)).toBeNull();
        expect(screen.queryByText(/Tipe Solusi:/i)).toBeNull();
    });
});
