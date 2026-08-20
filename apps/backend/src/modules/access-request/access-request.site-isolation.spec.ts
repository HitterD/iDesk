import { ForbiddenException } from '@nestjs/common';
import { AccessRequestService } from './access-request.service';
import { UserRole } from '../users/enums/user-role.enum';
import { AccessRequest, AccessRequestStatus } from './entities/access-request.entity';
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

function makeAccessRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  const ticket: Partial<Ticket> = {
    id: 't1',
    siteId: SITE_SMG,
    ticketNumber: 'AR-001',
  };
  return {
    id: 'ar-1',
    ticketId: 't1',
    ticket: ticket as Ticket,
    accessTypeId: 'at-1',
    purpose: 'test',
    status: AccessRequestStatus.FORM_PENDING,
    accessCredentials: 'encrypted:abc',
    ...overrides,
  } as AccessRequest;
}

describe('AccessRequestService site isolation (P0 credential protection)', () => {
  let service: AccessRequestService;
  let accessRequestRepo: any;
  let ticketRepo: any;
  let cipher: any;

  beforeEach(() => {
    accessRequestRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x: any) => x),
    };

    ticketRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    cipher = {
      decrypt: jest.fn((val: string) => 'decrypted-' + val),
      encrypt: jest.fn((val: string) => 'encrypted:' + val),
    };

    // Minimal constructor args
    service = new AccessRequestService(
      { logAsync: jest.fn() } as any,           // auditService
      accessRequestRepo as any,
      {} as any,                                 // accessTypeRepo
      ticketRepo as any,
      {} as any,                                 // userRepo
      { emit: jest.fn() } as any,                // eventEmitter
      cipher as any,
      { transaction: jest.fn() } as any,         // dataSource
    );
  });

  describe('findAll — list', () => {
    function setupQb(terminalResult: any) {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(terminalResult),
      };
      accessRequestRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it.each(SITE_LOCKED_ROLES)('pins %s to their own site via ticket join', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: SITE_SPJ });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'ticket.siteId = :userSiteId',
        { userSiteId: SITE_SPJ },
      );
    });

    it.each(SITE_LOCKED_ROLES)('matches nothing for %s when actor has no site (fail-closed)', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      expect(qb.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted (cross-site)', async (role) => {
      const qb = setupQb([]);
      await service.findAll({ role, siteId: null });

      // Should not pin or force 1=0
      expect(qb.andWhere).not.toHaveBeenCalledWith('1 = 0');
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('userSiteId'),
        expect.anything(),
      );
    });
  });

  describe('findOne and findByTicketId — detail + credential protection (P0)', () => {
    it('site-locked role cannot read access-request from another site (403 before decrypt)', async () => {
      accessRequestRepo.findOne.mockResolvedValue(
        makeAccessRequest({ ticket: { siteId: SITE_SMG } as any }),
      );

      await expect(
        service.findOne('ar-1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(cipher.decrypt).not.toHaveBeenCalled();
    });

    it('site-locked role on own site can read and decrypts', async () => {
      accessRequestRepo.findOne.mockResolvedValue(
        makeAccessRequest({ ticket: { siteId: SITE_SPJ } as any }),
      );

      const result = await service.findOne('ar-1', { role: UserRole.AGENT, siteId: SITE_SPJ });

      expect(result.accessCredentials).toBe('decrypted-encrypted:abc');
      expect(cipher.decrypt).toHaveBeenCalled();
    });

    it('cross-site role (ADMIN) can read other site and decrypts', async () => {
      accessRequestRepo.findOne.mockResolvedValue(
        makeAccessRequest({ ticket: { siteId: SITE_SMG } as any }),
      );

      const result = await service.findOne('ar-1', { role: UserRole.ADMIN, siteId: null });

      expect(result.accessCredentials).toBe('decrypted-encrypted:abc');
    });

    it('findByTicketId throws Forbidden for cross-site before decrypt', async () => {
      accessRequestRepo.findOne.mockResolvedValue(
        makeAccessRequest({ ticket: { siteId: SITE_SMG } as any, accessCredentials: 'enc' }),
      );

      await expect(
        service.findByTicketId('t1', { role: UserRole.AGENT, siteId: SITE_SPJ }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(cipher.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('actor with no siteId', () => {
    it('findOne for unscoped agent throws before any decrypt', async () => {
      accessRequestRepo.findOne.mockResolvedValue(
        makeAccessRequest({ ticket: { siteId: SITE_SMG } as any }),
      );

      await expect(
        service.findOne('ar-1', { role: UserRole.AGENT, siteId: null }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(cipher.decrypt).not.toHaveBeenCalled();
    });
  });
});
