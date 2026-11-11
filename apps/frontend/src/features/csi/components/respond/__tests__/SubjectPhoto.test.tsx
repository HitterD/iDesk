import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CsiFormRatee } from '../../../types';
import { SubjectPhoto } from '../SubjectPhoto';

const RATEE: CsiFormRatee = {
    periodRateeId: 'r1', kind: 'PERSON', displayName: 'Andi', jobTitle: 'IT Support', avatarUrl: null,
    siteId: 's1', siteCode: 'SPJ', tagline: null, photoUrl: null, dimensions: [],
};

const photo = () => screen.getByTestId('csi-subject-photo');
const classes = () => photo().className.split(/\s+/);

afterEach(cleanup);

describe('SubjectPhoto', () => {
    it('renders without React duplicate-key warnings (photo and caption are re-keyed per subject)', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const { rerender } = render(<SubjectPhoto ratee={RATEE} index={0} total={2} />);
            rerender(<SubjectPhoto ratee={{ ...RATEE, periodRateeId: 'r2', displayName: 'Budi' }} index={1} total={2} />);
            expect(error.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([]);
        } finally {
            error.mockRestore();
        }
    });

    it('is a short banner on phones (first question visible), taller from sm, sticky only behind the lg + container >= 780px variants', () => {
        render(<SubjectPhoto ratee={RATEE} index={0} total={3} />);
        expect(classes()).toEqual(expect.arrayContaining(['relative', 'aspect-[16/10]', 'max-h-[34vh]', 'sm:aspect-[4/3.8]', 'sm:max-h-[64vh]']));
        expect(classes()).toContain('lg:@min-[780px]:sticky');
        // No unprefixed sticky / fixed height: the < lg layout (mobile header + bottom nav) never sticks.
        expect(classes().filter((name) => /^(sticky|top-|h-\[|min-h-)/.test(name))).toEqual([]);
    });

    it('is a narrower, shorter column than before so the form leads (max 640 px tall)', () => {
        render(<SubjectPhoto ratee={RATEE} index={0} total={3} />);
        expect(classes()).toContain('lg:@min-[780px]:max-h-[640px]');
        expect(classes()).not.toContain('lg:@min-[780px]:max-h-[820px]');
    });

    it('shows the service function under the job title, and nothing when there is none', () => {
        render(<SubjectPhoto ratee={{ ...RATEE, serviceFunction: 'People & Organization Development' }} index={0} total={1} />);
        expect(screen.getByText('People & Organization Development')).toBeInTheDocument();
        expect(screen.getByText(/fungsi pelayanan/i)).toBeInTheDocument();
        cleanup();
        render(<SubjectPhoto ratee={RATEE} index={0} total={1} />);
        expect(screen.queryByText(/fungsi pelayanan/i)).toBeNull();
    });

    it('shows the badge, kind chip, name and job title; no tagline line when null', () => {
        render(<SubjectPhoto ratee={RATEE} index={1} total={3} />);
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
        expect(screen.getByText('Penilaian individu · SPJ')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(screen.getByText('IT Support')).toBeInTheDocument();
        expect(photo().querySelector('p.italic')).toBeNull();
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('a ratee without tagline renders no quote line', () => {
        render(<SubjectPhoto ratee={{ ...RATEE, tagline: null }} index={0} total={1} />);
        expect(photo().textContent).not.toMatch(/[“”]/);
        expect(photo().querySelector('p.italic')).toBeNull();
    });

    it('a ratee without photo renders initials on the site colour', () => {
        render(<SubjectPhoto ratee={{ ...RATEE, photoUrl: null, avatarUrl: null }} index={0} total={1} />);
        expect(photo().querySelector('img')).toBeNull();
        expect(screen.getByText('A')).toHaveClass('bg-[hsl(var(--ticket-teal))]');
    });

    it('renders the tagline in quotes', () => {
        render(<SubjectPhoto ratee={{ ...RATEE, kind: 'TEAM', tagline: 'Siap membantu' }} index={0} total={1} />);
        expect(screen.getByText('Penilaian tim · SPJ')).toBeInTheDocument();
        expect(screen.getByText('“Siap membantu”')).toBeInTheDocument();
    });
});
