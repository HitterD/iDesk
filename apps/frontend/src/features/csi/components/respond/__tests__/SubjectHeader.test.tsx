import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CsiFormRatee } from '../../../types';
import { SubjectHeader } from '../SubjectHeader';

const RATEE: CsiFormRatee = {
    periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null,
    siteId: 's1', siteCode: 'SPJ', tagline: null, photoUrl: null, dimensions: [],
};

const header = () => screen.getByTestId('csi-subject-header');

afterEach(cleanup);

describe('SubjectHeader', () => {
    it('is a compact row with a small round avatar, never a sticky full-height photo', () => {
        render(<SubjectHeader ratee={RATEE} index={0} total={3} />);
        const avatar = header().querySelector('[data-avatar]')!;
        expect(avatar.className).toMatch(/h-\[72px\]/);
        expect(avatar.className).toMatch(/sm:h-24/);
        expect(avatar.className).toContain('rounded-full');
        expect(header().className.split(/\s+/).filter((name) => /sticky|min-h-|max-h-|aspect-/.test(name))).toEqual([]);
    });

    it('shows the counter, kind chip, name and job title', () => {
        render(<SubjectHeader ratee={RATEE} index={1} total={3} />);
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
        expect(screen.getByText('Penilaian individu · SPJ')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(screen.getByText('IT Support')).toBeInTheDocument();
    });

    it('shows the service function under the name when there is one', () => {
        render(<SubjectHeader ratee={{ ...RATEE, serviceFunction: 'People & Organization Development' }} index={0} total={1} />);
        expect(screen.getByText('People & Organization Development')).toBeInTheDocument();
        expect(screen.getByText(/fungsi pelayanan/i)).toBeInTheDocument();
    });

    it('renders no service function line without one', () => {
        render(<SubjectHeader ratee={RATEE} index={0} total={1} />);
        expect(screen.queryByText(/fungsi pelayanan/i)).toBeNull();
    });

    it('a ratee without photo renders the initial on the site colour', () => {
        render(<SubjectHeader ratee={RATEE} index={0} total={1} />);
        expect(header().querySelector('img')).toBeNull();
        expect(screen.getByText('A').closest('[data-avatar]')).toHaveClass('bg-[hsl(var(--ticket-teal))]');
    });

    it('renders the tagline in quotes, none without one', () => {
        render(<SubjectHeader ratee={{ ...RATEE, kind: 'TEAM', tagline: 'Siap membantu' }} index={0} total={1} />);
        expect(screen.getByText('Penilaian tim · SPJ')).toBeInTheDocument();
        expect(screen.getByText('“Siap membantu”')).toBeInTheDocument();
        cleanup();
        render(<SubjectHeader ratee={RATEE} index={0} total={1} />);
        expect(header().textContent).not.toMatch(/[“”]/);
    });
});
