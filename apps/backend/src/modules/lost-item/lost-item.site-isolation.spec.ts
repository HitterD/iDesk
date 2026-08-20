import { ForbiddenException } from '@nestjs/common';
import { LostItemService } from './lost-item.service';
import { UserRole } from '../users/enums/user-role.enum';
import { LostItemReport, LostItemStatus } from './entities/lost-item-report.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

const SITE_LOCKED_ROLES = [
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ADMIN,
  UserRole.USER,
];

const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

function makeReport(overrides: Partial<LostItemReport> = {}): LostItemReport {
  const ticket: Partial<Ticket> = {
    id: 't1',
    siteId: SITE_SMG,
  };
  return {
    id: 'li-1',
    ticketId: 't1',
    ticket: ticket as Ticket,
    itemName: 'Laptop',
    itemType: 'Laptop',
    status: LostItemStatus.REPORTED,
    ...overrides,
  } as LostItemReport;
}

describe('LostItemService site isolation', () => {
  let service: LostItemService;
  let lostItemRepo: any;
  let ticketRepo: any;
  let statusLogRepo: any;

  beforeEach(() => {
    lostItemRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x: any) => x),
    };
    ticketRepo = { update: jest.fn() };
    statusLogRepo = { create: jest.fn((x) => x), save: jest.fn(), find: jest.fn().mockResolvedValue([]) };

    service = new LostItemService(
      { logAsync: jest.fn() } as any, // audit
      {} as any,                      // configService (for QR, not used in isolation tests)
      lostItemRepo as any,
      statusLogRepo as any,
      ticketRepo as any,
      {} as any,                      // userRepo
      { emit: jest.fn() } as any,
      { transaction: async (fn: any) => fn({ getRepository: (e: any) => (e === LostItemReport ? lostItemRepo : e === require('../ticketing/entities/ticket.entity').Ticket ? ticketRepo : statusLogRepo) }) } as any,
    );
  });

  function setupQb(terminalResult: any) {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(terminalResult),
    };
    lostItemRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  describe('findAll', () => {
    it.each(SITE_LOCKED_ROLES)('pins %s to their own site via ticket join', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: SITE_SPJ });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ticket.siteId = :userSiteId',
        { userSiteId: SITE_SPJ },
      );
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s with no site (fail-closed)', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      expect(qb.andWhere).not.toHaveBeenCalledWith('1 = 0');
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('userSiteId'),
        expect.anything(),
      );
    });
  });

  describe('findOne / findByTicketId', () => {
    it('site-locked cannot read report from other site (403)', async () => {
      lostItemRepo.findOne.mockResolvedValue(makeReport());
      await expect(
        service.findOne('li-1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('findByTicketId enforces site', async () => {
      lostItemRepo.findOne.mockResolvedValue(makeReport());
      await expect(
        service.findByTicketId('t1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cross-site can read other site', async () => {
      lostItemRepo.findOne.mockResolvedValue(makeReport());
      const result = await service.findOne('li-1', { role: UserRole.ADMIN, siteId: null });
      expect(result.id).toBe('li-1');
    });
  });

  describe('updateStatus', () => {
    it('site-locked cannot update status on other site report', async () => {
      lostItemRepo.findOne.mockResolvedValue(makeReport()); // SMG
      await expect(
        service.updateStatus('li-1', { status: LostItemStatus.CLOSED_LOST } as any, 'u1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('QR token route remains public (capability token)', () => {
    it('findByQrToken does not require actor and is not scoped by site', async () => {
      // This method is intentionally capability-based (like tv-board tvToken).
      // We just verify the service method exists and can be called without actor.
      lostItemRepo.findOne.mockResolvedValue({
        id: 'li-1',
        itemName: 'Laptop',
        itemType: 'Laptop',
        circumstances: 'left in meeting room',
        lastSeenLocation: 'Floor 3',
        lastSeenDatetime: new Date(),
        photoUrls: [],
        status: LostItemStatus.REPORTED,
        ticket: { user: { fullName: 'Reporter', email: 'r@ex.com' } },
      });

      const result = await service.findByQrToken('some-token');
      expect(result.reportId).toBe('li-1');
      // No actor was passed; this proves the public path is untouched.
    });
  });
});
