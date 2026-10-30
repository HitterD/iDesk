import { ForbiddenException } from '@nestjs/common';
import { IpopTicketService, isVisibleTo, IPOP_SCOPE } from '../../ipop/ipop-ticket.service';
import { TicketSource } from '../../../ticketing/entities/ticket.entity';
import { scopeOf } from '../app-scope';

const ebbk = scopeOf({ clientId: 'ebbk', modules: ['web-developer'] });

describe('connected app scope', () => {
    it('tags its tickets with its own source and channel', () => {
        expect(ebbk).toEqual({ source: 'EBBK', ticketSource: TicketSource.API, modules: ['web-developer'], ownTicketsOnly: true });
    });

    it('sees only the tickets it filed, unlike iPop', () => {
        const idesk = { externalSource: null, ticketType: 'WEB_DEV_REQUEST', user: { employeeId: '00012' } } as any;
        const own = { ...idesk, externalSource: 'EBBK' };
        const ipop = { ...idesk, externalSource: 'IPOP' };
        expect([isVisibleTo(ebbk, own), isVisibleTo(ebbk, idesk), isVisibleTo(ebbk, ipop)]).toEqual([true, false, false]);
        expect(isVisibleTo(IPOP_SCOPE, idesk)).toBe(true);
    });

    it('refuses a module the admin did not allow, before touching anything', async () => {
        const repo = { findOne: jest.fn(async () => null) };
        const service = new IpopTicketService(repo as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        const dto = { externalRef: 'BBK-1', module: 'it-support', priority: 'MEDIUM', title: 'Wifi mati', description: 'x', requester: { nik: '1' } } as any;

        await expect(service.create(dto, ebbk)).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { externalSource: 'EBBK', externalRef: 'BBK-1' } }));
    });
});
