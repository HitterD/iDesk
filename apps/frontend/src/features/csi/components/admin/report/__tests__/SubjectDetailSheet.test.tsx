// A UTC timestamp before 07:00 WIB falls on the next local day: pin the worker to WIB before any Date is built.
process.env.TZ = 'Asia/Jakarta';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectDetailSheet } from '../SubjectDetailSheet';
import { BANDS, ratee } from './reportFixture';

afterEach(cleanup);

describe('SubjectDetailSheet', () => {
    it('shows a comment on its local (WIB) day', () => {
        const subject = ratee({
            periodRateeId: 'r1', displayName: 'Dimas',
            comments: [{ text: 'Respon cepat', departmentName: 'Finance', submittedAt: '2026-10-29T19:00:00Z' }],
        });
        render(<SubjectDetailSheet ratee={subject} siteName="Sepanjang" siteCode="SPJ" bands={BANDS} onClose={vi.fn()} />);
        expect(screen.getByText('Finance · 30 Okt 2026')).toBeInTheDocument();
    });

    it('renders service code, service function, bagian, and score word badge', () => {
        const subject = ratee({
            periodRateeId: 'r2',
            displayName: 'Arifin',
            kind: 'TEAM',
            serviceCode: 'HCS',
            bagian: 'Transportasi',
            serviceFunction: 'Perawatan kendaraan',
            mean: 4.5,
            index: 90,
            raterCount: 3,
        });
        render(<SubjectDetailSheet ratee={subject} siteName="Sepanjang" siteCode="SPJ" bands={BANDS} onClose={vi.fn()} />);
        expect(screen.getByText('HCS')).toBeInTheDocument();
        expect(screen.getByText('Perawatan kendaraan')).toBeInTheDocument();
        expect(screen.getByText(/Transportasi/)).toBeInTheDocument();
        expect(screen.getByText('indeks 90,0%')).toBeInTheDocument();
        expect(screen.getByText('Sangat puas')).toBeInTheDocument();
    });
});
