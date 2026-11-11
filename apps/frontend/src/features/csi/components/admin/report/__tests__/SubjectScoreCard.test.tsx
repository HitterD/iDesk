import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectScoreCard } from '../SubjectScoreCard';
import { BANDS, question, ratee } from './reportFixture';

afterEach(cleanup);

const LONG = 'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini tentang layanan yang diberikan sepanjang periode';

describe('SubjectScoreCard', () => {
    it('truncates long question pills and keeps the full text as title', () => {
        const subject = ratee({ periodRateeId: 'r1', displayName: 'Dimas', questions: [question(LONG, 4.9), question('Keramahan petugas', 3.2)] });
        render(<SubjectScoreCard ratee={subject} rank={1} siteCode="SPJ" bands={BANDS} onOpen={vi.fn()} />);
        const label = screen.getByText(LONG);
        expect(label).toHaveClass('truncate', 'min-w-0', 'max-w-full');
        const pill = label.parentElement as HTMLElement;
        expect(pill).toHaveAttribute('title', LONG);
        expect(pill).toHaveClass('min-w-0', 'max-w-full');
        expect(screen.getByText('Keramahan petugas').parentElement).toHaveAttribute('title', 'Keramahan petugas');
    });

    it('shows the bracketed description as the pill label, full text in the title', () => {
        const prefix = 'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini';
        const subject = ratee({ periodRateeId: 'r1', displayName: 'Dimas', questions: [
            { ...question(prefix, 4.9), description: '[Kecepatan respon IT Support]' }, question('Keramahan petugas', 3.2),
        ] });
        render(<SubjectScoreCard ratee={subject} rank={2} siteCode={null} bands={BANDS} onOpen={vi.fn()} />);
        expect(screen.getByText('Kecepatan respon IT Support').parentElement).toHaveAttribute('title', `${prefix} [Kecepatan respon IT Support]`);
    });

    it('the text column can shrink below its content', () => {
        render(<SubjectScoreCard ratee={ratee({ periodRateeId: 'r1', displayName: 'Dimas', questions: [question(LONG, 4.9)] })}
            rank={1} siteCode="SPJ" bands={BANDS} onOpen={vi.fn()} />);
        const column = screen.getByText('Dimas').parentElement?.parentElement as HTMLElement;
        expect(column).toHaveClass('min-w-0', 'flex-1');
    });
});
