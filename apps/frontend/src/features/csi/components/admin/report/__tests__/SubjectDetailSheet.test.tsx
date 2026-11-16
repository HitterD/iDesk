// A UTC timestamp before 07:00 WIB falls on the next local day: pin the worker to WIB before any Date is built.
process.env.TZ = 'Asia/Jakarta';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectDetailSheet } from '../SubjectDetailSheet';
import { BANDS, ratee } from './reportFixture';

afterEach(cleanup);

describe('SubjectDetailSheet', () => {
    it('shows comments anonymously in scrambled order without department or timestamp', () => {
        const subject = ratee({
            periodRateeId: 'r1', displayName: 'Dimas',
            comments: [{ text: 'Respon cepat' }, { text: 'Bagus sekali' }],
        });
        render(<SubjectDetailSheet ratee={subject} siteName="Sepanjang" siteCode="SPJ" bands={BANDS} onClose={vi.fn()} />);
        expect(screen.getByText('“Respon cepat”')).toBeInTheDocument();
        expect(screen.getByText('“Bagus sekali”')).toBeInTheDocument();
        expect(screen.queryByText(/Finance|Okt 2026/i)).not.toBeInTheDocument();
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

    it('renders subject photo uncropped (object-contain) without object-[center_25%] overlay clipping', () => {
        const subject = ratee({
            periodRateeId: 'r3',
            displayName: 'Suherlan',
            photoUrl: '/uploads/csi/suherlan.jpg',
            serviceCode: 'DRV',
            serviceFunction: 'DRIVER SERVICES',
        });
        const { baseElement } = render(<SubjectDetailSheet ratee={subject} siteName="Karawang" siteCode="KRW" bands={BANDS} onClose={vi.fn()} />);
        const imgs = Array.from(baseElement.querySelectorAll('img'));
        expect(imgs.some((img) => img.className.includes('object-contain'))).toBe(true);
        expect(imgs.some((img) => img.className.includes('object-[center_25%]'))).toBe(false);
        expect(screen.getByText('DRIVER SERVICES')).toBeInTheDocument();
    });
});
