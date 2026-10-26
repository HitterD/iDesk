import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyFlow } from '../SurveyFlow';
import { draftKey } from '../../../lib/surveyDraft';
import type { CsiOpenForm } from '../../../types';

const FORM: CsiOpenForm = {
    teamLabel: 'Tim IT Support', submittedNames: [], id: 'p1', scope: 'ICT', title: 'Survei Kepuasan ICT Q4', intro: 'Mohon nilai layanan kami.',
    endDate: '2026-10-31', respondent: { fullName: 'Rina Pemohon' },
    departments: [{ id: 'd1', name: 'Finance' }, { id: 'd2', name: 'Produksi' }],
    ratees: [
        { periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null, dimensions: [
            { periodRateeDimensionId: 'x1', name: 'Kecepatan', description: 'Seberapa cepat ditanggapi', type: 'STAR' as const, required: true, options: [] },
            { periodRateeDimensionId: 'x2', name: 'Keramahan', description: null, type: 'STAR' as const, required: true, options: [] },
        ] },
        { periodRateeId: 'r2', kind: 'PERSON', displayName: 'Budi', jobTitle: null, avatarUrl: '/uploads/budi.png', dimensions: [
            { periodRateeDimensionId: 'y1', name: 'Kecepatan', description: null, type: 'STAR' as const, required: true, options: [] },
        ] },
    ],
};
const KEY = draftKey('u1', 'p1');
type User = ReturnType<typeof userEvent.setup>;

const renderFlow = (props: Partial<Parameters<typeof SurveyFlow>[0]> = {}) =>
    render(<SurveyFlow form={FORM} userId="u1" {...props} />);
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const rate = (user: User, group: string, stars: number) =>
    user.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: `${stars} dari 5` }));
