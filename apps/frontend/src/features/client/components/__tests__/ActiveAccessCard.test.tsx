import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveAccessCard, type ActiveAccess } from '../ActiveAccessCard';

afterEach(cleanup);

const access = (over: Partial<ActiveAccess> = {}): ActiveAccess => ({
    eformId: 'ef-1', ticketId: 't-1', kind: 'VPN', startDate: '2026-02-01', endDate: '2026-11-28', group: 'soon', daysLeft: 5, ...over,
});
const renderCard = (a: ActiveAccess, onRenew = vi.fn()) => render(<MemoryRouter><ActiveAccessCard access={a} onRenew={onRenew} /></MemoryRouter>);

describe('ActiveAccessCard', () => {
    it('says how many days are left, in amber when it ends within 7 days, and offers renewal', () => {
        const onRenew = vi.fn();
        renderCard(access(), onRenew);
        expect(screen.getByText('Sisa 5 hari')).toHaveAttribute('data-tone', 'amber');
        fireEvent.click(screen.getByRole('button', { name: 'Perpanjang' }));
        expect(onRenew).toHaveBeenCalledWith('t-1');
    });

    it('offers renewal up to 30 days before the end, not earlier', () => {
        renderCard(access({ group: 'active', daysLeft: 30 }));
        expect(screen.getByRole('button', { name: 'Perpanjang' })).toBeInTheDocument();
        cleanup();
        renderCard(access({ group: 'active', daysLeft: 31 }));
        expect(screen.queryByRole('button', { name: 'Perpanjang' })).toBeNull();
        expect(screen.getByText('Sisa 31 hari')).toHaveAttribute('data-tone', 'green');
    });

    it('a permanent access says so and has no renewal', () => {
        renderCard(access({ endDate: null, group: 'permanent', daysLeft: null }));
        expect(screen.getByText('Permanen')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Perpanjang' })).toBeNull();
    });

    it('today is "Berakhir hari ini"; the card links to its ticket', () => {
        renderCard(access({ daysLeft: 0 }));
        expect(screen.getByText('Berakhir hari ini')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /VPN/ })).toHaveAttribute('href', '/tickets/t-1');
    });
});
