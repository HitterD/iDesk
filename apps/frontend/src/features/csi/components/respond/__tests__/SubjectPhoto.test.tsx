import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    it('is a stacked 4/3.8 banner below lg: sticky only behind the lg + container >= 780px variants', () => {
        render(<SubjectPhoto ratee={RATEE} index={0} total={3} />);
        expect(classes()).toEqual(expect.arrayContaining(['relative', 'aspect-[4/3.8]', 'max-h-[64vh]']));
        expect(classes()).toContain('lg:@min-[780px]:sticky');
        // No unprefixed sticky / fixed height: the < lg layout (mobile header + bottom nav) never sticks.
        expect(classes().filter((name) => /^(sticky|top-|h-\[|min-h-)/.test(name))).toEqual([]);
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