const chooseDepartment = async (user: User, name: string) => {
    await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
    await user.click(await screen.findByRole('option', { name }));
};
const startFilling = async (user: User) => {
    await chooseDepartment(user, 'Produksi');
    await user.click(button('Mulai mengisi'));
};
const chips = () => within(screen.getByRole('navigation', { name: 'Daftar orang yang dinilai' }));

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('SurveyFlow', () => {
    it('intro shows count, minutes and deadline', () => {
        renderFlow();
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText('Anda akan menilai 2 orang · sekitar 1 menit')).toBeInTheDocument();
        expect(screen.getByText('Tersedia sampai 31 Okt 2026')).toBeInTheDocument();
        expect(screen.getByLabelText('Nama')).toHaveValue('Rina Pemohon');
    });

    it('no active department: friendly message instead of a dead start button', () => {
        renderFlow({ form: { ...FORM, departments: [] } });
        expect(screen.getByRole('status')).toHaveTextContent('Survei ini belum siap diisi. Silakan coba lagi nanti atau hubungi admin.');
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Departemen' })).not.toBeInTheDocument();
    });

    it('Mulai mengisi disabled until department chosen', async () => {
        const user = userEvent.setup();
        renderFlow();
        expect(button('Mulai mengisi')).toBeDisabled();
        await startFilling(user);
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(screen.getByText('Orang 1 dari 2')).toBeInTheDocument();
        expect(screen.getByText('Seberapa cepat ditanggapi')).toBeInTheDocument();
    });

    it("Lanjut with missing stars shows 'Beri bintang untuk 2 penilaian lagi' and stays", async () => {
        const user = userEvent.setup();
        const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
        renderFlow();
        await startFilling(user);
        await user.click(button('Lanjut'));
        expect(screen.getByRole('status')).toHaveTextContent('Beri bintang untuk 2 penilaian lagi');
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(document.querySelectorAll('[data-missing]')).toHaveLength(2);
        expect(scrollSpy).toHaveBeenCalled();
        await rate(user, 'Kecepatan untuk Andi', 5);
        expect(screen.getByRole('status')).toHaveTextContent('Beri bintang untuk 1 penilaian lagi');
        await rate(user, 'Keramahan untuk Andi', 4);
        await user.click(button('Lanjut'));
        expect(screen.getByRole('heading', { name: 'Budi' })).toBeInTheDocument();
        expect(button('Tinjau jawaban')).toBeInTheDocument();
        scrollSpy.mockRestore();
    });

    it('chips jump to a ratee and show check when complete', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(chips().getByRole('button', { name: /Andi/ })).toHaveAttribute('aria-current', 'step');
        await rate(user, 'Kecepatan untuk Andi', 5);
        await rate(user, 'Keramahan untuk Andi', 4);
        expect(chips().getByRole('button', { name: /Andi, lengkap/ })).toBeInTheDocument();
        await user.click(chips().getByRole('button', { name: /Budi/ }));
        expect(screen.getByRole('heading', { name: 'Budi' })).toBeInTheDocument();
        expect(chips().getByRole('button', { name: /Budi/ })).toHaveAttribute('aria-current', 'step');
    });

    it('Tinjau jawaban returns to a ratee skipped via chips', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        await user.click(chips().getByRole('button', { name: /Budi/ }));
        await rate(user, 'Kecepatan untuk Budi', 3);
        await user.click(button('Tinjau jawaban'));
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Beri bintang untuk 2 penilaian lagi');
    });

    it('avatar falls back to the initial when the photo fails', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(screen.getByText('A')).toBeInTheDocument();
        await user.click(chips().getByRole('button', { name: /Budi/ }));
        const photo = document.querySelector('img');
        expect(photo).toHaveAttribute('alt', '');
        expect(photo).toHaveAttribute('loading', 'lazy');
        fireEvent.error(photo as HTMLImageElement);
        expect(document.querySelector('img')).toBeNull();
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('review Ubah jumps back', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderFlow({ onSubmit });
        await startFilling(user);
        await rate(user, 'Kecepatan untuk Andi', 5);
        await rate(user, 'Keramahan untuk Andi', 4);
        await user.click(button('Lanjut'));
        await rate(user, 'Kecepatan untuk Budi', 3);
        await user.click(button('Tinjau jawaban'));
        const andi = screen.getByRole('listitem', { name: 'Andi' });
        expect(within(andi).getByText('4,5')).toBeInTheDocument();
        expect(screen.getByText('Produksi')).toBeInTheDocument();
        await user.click(within(screen.getByRole('listitem', { name: 'Budi' })).getByRole('button', { name: 'Ubah' }));
        expect(screen.getByRole('heading', { name: 'Budi' })).toBeInTheDocument();
        await user.click(button('Tinjau jawaban'));
        await user.click(button('Kirim'));
        expect(onSubmit).toHaveBeenCalledWith({
            respondentName: 'Rina Pemohon', departmentId: 'd2',
            items: [{ periodRateeDimensionId: 'x1', score: 5 }, { periodRateeDimensionId: 'x2', score: 4 }, { periodRateeDimensionId: 'y1', score: 3 }],
        });
    });

    it('restores draft after remount', async () => {
        const user = userEvent.setup();
        const first = renderFlow();
        await startFilling(user);
        await rate(user, 'Kecepatan untuk Andi', 5);
        await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').scores).toEqual({ x1: 5 }));
        first.unmount();
        renderFlow();
        expect(screen.getByText('Melanjutkan isian sebelumnya')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(within(screen.getByRole('radiogroup', { name: 'Kecepatan untuk Andi' })).getByRole('radio', { name: '5 dari 5' }))
            .toHaveAttribute('aria-checked', 'true');
    });

    it('navigation scrolls the new screen heading into view', async () => {
        const user = userEvent.setup();
        const scrolled: Element[] = [];
        const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) { scrolled.push(this); });
        renderFlow();
        expect(scrollSpy).not.toHaveBeenCalled();
        await startFilling(user);
        const heading = screen.getByRole('heading', { name: 'Andi' });
        expect(scrolled).toContain(heading);
        expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
        expect(heading).toHaveFocus();
        scrollSpy.mockRestore();
    });

    it('renders screen titles as h2 when embedded', () => {
        renderFlow({ headingLevel: 'h2' });
        expect(screen.getByRole('heading', { level: 2, name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
    });

    it('saves a pending answer when unmounted inside the debounce window', async () => {
        const user = userEvent.setup();
        const view = renderFlow();
        await startFilling(user);
        await rate(user, 'Kecepatan untuk Andi', 5);
        view.unmount();
        expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').scores).toEqual({ x1: 5 });
    });

    it('does not resurrect the draft after submit when the page clears it', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn(() => localStorage.removeItem(KEY));
        const view = renderFlow({ onSubmit });
        await startFilling(user);
        await rate(user, 'Kecepatan untuk Andi', 5);
        await rate(user, 'Keramahan untuk Andi', 4);
        await user.click(button('Lanjut'));
        await rate(user, 'Kecepatan untuk Budi', 3);
        await user.click(button('Tinjau jawaban'));
        await user.click(button('Kirim'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        view.unmount();
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('preview mode never calls onSubmit', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderFlow({ mode: 'preview', onSubmit });
        expect(button('Mulai mengisi')).toBeEnabled();
        await user.click(button('Mulai mengisi'));
        await rate(user, 'Kecepatan untuk Andi', 5);
        await rate(user, 'Keramahan untuk Andi', 4);
        await user.click(button('Lanjut'));
        await rate(user, 'Kecepatan untuk Budi', 3);
        await user.click(button('Tinjau jawaban'));
        // The preview sheet shows the banner once; the flow itself does not repeat it.
        expect(screen.queryByText('Pratinjau — jawaban tidak dikirim')).not.toBeInTheDocument();
        expect(button('Kirim')).toBeDisabled();
        await user.click(button('Kirim'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(localStorage.getItem(KEY)).toBeNull();
    });
});
