import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThankYouScreen } from '../ThankYouScreen';
import { FORM, LONG_NAME } from './surveyFlowFixture';

const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock('framer-motion', async (importOriginal) => ({
    ...(await importOriginal<typeof import('framer-motion')>()),
    useReducedMotion: () => motion.reduce,
}));

const PAYLOAD = {
    respondentName: 'Dodi', departmentId: 'd1',
    items: [{ periodRateeDimensionId: 't1', optionIndex: 0 }, { periodRateeDimensionId: 'x1', score: 4 }, { periodRateeDimensionId: 'x2', score: 3 }],
};
const renderScreen = (payload: typeof PAYLOAD | null = PAYLOAD) => render(
    <MemoryRouter>
        <ThankYouScreen ratees={FORM.ratees} payload={payload} message="Masukan Anda dibaca tim ICT." basePath="/client/csi" onFillAgain={() => {}} />
    </MemoryRouter>,
);

afterEach(() => {
    cleanup();
    motion.reduce = false;
});

describe('ThankYouScreen', () => {
    it('thanks the respondent by name and lists every subject, team first, with mini average stars', () => {
        renderScreen();
        expect(screen.getByRole('heading', { name: 'Terima kasih, Dodi!' })).toBeInTheDocument();
        expect(screen.getByText('Masukan Anda dibaca tim ICT.')).toBeInTheDocument();
        const items = within(screen.getByRole('list', { name: 'Semua subjek' })).getAllByRole('listitem');
        expect(items.map((item) => item.textContent)).toEqual(['TTim IT Support', 'AAndi', LONG_NAME]); // Budi has a photo, no initial
        expect(within(items[0]).getByRole('img', { name: 'Rata-rata 5,0 dari 5' })).toBeInTheDocument();
        expect(within(items[1]).getByRole('img', { name: 'Rata-rata 3,5 dari 5' })).toBeInTheDocument();
        expect(within(items[2]).getByRole('img', { name: '—' })).toBeInTheDocument();
    });

    it('draws the check and drops confetti', () => {
        renderScreen();
        expect(document.querySelector('path.csi-draw-check')).not.toBeNull();
        expect(screen.getByTestId('csi-confetti').children.length).toBeGreaterThan(0);
    });

    it('no confetti under reduced motion', () => {
        motion.reduce = true;
        renderScreen();
        expect(screen.queryByTestId('csi-confetti')).not.toBeInTheDocument();
    });

    it('falls back to the plain title without a payload', () => {
        renderScreen(null);
        expect(screen.getByRole('heading', { name: 'Terima kasih!' })).toBeInTheDocument();
    });
});
