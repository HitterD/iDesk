import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurveyFlow } from '../SurveyFlow';
import { draftKey } from '../../../lib/surveyDraft';
import { answerAll, button, choose, EXPECTED_ITEMS, FORM, NEXT, startFilling } from './surveyFlowFixture';

const KEY = draftKey('u1', 'p1');
const conflict = Object.assign(new Error('HTTP 409'), { isAxiosError: true, response: { status: 409, data: {} } });

const renderFlow = (props: Partial<Parameters<typeof SurveyFlow>[0]> = {}) =>
    render(<SurveyFlow form={FORM} userId="u1" {...props} />);
const storedDraft = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('SurveyFlow review and submit', () => {
    it('review shows averages per ratee and submits typed answers with the edited name', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        renderFlow({ onSubmit });
        const name = screen.getByLabelText('Nama');
        await user.clear(name);
        await user.type(name, '  Dodi Pratama ');
        await startFilling(user);
        await answerAll(user);
        expect(within(screen.getByRole('listitem', { name: 'Andi' })).getByText('4,5')).toBeInTheDocument();
        expect(within(screen.getByRole('listitem', { name: 'Tim IT Support' })).getByText('3,0')).toBeInTheDocument();
        expect(screen.getByText('Dodi Pratama')).toBeInTheDocument();
        expect(screen.getByText('Produksi')).toBeInTheDocument();
        await user.click(within(screen.getByRole('listitem', { name: 'Andi' })).getByRole('button', { name: 'Ubah' }));
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        await user.type(screen.getByRole('textbox', { name: /Catatan/ }), '  Responsif  ');
        await user.click(button(NEXT));
        await user.click(button('Tinjau jawaban'));
        await user.click(button('Kirim'));
        expect(onSubmit).toHaveBeenCalledWith({
            respondentName: 'Dodi Pratama', departmentId: 'd2',
            items: [...EXPECTED_ITEMS.slice(0, 3), { periodRateeDimensionId: 'x3', text: 'Responsif' }, EXPECTED_ITEMS[3]],
        });
    });

    it('review Ubah on the name returns to the intro', async () => {
        const user = userEvent.setup();
        renderFlow();
        await startFilling(user);
        await answerAll(user);
        await user.click(button('Ubah nama'));
        expect(screen.getByLabelText('Nama')).toHaveValue('Rina Pemohon');
    });

    it('duplicate name (409) returns to the intro with the inline error and keeps the draft', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        const view = renderFlow({ onSubmit });
        await startFilling(user);
        await answerAll(user);
        await user.click(button('Kirim'));
        view.rerender(<SurveyFlow form={FORM} userId="u1" onSubmit={onSubmit} error={conflict} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Nama ini sudah mengisi survei ini');
        expect(screen.getByLabelText('Nama')).toHaveAttribute('aria-invalid', 'true');
        expect(storedDraft().answers).toMatchObject({ t1: { optionIndex: 1 }, y1: { score: 3 } });
        await user.type(screen.getByLabelText('Nama'), ' 2');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});

describe('SurveyFlow draft', () => {
    it('restores a v2 draft after remount', async () => {
        const user = userEvent.setup();
        const first = renderFlow();
        await startFilling(user);
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Kurang');
        await waitFor(() => expect(storedDraft().answers).toEqual({ t1: { optionIndex: 2 } }));
        first.unmount();
        renderFlow();
        expect(screen.getByText('Melanjutkan isian sebelumnya')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Kurang' })).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a v1 draft', () => {
        localStorage.setItem('csi-draft:u1:p1', JSON.stringify({ departmentId: 'd1', scores: { x1: 5 }, comments: {}, position: 2 }));
        renderFlow();
        expect(screen.queryByText('Melanjutkan isian sebelumnya')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
    });

    it('saves a pending answer when unmounted inside the debounce window', async () => {
        const user = userEvent.setup();
        const view = renderFlow();
        await startFilling(user);
        await choose(user, 'Kualitas layanan untuk Tim IT Support', 'Cukup');
        view.unmount();
        expect(storedDraft().answers).toEqual({ t1: { optionIndex: 1 } });
    });

    it('does not resurrect the draft after submit when the page clears it', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn(() => localStorage.removeItem(KEY));
        const view = renderFlow({ onSubmit });
        await startFilling(user);
        await answerAll(user);
        await user.click(button('Kirim'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        view.unmount();
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('fresh start keeps the department but empties name and answers', () => {
        localStorage.setItem(KEY, JSON.stringify({ respondentName: 'Rina Pemohon', departmentId: 'd1', answers: { y1: { score: 3 } }, comments: {}, position: 2 }));
        renderFlow({ fresh: { departmentId: 'd2' } });
        expect(screen.getByLabelText('Nama')).toHaveValue('');
        expect(screen.getByRole('combobox', { name: 'Departemen' })).toHaveTextContent('Produksi');
        expect(screen.queryByText('Melanjutkan isian sebelumnya')).not.toBeInTheDocument();
    });
});

describe('SurveyFlow chrome and preview', () => {
    it('navigation scrolls the new screen into view and focuses its heading', async () => {
        const user = userEvent.setup();
        const scrolled: Element[] = [];
        const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) { scrolled.push(this); });
        renderFlow();
        expect(scrollSpy).not.toHaveBeenCalled();
        await startFilling(user);
        const heading = screen.getByRole('heading', { name: 'Tim IT Support' });
        // The heading sits in the sticky photo, so the subject card is what scrolls into view.
        expect(scrolled).toContain(screen.getByRole('region', { name: 'Tim IT Support' }));
        expect(heading).toHaveFocus();
        scrollSpy.mockRestore();
    });

    it('renders screen titles as h2 when embedded', () => {
        renderFlow({ headingLevel: 'h2' });
        expect(screen.getByRole('heading', { level: 2, name: 'Survei Kepuasan ICT Q4' })).toBeInTheDocument();
    });

    it('preview never stores or submits', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        renderFlow({ mode: 'preview', onSubmit, form: { ...FORM, respondent: { fullName: '' } } });
        expect(button('Mulai mengisi')).toBeEnabled();
        await user.click(button('Mulai mengisi'));
        await answerAll(user);
        expect(button('Kirim')).toBeDisabled();
        await user.click(button('Kirim'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
        setItem.mockRestore();
    });
});
