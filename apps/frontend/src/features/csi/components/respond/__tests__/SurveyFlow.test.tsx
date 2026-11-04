import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrollWithin } from '../../../lib/scrollWithin';
import { SurveyFlow } from '../SurveyFlow';

vi.mock('../../../lib/scrollWithin', () => ({ scrollWithin: vi.fn() }));
import { button, chips, choose, FORM, LONG_NAME, NEXT, rate, startFilling } from './surveyFlowFixture';

const renderFlow = (props: Partial<Parameters<typeof SurveyFlow>[0]> = {}) =>
    render(<SurveyFlow form={FORM} userId="u1" {...props} />);

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('SurveyFlow intro', () => {
    it('shows team + people, minutes, deadline and the account name locked (read-only)', () => {
        renderFlow();
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText('Anda akan menilai tim IT Support dan 2 orang · sekitar 1 menit')).toBeInTheDocument();
        expect(screen.getByText('Tersedia sampai 31 Okt 2026')).toBeInTheDocument();
        const name = screen.getByRole('textbox', { name: 'Nama' });
        expect(name).toHaveTextContent('Rina Pemohon');
        expect(name).toHaveAttribute('aria-readonly', 'true');
        expect(screen.getByText(/Setiap akun hanya dapat mengisi survei ini satu kali/)).toBeInTheDocument();
    });

    it('no active department: friendly message instead of a dead start button', () => {
        renderFlow({ form: { ...FORM, departments: [] } });
        expect(screen.getByRole('status')).toHaveTextContent('Survei ini belum siap diisi. Silakan coba lagi nanti atau hubungi admin.');
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
    });

    it('department is chosen once when the account has none; start waits for it', async () => {
        const user = userEvent.setup();
        renderFlow();
        expect(screen.getByText('Pastikan benar: departemen tidak bisa diubah setelah dipilih.')).toBeInTheDocument();
        expect(button('Mulai mengisi')).toBeDisabled();
        await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
        await user.click(await screen.findByRole('option', { name: 'Produksi' }));
        expect(button('Mulai mengisi')).toBeEnabled();
    });

    it('a first-time department is confirmed before it locks; "Ubah" goes back to the picker', async () => {
        const user = userEvent.setup();
        renderFlow();
        await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
        await user.click(await screen.findByRole('option', { name: 'Produksi' }));
        await user.click(button('Mulai mengisi'));
        expect(await screen.findByText(/Departemen Anda: Produksi\. Pilihan ini tidak bisa diubah lagi/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ubah' }));
        expect(screen.getByRole('combobox', { name: 'Departemen' })).toBeInTheDocument();
        await user.click(button('Mulai mengisi'));
        await user.click(await screen.findByRole('button', { name: 'Ya, sudah benar' }));
        expect(screen.getByText('Penilaian 1 dari 3')).toBeInTheDocument();
    });

    it('a department known for the account is locked: no picker, start is ready', () => {
        renderFlow({ form: { ...FORM, respondent: { fullName: 'Rina Pemohon', departmentId: 'd2' } } });
        expect(screen.queryByRole('combobox', { name: 'Departemen' })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Departemen' })).toHaveTextContent('Produksi');
        expect(button('Mulai mengisi')).toBeEnabled();
    });
});

describe('SurveyFlow screens', () => {
    it('team screen comes first with its label and sub-text', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(screen.getByRole('heading', { name: 'Tim IT Support' })).toBeInTheDocument();
        expect(screen.getByText('Penilaian tim · SPJ')).toBeInTheDocument();
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
        expect(screen.getByText('“Selalu siap membantu”')).toBeInTheDocument();
        expect(button(NEXT)).toHaveAccessibleName('Lanjut · Andi');
        expect(screen.getByText('Penilaian 1 dari 3')).toBeInTheDocument();
        expect(screen.getByText('Tersimpan otomatis')).toBeInTheDocument();
        expect(chips().getAllByRole('button').map((chip) => chip.getAttribute('aria-label'))).toEqual(['1. Tim IT Support', '2. Andi', `3. ${LONG_NAME}`]);
    });

    it('the rail scrolls sideways and names the team by its own display name', async () => {
        const user = userEvent.setup();
        renderFlow({ form: { ...FORM, teamLabel: 'Label periode lama' } });
        await startFilling(user);
        expect(screen.getByTestId('csi-rail')).toHaveClass('overflow-x-auto');
        expect(chips().getByRole('button', { name: '1. Tim IT Support' })).toHaveTextContent('Tim IT Support');
        expect(screen.queryByText('Label periode lama')).not.toBeInTheDocument();
    });

    it('preview never claims an autosave', async () => {
        const user = userEvent.setup();
        renderFlow({ mode: 'preview' });
        await user.click(button('Mulai mengisi'));
        expect(screen.getByText('Penilaian 1 dari 3')).toBeInTheDocument();
        expect(screen.queryByText('Tersimpan otomatis')).not.toBeInTheDocument();
    });

    it('required blocks Lanjut with a count and highlight; optional can be skipped', async () => {
        const user = userEvent.setup();
        const scrollSpy = vi.mocked(scrollWithin);
        scrollSpy.mockClear();
        renderFlow();
        await startFilling(user);
        await user.click(button(NEXT));
        expect(screen.getByRole('status')).toHaveTextContent('1 pertanyaan wajib belum dijawab');
        expect(document.querySelectorAll('[data-missing]')).toHaveLength(1);
        expect(scrollSpy).toHaveBeenCalled();
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Sangat baik');
        // The optional CHOICE question stays unanswered.
        await user.click(button(NEXT));
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        await user.click(button(NEXT));
        expect(screen.getByRole('status')).toHaveTextContent('2 pertanyaan wajib belum dijawab');
        scrollSpy.mockReset();
    });

    it('rail ticks only after the screen was visited and its required questions are answered', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(chips().queryByRole('button', { name: /selesai/ })).not.toBeInTheDocument();
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Cukup');
        expect(chips().getByRole('button', { name: /Tim IT Support, selesai/ })).toBeInTheDocument();
        await user.click(chips().getByRole('button', { name: new RegExp(LONG_NAME) }));
        expect(screen.getByRole('heading', { name: LONG_NAME })).toBeInTheDocument();
        expect(chips().getByRole('button', { name: /Andi/ })).not.toHaveAccessibleName(/selesai/);
    });

    it('Tinjau jawaban returns to a screen skipped via the rail', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Cukup');
        await user.click(chips().getByRole('button', { name: new RegExp(LONG_NAME) }));
        await rate(user, `Kecepatan untuk ${LONG_NAME}`, 3);
        await user.click(button('Tinjau jawaban'));
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('2 pertanyaan wajib belum dijawab');
    });

    it('avatar falls back to the initial when the photo fails', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        await user.click(chips().getByRole('button', { name: new RegExp(LONG_NAME) }));
        const subject = screen.getByTestId('csi-subject-photo');
        const photo = subject.querySelector('img');
        expect(photo).toHaveAttribute('alt', '');
        fireEvent.error(photo as HTMLImageElement);
        expect(subject.querySelector('img')).toBeNull();
        expect(within(subject).getByText('B')).toBeInTheDocument();
    });
});

describe('SurveyFlow mobile footer spacing', () => {
    it('live: reserves room under the content for the sticky footer below lg (above the bottom nav)', () => {
        renderFlow();
        expect(screen.getByTestId('csi-flow-content')).toHaveClass('pb-[calc(10.5rem+env(safe-area-inset-bottom))]', 'lg:pb-0');
    });

    it('preview: no extra room (the footer is not lifted above a bottom nav there)', () => {
        renderFlow({ mode: 'preview' });
        expect(screen.getByTestId('csi-flow-content').className).not.toMatch(/pb-/);
    });
});
