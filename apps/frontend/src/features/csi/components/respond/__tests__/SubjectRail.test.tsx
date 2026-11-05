import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiFormRatee } from '../../../types';
import { SubjectRail } from '../SubjectRail';

const QUESTIONS = 3;
const ratee = (index: number, kind: CsiFormRatee['kind'] = 'PERSON'): CsiFormRatee => ({
    periodRateeId: `r${index}`, kind, displayName: kind === 'TEAM' ? `Tim Site ${index}` : `Orang ${index}`, jobTitle: null,
    avatarUrl: null, siteId: 's1', siteCode: 'SPJ', tagline: null, photoUrl: null, dimensions: [],
});
const RATEES = [ratee(1, 'TEAM'), ...Array.from({ length: 14 }, (_, index) => ratee(index + 2))];
const FOUR = RATEES.slice(0, 4);

const renderRail = (props: Partial<Parameters<typeof SubjectRail>[0]> = {}) => {
    const onSelect = vi.fn();
    render(<SubjectRail ratees={FOUR} current={1} answeredCount={() => 0} questionCount={() => QUESTIONS} onSelect={onSelect} {...props} />);
    return onSelect;
};
const rail = () => within(screen.getByRole('navigation', { name: 'Daftar bagian yang dinilai' }));
const allButton = () => screen.getByRole('button', { name: /^Semua/ });

afterEach(cleanup);

describe('SubjectRail', () => {
    it('renders one button per ratee with its number', () => {
        renderRail();
        const buttons = rail().getAllByRole('button');
        expect(buttons).toHaveLength(4);
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['1. Tim Site 1', '2. Orang 2', '3. Orang 3', '4. Orang 4']);
        expect(within(buttons[2]).getByText('3')).toBeInTheDocument();
        expect(buttons[1]).toHaveAttribute('aria-current', 'step');
    });

    it('only the current ratee shows its name', () => {
        renderRail();
        expect(rail().getByText('Orang 2')).toBeInTheDocument();
        expect(rail().getByText('Individu')).toBeInTheDocument();
        expect(rail().queryByText('Tim Site 1')).not.toBeInTheDocument();
        expect(rail().queryByText('Orang 3')).not.toBeInTheDocument();
    });

    it('a partly answered current ratee shows "x/y dijawab"', () => {
        renderRail({ answeredCount: (index) => (index === 1 ? 2 : 0) });
        expect(rail().getByText('2/3 dijawab')).toBeInTheDocument();
    });

    it('a fully answered ratee shows the check badge and "Selesai"', () => {
        renderRail({ answeredCount: (index) => (index === 1 ? QUESTIONS : 0) });
        const current = rail().getByRole('button', { name: '2. Orang 2, selesai' });
        expect(within(current).getByText('Selesai')).toBeInTheDocument();
        expect(within(current).getByTestId('csi-rail-check')).toBeInTheDocument();
        expect(within(current).queryByText('2')).not.toBeInTheDocument();
    });

    it('an explicit done callback overrides the answered count', () => {
        renderRail({ answeredCount: () => 1, done: (index) => index === 0 });
        expect(rail().getByRole('button', { name: '1. Tim Site 1, selesai' })).toBeInTheDocument();
        expect(rail().getByRole('button', { name: '2. Orang 2' })).toBeInTheDocument();
    });

    it('puts a separator after the last team', () => {
        renderRail();
        const items = screen.getByRole('navigation', { name: 'Daftar bagian yang dinilai' }).querySelectorAll('li');
        expect(items).toHaveLength(5);
        expect(items[1]).toHaveAttribute('aria-hidden', 'true');
    });

    it('header shows position, finished count and the autosave note', () => {
        renderRail({ answeredCount: (index) => (index === 0 ? QUESTIONS : 0) });
        expect(screen.getByText('Penilaian 2 dari 4')).toBeInTheDocument();
        expect(screen.getByText('· 1 selesai')).toBeInTheDocument();
        expect(screen.getByText('Tersimpan otomatis')).toBeInTheDocument();
    });

    it('hides the autosave note when nothing is saved (preview)', () => {
        renderRail({ saved: false });
        expect(screen.queryByText('Tersimpan otomatis')).not.toBeInTheDocument();
    });

    it('selecting a rail item calls onSelect', async () => {
        const user = userEvent.setup();
        const onSelect = renderRail();
        await user.click(rail().getByRole('button', { name: '4. Orang 4' }));
        expect(onSelect).toHaveBeenCalledWith(3);
    });

    it('"Semua 15" opens a list of all 15 and selecting one calls onSelect', async () => {
        const user = userEvent.setup();
        const onSelect = renderRail({ ratees: RATEES, current: 0 });
        expect(allButton()).toHaveAccessibleName('Semua 15');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.click(allButton());
        const dialog = within(screen.getByRole('dialog', { name: 'Semua yang Anda nilai' }));
        expect(dialog.getAllByRole('button', { name: /^\d+\. / })).toHaveLength(15);
        await user.click(dialog.getByRole('button', { name: /^12\. Orang 12/ }));
        expect(onSelect).toHaveBeenCalledWith(11);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape closes the popover', async () => {
        const user = userEvent.setup();
        renderRail({ ratees: RATEES });
        await user.click(allButton());
        expect(allButton()).toHaveAttribute('aria-expanded', 'true');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(allButton()).toHaveFocus();
    });

    it('a click outside closes the popover', async () => {
        const user = userEvent.setup();
        renderRail({ ratees: RATEES });
        await user.click(allButton());
        await user.click(document.body);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('the rail container is horizontally scrollable and the popover fits a 360px viewport', async () => {
        const user = userEvent.setup();
        renderRail({ ratees: RATEES });
        expect(screen.getByTestId('csi-rail')).toHaveClass('overflow-x-auto');
        await user.click(allButton());
        expect(screen.getByRole('dialog')).toHaveClass('w-[min(560px,100%)]', 'max-w-[calc(100vw-24px)]');
    });

    it('arrows stay hidden while the rail does not overflow', () => {
        renderRail({ ratees: RATEES });
        expect(screen.queryByRole('button', { name: 'Geser kiri' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Geser kanan' })).not.toBeInTheDocument();
    });
});
