import { describe, expect, it, vi } from 'vitest';
import { REQUEST_CARDS, TICKET_TYPES } from '../createTicketConfig';

describe('request cards', () => {
    it('Hardware and E-Form are ticket types of this page, named as in the approved mockup', () => {
        expect(TICKET_TYPES).toContain('hardware');
        expect(TICKET_TYPES).toContain('eform');
        const [hardware, eform] = REQUEST_CARDS;
        expect(hardware).toMatchObject({
            key: 'hardware-request', title: 'Hardware Request', ctaLabel: 'Buat Hardware Request',
            description: 'Ajukan perangkat baru, upgrade, penggantian aset, atau penjadwalan pemasangan.',
        });
        expect(eform).toMatchObject({
            key: 'eform-request', title: 'E-Form Request', ctaLabel: 'Buat E-Form Request',
            description: 'Minta akses VPN, website, network, email, flashdisk, atau folder NAS dengan form bertanda tangan.',
        });
    });

    it('choosing a card opens the form on this page instead of navigating to another module', () => {
        const setTicketType = vi.fn();
        const navigate = vi.fn();
        REQUEST_CARDS[0].action({ setTicketType, navigate, getBasePath: () => '/client' });
        REQUEST_CARDS[1].action({ setTicketType, navigate, getBasePath: () => '/client' });
        expect(setTicketType).toHaveBeenNthCalledWith(1, 'hardware');
        expect(setTicketType).toHaveBeenNthCalledWith(2, 'eform');
        expect(navigate).not.toHaveBeenCalled();
    });
});
