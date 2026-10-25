import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsiApi } from '../../api/csi.api';
import { CsiSurveyPage } from '../CsiSurveyPage';
import type { CsiOpenForm } from '../../types';

vi.mock('../../api/csi.api', () => ({
    CsiApi: { active: vi.fn(), form: vi.fn(), submit: vi.fn() },
}));

const OPEN_FORM: CsiOpenForm = {
    submitted: false,
    id: 'p1',
    scope: 'ICT',
    title: 'Survei Kepuasan ICT Q4',
    intro: 'Mohon nilai layanan kami.\nTerima kasih.',
    respondent: { fullName: 'Rina Pemohon' },
    departments: [{ id: 'd1', name: 'Finance' }, { id: 'd2', name: 'Produksi' }],
    ratees: [
        {
            periodRateeId: 'r1', displayName: 'Andi', jobTitle: 'IT Support',
            dimensions: [{ periodRateeDimensionId: 'x1', name: 'Kecepatan' }, { periodRateeDimensionId: 'x2', name: 'Keramahan' }],
        },
        {
            periodRateeId: 'r2', displayName: 'Budi', jobTitle: null,
            dimensions: [{ periodRateeDimensionId: 'y1', name: 'Kecepatan' }],
        },
    ],
};

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

const rate = async (user: ReturnType<typeof userEvent.setup>, group: string, stars: number) =>
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: `${stars} dari 5` }));

const chooseDepartment = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
    await user.click(await screen.findByRole('option', { name }));
};

const fillAll = async (user: ReturnType<typeof userEvent.setup>) => {
    await chooseDepartment(user, 'Produksi');
    await rate(user, 'Kecepatan untuk Andi', 5);
    await rate(user, 'Keramahan untuk Andi', 4);
    await rate(user, 'Kecepatan untuk Budi', 3);
};

beforeEach(() => {
    vi.mocked(CsiApi.form).mockReset().mockResolvedValue(OPEN_FORM);
    vi.mocked(CsiApi.submit).mockReset();
    vi.mocked(CsiApi.active).mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

describe('CsiSurveyPage', () => {
    it('menampilkan judul, intro, nama read-only, dan progres', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText(/Mohon nilai layanan kami\./)).toBeInTheDocument();
        expect(screen.getByLabelText('Nama')).toHaveValue('Rina Pemohon');
        expect(screen.getByLabelText('Nama')).toHaveAttribute('readonly');
        expect(screen.getByText('0/3 penilaian')).toBeInTheDocument();
        expect(screen.getByText('Pilih departemen')).toBeInTheDocument();
    });

    it('tombol Tinjau & Kirim disabled sampai departemen dan semua dimensi terisi', async () => {
        const user = userEvent.setup();
        renderPage();
        const button = await screen.findByRole('button', { name: 'Tinjau & Kirim' });
        expect(button).toBeDisabled();

        await rate(user, 'Kecepatan untuk Andi', 5);
        await rate(user, 'Keramahan untuk Andi', 4);
        await rate(user, 'Kecepatan untuk Budi', 3);
        expect(screen.getByText('3/3 penilaian')).toBeInTheDocument();
        expect(button).toBeDisabled();

        await chooseDepartment(user, 'Finance');
        expect(button).toBeEnabled();
    });

    it('submit memanggil API dengan payload lengkap lalu menampilkan teks thankYou', async () => {
        vi.mocked(CsiApi.submit).mockResolvedValue({ submitted: true, thankYou: 'Terima kasih atas penilaian Anda!' });
        const user = userEvent.setup();
        renderPage();
        await screen.findByRole('button', { name: 'Tinjau & Kirim' });
        await fillAll(user);
        await user.type(screen.getByLabelText('Saran untuk Andi (opsional)'), '  Pertahankan  ');
        await user.click(screen.getByRole('button', { name: 'Tinjau & Kirim' }));

        const sheet = await screen.findByRole('dialog');
        expect(within(sheet).getByText('Andi')).toBeInTheDocument();
        expect(within(sheet).getByText('4,5')).toBeInTheDocument();
        expect(within(sheet).getByText('3,0')).toBeInTheDocument();
        await user.click(within(sheet).getByRole('button', { name: 'Kirim' }));

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
    });

    it('respons submitted: true dari form menampilkan teks thankYou', async () => {
        vi.mocked(CsiApi.form).mockResolvedValue({ submitted: true, title: 'Survei Kepuasan ICT Q4', thankYou: 'Sampai jumpa periode depan.' });
        renderPage();
        expect(await screen.findByText('Sampai jumpa periode depan.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Tinjau & Kirim' })).not.toBeInTheDocument();
    });

    it('410 saat submit menampilkan "Periode penilaian sudah berakhir"', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(410));
        const user = userEvent.setup();
        renderPage();
        await screen.findByRole('button', { name: 'Tinjau & Kirim' });
        await fillAll(user);
        await user.click(screen.getByRole('button', { name: 'Tinjau & Kirim' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Kirim' }));
        expect(await screen.findByText('Periode penilaian sudah berakhir')).toBeInTheDocument();
    });

    it('409 saat submit menampilkan "Anda sudah mengisi survei ini"', async () => {
        vi.mocked(CsiApi.submit).mockRejectedValue(httpError(409));
        const user = userEvent.setup();
        renderPage();
        await screen.findByRole('button', { name: 'Tinjau & Kirim' });
        await fillAll(user);
        await user.click(screen.getByRole('button', { name: 'Tinjau & Kirim' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Kirim' }));
        expect(await screen.findByText('Anda sudah mengisi survei ini')).toBeInTheDocument();
    });

    it('404 menampilkan "Survei tidak ditemukan" dengan tautan kembali', async () => {
        vi.mocked(CsiApi.form).mockRejectedValue(httpError(404));
        renderPage();
        expect(await screen.findByText('Survei tidak ditemukan')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('link', { name: /Kembali ke daftar survei/ })).toHaveAttribute('href', '/client/csi'));
    });
});
