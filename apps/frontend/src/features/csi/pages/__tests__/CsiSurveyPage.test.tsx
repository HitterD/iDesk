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
    teamLabel: 'Tim IT Support',
    submittedNames: [],
    id: 'p1',
    scope: 'ICT',
    title: 'Survei Kepuasan ICT Q4',
    intro: 'Mohon nilai layanan kami.\nTerima kasih.',
    endDate: '2026-10-31',
    respondent: { fullName: 'Rina Pemohon' },
    departments: [{ id: 'd1', name: 'Finance' }, { id: 'd2', name: 'Produksi' }],
    ratees: [
        {
            periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'x1', name: 'Kecepatan', description: null, type: 'STAR' as const, required: true, options: [] }, { periodRateeDimensionId: 'x2', name: 'Keramahan', description: null, type: 'STAR' as const, required: true, options: [] }],
        },
        {
            periodRateeId: 'r2', kind: 'PERSON', displayName: 'Budi', jobTitle: null, avatarUrl: null,
            dimensions: [{ periodRateeDimensionId: 'y1', name: 'Kecepatan', description: null, type: 'STAR' as const, required: true, options: [] }],
        },
    ],
};
const DRAFT_KEY = draftKey('u1', 'p1');
const STORED_DRAFT = JSON.stringify({ respondentName: 'Rina Pemohon', departmentId: 'd1', answers: { x1: { score: 5 } }, comments: {}, position: 1 });

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
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: `${stars} bintang` }));

/** Intro → Andi → Budi → review, then press "Kirim". */
const fillAndSubmit = async (user: User, comment?: string) => {
    await user.click(await screen.findByRole('combobox', { name: 'Departemen' }));
    await user.click(await screen.findByRole('option', { name: 'Produksi' }));
    await user.click(screen.getByRole('button', { name: 'Mulai mengisi' }));
    await user.click(await screen.findByRole('button', { name: 'Ya, sudah benar' }));
    await rate(user, 'Kecepatan untuk Andi', 5);
    await rate(user, 'Keramahan untuk Andi', 4);
    if (comment) await user.type(screen.getByLabelText('Saran untuk Andi (opsional)'), comment);
    await user.click(screen.getByRole('button', { name: /^Lanjut/ }));
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
    it('menampilkan layar pembuka: judul, intro, nama terkunci ke akun, departemen', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText(/Mohon nilai layanan kami\./)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveTextContent('Rina Pemohon');
        expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveAttribute('aria-readonly', 'true');
        expect(screen.getByText('Pilih departemen')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mulai mengisi' })).toBeDisabled();
    });

    it('submit memanggil API dengan payload lengkap, menampilkan thankYou, dan menghapus draft', async () => {
        vi.mocked(CsiApi.submit).mockResolvedValue({ submitted: true, thankYou: 'Terima kasih atas penilaian Anda!' });
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user, '  Pertahankan  ');

        expect(await screen.findByText('Terima kasih atas penilaian Anda!')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Terima kasih, Rina Pemohon!' })).toBeInTheDocument();
        expect(screen.getByText('Penilaian Anda untuk 2 tim/orang sudah terkirim.')).toBeInTheDocument();
        const summary = within(screen.getByRole('list', { name: 'Semua yang Anda nilai' }));
        expect(summary.getByRole('img', { name: 'Rata-rata 4,5 dari 5' })).toBeInTheDocument();
        expect(summary.getByRole('img', { name: 'Rata-rata 3,0 dari 5' })).toBeInTheDocument();
        expect(CsiApi.submit).toHaveBeenCalledWith('p1', {
            respondentName: 'Rina Pemohon', departmentId: 'd2',
            items: [
                { periodRateeDimensionId: 'x1', score: 5 },
                { periodRateeDimensionId: 'x2', score: 4 },
                { periodRateeDimensionId: 'y1', score: 3 },
            ],
            comments: [{ periodRateeId: 'r1', comment: 'Pertahankan' }],
        });
        expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('410 saat submit menampilkan "Periode penilaian sudah berakhir"', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(410));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByText('Periode penilaian sudah berakhir')).toBeInTheDocument();
    });

    it('clears local draft on 410 at submit', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(410));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByText('Periode penilaian sudah berakhir')).toBeInTheDocument();
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it('clears local draft when the form itself answers 410', async () => {
        localStorage.setItem(DRAFT_KEY, STORED_DRAFT);
        vi.mocked(CsiApi.form).mockRejectedValue(httpError(410));
        renderPage();
        expect(await screen.findByText('Periode penilaian sudah berakhir')).toBeInTheDocument();
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it('409 sudah mengisi: pesan jelas di layar tinjau, draft tetap ada', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(409));
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByRole('alert')).toHaveTextContent('Anda sudah mengisi survei ini');
        await waitFor(() => expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}').answers).toMatchObject({ y1: { score: 3 } }));
    });

    it('setelah terkirim: tidak ada "isi lagi", ada ajakan survei lain yang belum diisi', async () => {
        vi.mocked(CsiApi.submit).mockResolvedValue({ submitted: true, thankYou: 'Terima kasih atas penilaian Anda!' });
        vi.mocked(CsiApi.active).mockResolvedValue([
            { id: 'p1', scope: 'ICT', title: 'Survei Kepuasan ICT Q4', submitted: true },
            { id: 'p2', scope: 'HC', title: 'Survei Kepuasan HC Q4', submitted: false },
        ]);
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByRole('heading', { name: 'Terima kasih, Rina Pemohon!' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Kembali ke daftar survei' })).toHaveAttribute('href', '/client/csi');
        expect(screen.queryByRole('button', { name: /orang lain/ })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: /Isi sekarang/ })).toHaveAttribute('href', '/client/csi/p2');
    });

    it('bug: terima kasih tetap tampil walau form (bila di-refetch) sudah berstatus "sudah mengisi"', async () => {
        // The server marks the form answered right after the submit; the page must still show the thank-you screen.
        vi.mocked(CsiApi.submit).mockImplementation(async () => {
            vi.mocked(CsiApi.form).mockResolvedValue({ ...OPEN_FORM, submittedAt: '2026-10-20T03:15:00Z', submittedNames: ['Rina Pemohon'] });
            return { submitted: true, thankYou: 'Terima kasih!' };
        });
        const user = userEvent.setup();
        renderPage();
        await fillAndSubmit(user);
        expect(await screen.findByRole('heading', { name: 'Terima kasih, Rina Pemohon!' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Anda sudah mengisi survei ini' })).not.toBeInTheDocument();
        expect(CsiApi.form).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    });

    it('akun yang sudah mengisi melihat layar "sudah mengisi", bukan formulir', async () => {
        vi.mocked(CsiApi.form).mockResolvedValue({ ...OPEN_FORM, submittedAt: '2026-10-20T03:15:00Z', submittedNames: ['Rina Pemohon'] });
        vi.mocked(CsiApi.active).mockResolvedValue([]);
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Anda sudah mengisi survei ini' })).toBeInTheDocument();
        expect(screen.getByText(/Jawaban Anda terkirim pada 20 Okt 2026/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
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
