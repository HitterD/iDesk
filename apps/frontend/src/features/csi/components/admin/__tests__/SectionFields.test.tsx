import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../lib/periodForm';
import { SECTION_COPY } from '../../wizard/wizardCopy';
import { SectionFields } from '../SectionFields';

afterEach(cleanup);

describe('SectionFields', () => {
    it('score band preview is a labelled group (aria-label on a role, not on a bare <p>)', () => {
        render(<SectionFields form={initialState('hc')} set={vi.fn()} locked={false} />);
        const preview = screen.getByRole('group', { name: SECTION_COPY.bandsPreview });
        expect(preview.tagName).not.toBe('P');
        expect(within(preview).getAllByText(/./).length).toBeGreaterThanOrEqual(3);
    });

    describe('turning a section off while it has ratees', () => {
        const counts = { team: 2, people: 5, peopleNoun: 'PIC' as const };
        const both = { ...initialState('hc'), teamEnabled: true, individualEnabled: true };

        it('asks first and only switches off on confirm', async () => {
            const set = vi.fn();
            render(<SectionFields form={both} set={set} locked={false} rateeCounts={counts} />);
            await userEvent.click(screen.getByRole('switch', { name: SECTION_COPY.team }));
            const dialog = screen.getByRole('alertdialog');
            expect(dialog).toHaveTextContent('2 tim tidak akan tampil ke penilai. Lanjutkan?');
            expect(set).not.toHaveBeenCalled();
            await userEvent.click(within(dialog).getByRole('button', { name: 'Matikan' }));
            expect(set).toHaveBeenCalledWith('teamEnabled', false);
        });

        it('cancel keeps the section on; PIC count is named for the per-orang section', async () => {
            const set = vi.fn();
            render(<SectionFields form={both} set={set} locked={false} rateeCounts={counts} />);
            await userEvent.click(screen.getByRole('switch', { name: SECTION_COPY.individual }));
            expect(screen.getByRole('alertdialog')).toHaveTextContent('5 PIC tidak akan tampil ke penilai. Lanjutkan?');
            await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
            expect(set).not.toHaveBeenCalled();
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });

        it('no ratees (or turning on) needs no confirmation', async () => {
            const set = vi.fn();
            render(<SectionFields form={{ ...both, teamEnabled: false }} set={set} locked={false} rateeCounts={{ ...counts, team: 0 }} />);
            await userEvent.click(screen.getByRole('switch', { name: SECTION_COPY.team }));
            expect(set).toHaveBeenCalledWith('teamEnabled', true);
            expect(screen.queryByRole('alertdialog')).toBeNull();
        });
    });
});
