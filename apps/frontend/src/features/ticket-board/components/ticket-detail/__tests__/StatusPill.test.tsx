import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from '../TicketPropertyRows';

const hold = { label: 'Menunggu akses E-Form', code: '#AB12CD34', detail: 'Menunggu persetujuan atasan' };

describe('StatusPill', () => {
    it('names the request a waiting ticket is held on instead of "Waiting Vendor"', () => {
        render(<StatusPill status="WAITING_VENDOR" hold={hold} />);
        expect(screen.getByText('Menunggu akses E-Form')).toHaveAttribute('title', '#AB12CD34 · Menunggu persetujuan atasan');
        expect(screen.queryByText('Waiting Vendor')).not.toBeInTheDocument();
    });

    it('keeps the plain status for a real vendor wait or any other status', () => {
        const { rerender } = render(<StatusPill status="WAITING_VENDOR" />);
        expect(screen.getByText('Waiting Vendor')).toBeInTheDocument();
        rerender(<StatusPill status="IN_PROGRESS" hold={hold} />);
        expect(screen.queryByText('Menunggu akses E-Form')).not.toBeInTheDocument();
    });
});
