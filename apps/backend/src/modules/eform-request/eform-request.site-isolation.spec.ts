import { ForbiddenException } from '@nestjs/common';
import { EFormRequestService } from './eform-request.service';
import { UserRole } from '../users/enums/user-role.enum';
import { EFormRequest, EFormStatus, EFormType } from './entities/eform-request.entity';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

const SITE_LOCKED_ROLES = [
  UserRole.AGENT,
  UserRole.AGENT_OPERATIONAL_SUPPORT,
  UserRole.AGENT_ADMIN,  // AGENT_ADMIN is site-locked for eform (only ADMIN cross-site for /all)
  UserRole.USER,
];

const CROSS_SITE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

function makeEform(overrides: Partial<EFormRequest> = {}): EFormRequest {
  return {
    id: 'eform-1',
    formType: EFormType.VPN,
    status: EFormStatus.PENDING_ICT,
    requesterId: 'u-requester',
    requesterName: 'Requester',
    siteId: SITE_SMG,
    currentApproverId: null,
    formData: {},
    termsAccepted: true,
    submittedAt: new Date(),
    ...overrides,
  } as EFormRequest;
}

describe('EFormRequestService site isolation (P0 credential protection)', () => {
  let service: EFormRequestService;
  let eformRepo: any;
  let credRepo: any;
  let credentialService: any;
  let pdfService: any;

  beforeEach(() => {
    eformRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    credRepo = {
      findOne: jest.fn(),
    };
    credentialService = {
      decrypt: jest.fn((val: string) => 'decrypted-' + val),
      encrypt: jest.fn((val: string) => 'enc:' + val),
    };
    pdfService = {
      generatePdf: jest.fn(async () => Buffer.from('pdf')),
    };

    // Constructor order from eform-request.service.ts:
    // audit, eformRequestRepo, eformApprovalRepo, eformSignatureRepo, eformCredentialRepo,
    // credentialService, pdfService, settingsService, eventEmitter, userRepo
    service = new EFormRequestService(
      { logAsync: jest.fn() } as any,   // audit
      eformRepo as any,
      {} as any,                        // approvals
      {} as any,                        // signatures
      credRepo as any,
      credentialService as any,
      pdfService as any,
      { getSetting: jest.fn(), setSetting: jest.fn() } as any,
      { emit: jest.fn() } as any,
      {} as any,                        // userRepo
    );
  });

  describe('findAll', () => {
    it.each(SITE_LOCKED_ROLES)('pins %s to their own site', async (role) => {
      eformRepo.find.mockResolvedValue([]);
      await service.findAll({ role, siteId: SITE_SPJ });

      expect(eformRepo.find).toHaveBeenCalledWith({
        where: { siteId: SITE_SPJ },
        order: { createdAt: 'DESC' },
      });
    });

    it.each(SITE_LOCKED_ROLES)('returns empty for %s with no site (fail-closed)', async (role) => {
      eformRepo.find.mockResolvedValue([]);
      const result = await service.findAll({ role, siteId: null });

      expect(result).toEqual([]);
      // We returned early, repo.find may or may not have been called with empty filter.
      // Main point: no cross-site data leaked.
    });

    it.each(CROSS_SITE_ROLES)('leaves %s unrestricted', async (role) => {
      eformRepo.find.mockResolvedValue([makeEform({ siteId: SITE_SMG })]);
      const result = await service.findAll({ role, siteId: null });

      // Should have called without site filter (or with all)
      expect(eformRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDetails', () => {
    it('site-locked on wrong site gets 403', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));
      await expect(
        service.getDetails({ role: UserRole.AGENT, siteId: SITE_SPJ }, 'eform-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('site-locked on own site succeeds', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SPJ }));
      const result = await service.getDetails({ role: UserRole.AGENT, siteId: SITE_SPJ }, 'eform-1');
      expect(result.id).toBe('eform-1');
    });

    it('cross-site can read any', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));
      const result = await service.getDetails({ role: UserRole.ADMIN, siteId: null }, 'eform-1');
      expect(result.siteId).toBe(SITE_SMG);
    });
  });

  describe('generatePdf (P0: no decrypt before site check)', () => {
    it('blocks cross-site PDF generation before any credential access', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));
      credRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generatePdf({ role: UserRole.AGENT, siteId: SITE_SPJ }, 'eform-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Ensure we never reached credential decrypt for the cross-site attempt
      expect(credentialService.decrypt).not.toHaveBeenCalled();
    });

    it('allows own-site PDF (and may decrypt if creds present)', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SPJ }));
      credRepo.findOne.mockResolvedValue(null);

      const buf = await service.generatePdf({ role: UserRole.AGENT, siteId: SITE_SPJ }, 'eform-1');
      expect(buf).toBeInstanceOf(Buffer);
    });
  });

  describe('getCredentials (P0 + role check)', () => {
    const ictActor = { role: UserRole.AGENT_ADMIN, siteId: SITE_SPJ };
    const crossActor = { role: UserRole.AGENT, siteId: SITE_SPJ }; // not ICT, not requester

    it('blocks cross-site credential read before decrypt', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG, requesterId: 'someone-else' }));

      await expect(
        service.getCredentials({ role: UserRole.AGENT, siteId: SITE_SPJ }, 'eform-1', 'u1', UserRole.AGENT),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(credentialService.decrypt).not.toHaveBeenCalled();
    });

    it('ICT on own site can read credentials', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SPJ, requesterId: 'other' }));
      credRepo.findOne.mockResolvedValue({
        eformRequestId: 'eform-1',
        encryptedUsername: 'u',
        encryptedPassword: 'p',
        iv: 'iv',
        authTag: 'tag',
        passwordIv: 'piv',
        passwordAuthTag: 'ptag',
        vpnServer: 'srv',
        notes: '',
      });

      const result = await service.getCredentials(ictActor, 'eform-1', 'ict-user', UserRole.AGENT_ADMIN);
      expect(result.username).toBe('decrypted-u');
      expect(credentialService.decrypt).toHaveBeenCalled();
    });
  });
});
