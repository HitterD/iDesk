import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyFlow } from '../SurveyFlow';
import { button, chips, choose, FORM, LONG_NAME, NEXT, rate, startFilling } from './surveyFlowFixture';

const renderFlow = (props: Partial<Parameters<typeof SurveyFlow>[0]> = {}) =>
    render(<SurveyFlow form={FORM} userId="u1" {...props} />);

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('SurveyFlow intro', () => {
    it('shows team + people, minutes, deadline and the editable prefilled name', () => {
        renderFlow();
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
        expect(screen.getByText('Anda akan menilai tim IT Support dan 2 orang · sekitar 1 menit')).toBeInTheDocument();
        expect(screen.getByText('Tersedia sampai 31 Okt 2026')).toBeInTheDocument();
        const name = screen.getByLabelText('Nama');
        expect(name).toHaveValue('Rina Pemohon');
        expect(name).not.toHaveAttribute('readonly');
        expect(name).toHaveAttribute('autocomplete', 'name');
    });

    it('no active department: friendly message instead of a dead start button', () => {
        renderFlow({ form: { ...FORM, departments: [] } });
        expect(screen.getByRole('status')).toHaveTextContent('Survei ini belum siap diisi. Silakan coba lagi nanti atau hubungi admin.');
        expect(screen.queryByRole('button', { name: 'Mulai mengisi' })).not.toBeInTheDocument();
    });

    it('lists names already submitted and blocks reusing one (case/space-insensitive)', async () => {
        const user = userEvent.setup();
        renderFlow({ form: { ...FORM, submittedNames: ['Rina Pemohon', 'Sari'] } });
        expect(screen.getByText('Akun ini sudah mengisi atas nama: Rina Pemohon, Sari.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('Nama ini sudah mengisi survei ini');
        await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
        await user.click(await screen.findByRole('option', { name: 'Produksi' }));
        expect(button('Mulai mengisi')).toBeDisabled();
        const name = screen.getByLabelText('Nama');
        await user.clear(name);
        await user.type(name, '  sari ');
        expect(screen.getByRole('alert')).toHaveTextContent('Nama ini sudah mengisi survei ini');
        await user.clear(name);
        await user.type(name, 'Dodi');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(button('Mulai mengisi')).toBeEnabled();
    });

    it('requires a 2–150 character name', async () => {
        const user = userEvent.setup();
        renderFlow();
        await user.click(screen.getByRole('combobox', { name: 'Departemen' }));
        await user.click(await screen.findByRole('option', { name: 'Produksi' }));
        const name = screen.getByLabelText('Nama');
        await user.clear(name);
        await user.type(name, 'R');
        expect(screen.getByRole('alert')).toHaveTextContent('Nama harus 2–150 karakter');
        expect(button('Mulai mengisi')).toBeDisabled();
        expect(name).toHaveAttribute('maxlength', '150');
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
        expect(screen.getByText('Langkah 1 dari 3')).toBeInTheDocument();
        expect(chips().getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Tim IT Support', 'Andi', LONG_NAME]);
    });

    it('chips wrap and show full names', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(screen.getByRole('navigation', { name: 'Daftar bagian yang dinilai' }).querySelector('ol')).toHaveClass('flex-wrap');
        const chip = chips().getByRole('button', { name: new RegExp(LONG_NAME) });
        expect(chip).toHaveTextContent(LONG_NAME);
        expect(chip.innerHTML).not.toContain('truncate');
    });

    it('required blocks Lanjut with a count and highlight; optional can be skipped', async () => {
        const user = userEvent.setup();
        const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
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
        scrollSpy.mockRestore();
    });

    it('chip ticks only after the screen was visited and its required questions are answered', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        expect(chips().queryByRole('button', { name: /lengkap/ })).not.toBeInTheDocument();
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Cukup');
        expect(chips().getByRole('button', { name: /Tim IT Support, lengkap/ })).toBeInTheDocument();
        await user.click(chips().getByRole('button', { name: new RegExp(LONG_NAME) }));
        expect(screen.getByRole('heading', { name: LONG_NAME })).toBeInTheDocument();
        expect(chips().getByRole('button', { name: /Andi/ })).not.toHaveAccessibleName(/lengkap/);
    });

    it('Tinjau jawaban returns to a screen skipped via the chips', async () => {
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
        const photo = document.querySelector('img');
        expect(photo).toHaveAttribute('alt', '');
        fireEvent.error(photo as HTMLImageElement);
        expect(document.querySelector('img')).toBeNull();
        expect(screen.getByText('B')).toBeInTheDocument();
    });
});
