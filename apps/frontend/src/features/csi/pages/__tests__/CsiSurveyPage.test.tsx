import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../api/csi.api';
import { CsiSurveyPage } from '../CsiSurveyPage';
import { draftKey } from '../../lib/surveyDraft';
import type { CsiOpenForm } from '../../types';

vi.mock('../../api/csi.api', () => ({
    CsiApi: { active: vi.fn(), form: vi.fn(), submit: vi.fn() },
}));
vi.mock('@/stores/useAuth', () => ({
    useAuth: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'u1' } }),
}));

const OPEN_FORM: CsiOpenForm = {
    submitted: false,
    id: 'p1',
    scope: 'ICT',
    title: 'Survei Kepuasan ICT Q4',
    intro: 'Mohon nilai layanan kami.\nTerima kasih.',
    endDate: '2026-10-31',
    respondent: { fullName: 'Rina Pemohon' },
    departments: [{ id: 'd1', name: 'Finance' }, { id: 'd2', name: 'Produksi' }],
    ratees: [
        {
            periodRateeId: 'r1', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'x1', name: 'Kecepatan', description: null }, { periodRateeDimensionId: 'x2', name: 'Keramahan', description: null }],
        },
        {
            periodRateeId: 'r2', displayName: 'Budi', jobTitle: null, avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'y1', name: 'Kecepatan', description: null }],
        },
    ],
};
const DRAFT_KEY = draftKey('u1', 'p1');
const STORED_DRAFT = JSON.stringify({ departmentId: 'd1', scores: { x1: 5 }, comments: {}, position: 1 });

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: {} } });

const renderPage = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/client/csi/p1']}>
                <Routes>
                    <Route path="/client/csi/:id" element={<CsiSurveyPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

type User = ReturnType<typeof userEvent.setup>;
const rate = async (user: User, group: string, stars: number) =>
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: `${stars} dari 5` }));

/** Intro → Andi → Budi → review, then press "Kirim". */
const fillAndSubmit = async (user: User, comment?: string) => {
    await user.click(await screen.findByRole('combobox', { name: 'Departemen' }));
    await user.click(await screen.findByRole('option', { name: 'Produksi' }));
    await user.click(screen.getByRole('button', { name: 'Mulai mengisi' }));
    await rate(user, 'Kecepatan untuk Andi', 5);
    await rate(user, 'Keramahan untuk Andi', 4);
    if (comment) await user.type(screen.getByLabelText('Saran untuk Andi (opsional)'), comment);
    await user.click(screen.getByRole('button', { name: 'Lanjut' }));
    await rate(user, 'Kecepatan untuk Budi', 3);
    await user.click(screen.getByRole('button', { name: 'Tinjau jawaban' }));
    await user.click(screen.getByRole('button', { name: 'Kirim' }));
};

beforeEach(() => {
    vi.mocked(CsiApi.form).mockReset().mockResolvedValue(OPEN_FORM);
    vi.mocked(CsiApi.submit).mockReset();
    vi.mocked(CsiApi.active).mockReset().mockResolvedValue([]);
});
afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('CsiSurveyPage', () => {
    it('menampilkan layar pembuka: judul, intro, nama read-only, departemen', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText(/Mohon nilai layanan kami\./)).toBeInTheDocument();
        expect(screen.getByLabelText('Nama')).toHaveValue('Rina Pemohon');
        expect(screen.getByLabelText('Nama')).toHaveAttribute('readonly');
        expect(screen.getByText('Pilih departemen')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mulai mengisi' })).toBeDisabled();
    });

    it('submit memanggil API dengan payload lengkap, menampilkan thankYou, dan menghapus draft', async () => {
        vi.mocked(CsiApi.submit).mockResolvedValue({ submitted: true, thankYou: 'Terima kasih atas penilaian Anda!' });
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user, '  Pertahankan  ');

        expect(await screen.findByText('Terima kasih atas penilaian Anda!')).toBeInTheDocument();
        expect(CsiApi.submit).toHaveBeenCalledWith('p1', {
            departmentId: 'd2',
            items: [
                { periodRateeDimensionId: 'x1', score: 5 },
                { periodRateeDimensionId: 'x2', score: 4 },
                { periodRateeDimensionId: 'y1', score: 3 },
            ],
            comments: [{ periodRateeId: 'r1', comment: 'Pertahankan' }],
        });
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('respons submitted: true dari form menampilkan thankYou dan menghapus draft', async () => {
        localStorage.setItem(DRAFT_KEY, STORED_DRAFT);
        vi.mocked(CsiApi.form).mockResolvedValue({ submitted: true, title: 'Survei Kepuasan ICT Q4', thankYou: 'Sampai jumpa periode depan.' });
        renderPage();
        expect(await screen.findByText('Sampai jumpa periode depan.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it('410 saat submit menampilkan "Periode penilaian sudah berakhir"', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(410));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByText('Periode penilaian sudah berakhir')).toBeInTheDocument();
    });

    it('clears local draft on 409', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(409));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByText('Anda sudah mengisi survei ini')).toBeInTheDocument();
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('gagal kirim (500) tetap di layar tinjau dengan pesan galat', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(500));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByRole('alert')).toHaveTextContent('Gagal mengirim survei. Silakan coba lagi.');
        expect(screen.getByRole('button', { name: 'Kirim' })).toBeEnabled();
    });

    it('404 menampilkan "Survei tidak ditemukan" dengan tautan kembali', async () => {
        vi.mocked(CsiApi.form).mockRejectedValue(httpError(404));
        renderPage();
        expect(await screen.findByText('Survei tidak ditemukan')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('link', { name: /Kembali ke daftar survei/ })).toHaveAttribute('href', '/client/csi'));
    });
});
