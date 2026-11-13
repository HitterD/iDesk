import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { EFormRequestService } from './eform-request.service';
import { UserRole } from '../users/enums/user-role.enum';
import { EFormRequest, EFormStatus, EFormType } from './entities/eform-request.entity';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

// Declared here rather than imported from eform-roles.constants on purpose:
// these tests pin the intended role list, so a wrong edit to the constant
// fails here instead of silently agreeing with itself.
const ICT_ROLES = [UserRole.ADMIN, UserRole.AGENT_ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT];
const NON_ICT_ROLES = [UserRole.USER, UserRole.AGENT, UserRole.AGENT_ORACLE];

const MANAGER_TYPES = [
  EFormType.VPN,
  EFormType.WEBSITE,
  EFormType.NETWORK,
  EFormType.FLASHDISK,
  EFormType.EMAIL,
];

function makeEform(overrides: Partial<EFormRequest> = {}): EFormRequest {
  return {
    id: 'eform-1',
    formType: EFormType.SYNOLOGY_NAS,
    status: EFormStatus.PENDING_ICT,
    requesterId: 'u-requester',
    requesterName: 'Requester',
    siteId: SITE_SPJ,
    currentApproverId: null,
    formData: {},
    termsAccepted: true,
    submittedAt: new Date(),
    ...overrides,
  } as EFormRequest;
}

describe('EFormRequestService - Synology direct-to-IT flow', () => {
  let service: EFormRequestService;
  let eformRepo: any;
  let approvalRepo: any;
  let signatureRepo: any;
  let eventEmitter: any;
  let userRepo: any;

  beforeEach(() => {
    eformRepo = {
      findOne: jest.fn(),
      create: jest.fn((v: any) => v),
      save: jest.fn(async (v: any) => ({ id: 'eform-1', ...v })),
    };
    // createRequest numbers the form inside a transaction; the manager hands the save back to the repo mock.
    eformRepo.manager = {
      transaction: jest.fn(async (work: any) => work({
        query: jest.fn(async () => [{ maxSeq: null }]),
        save: (_entity: unknown, value: any) => eformRepo.save(value),
      })),
    };
    approvalRepo = { save: jest.fn() };
    signatureRepo = { save: jest.fn() };
    eventEmitter = { emit: jest.fn() };
    userRepo = { findOne: jest.fn(async () => ({ id: 'u-requester', siteId: SITE_SPJ })) };

    // Constructor order from eform-request.service.ts:
    // audit, eformRequestRepo, eformApprovalRepo, eformSignatureRepo,
    // eformCredentialRepo, credentialService, pdfService, settingsService,
    // eventEmitter, userRepo
    service = new EFormRequestService(
      { logAsync: jest.fn() } as any,
      eformRepo as any,
      approvalRepo as any,
      signatureRepo as any,
      {} as any,
      { encrypt: jest.fn(), decrypt: jest.fn() } as any,
      { generatePdf: jest.fn() } as any,
      { getSetting: jest.fn(), setSetting: jest.fn() } as any,
      eventEmitter as any,
      userRepo as any,
        { handlingSiteId: jest.fn(async (siteId: string) => siteId === 'site-skd' ? SITE_SPJ : siteId) } as any,
    );
  });

  const baseDto = {
    requesterName: 'Requester',
    requesterDepartment: 'ICT',
    formData: { alasan: 'butuh akses folder' },
    termsAccepted: true,
    signatureData: 'data:image/png;base64,AAA',
  };

  const createSynology = () =>
    service.createRequest('u-requester', 'Requester', {
      ...baseDto,
      formType: EFormType.SYNOLOGY_NAS,
    } as any);

  describe('createRequest routing', () => {
    it('routes an SKD requester to SPJ while preserving requester identity', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u-requester', siteId: 'site-skd' });
      await createSynology();
      expect(eformRepo.save).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 'u-requester', siteId: SITE_SPJ }));
    });
    it('sends Synology straight to IT with no approver assigned', async () => {
      await createSynology();

      const saved = eformRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(EFormStatus.PENDING_ICT);
      expect(saved.currentApproverId).toBeNull();
    });

    it('creates no manager approval row for Synology', async () => {
      await createSynology();
      expect(approvalRepo.save).not.toHaveBeenCalled();
    });

    it('notifies IT directly for Synology instead of a manager', async () => {
      await createSynology();

      const events = eventEmitter.emit.mock.calls.map((c: any[]) => c[0]);
      expect(events).toContain('eform.direct-to-ict');
      expect(events).not.toContain('eform.submitted');
    });

    it('still records the requester signature for Synology', async () => {
      await createSynology();

      expect(signatureRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ signerRole: 'REQUESTER' }),
      );
    });

    it('accepts Synology without a managerId', async () => {
      await expect(createSynology()).resolves.toBeDefined();
    });

    it.each(MANAGER_TYPES)('still routes %s through the manager', async (formType) => {
      await service.createRequest('u-requester', 'Requester', {
        ...baseDto,
        formType,
        managerId: 'u-manager',
      } as any);

      const saved = eformRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(EFormStatus.PENDING_MANAGER);
      expect(saved.currentApproverId).toBe('u-manager');
      expect(approvalRepo.save).toHaveBeenCalled();
    });

    it.each([
      [EFormType.VPN, true],
      [EFormType.WEBSITE, false],
      [EFormType.EMAIL, false],
    ])('turns the GM step on by default for %s: %s', async (formType, requiresGm) => {
      await service.createRequest('u-requester', 'Requester', { ...baseDto, formType, managerId: 'u-manager' } as any);
      expect(eformRepo.save.mock.calls[0][0]).toMatchObject({ requiresGm, gmApproverId: null });
    });

    it('turns the GM step on for any type when the requester picks a GM', async () => {
      userRepo.exists = jest.fn(async () => true);
      await service.createRequest('u-requester', 'Requester', { ...baseDto, formType: EFormType.WEBSITE, managerId: 'u-manager', gmApproverId: 'u-gm' } as any);
      expect(eformRepo.save.mock.calls[0][0]).toMatchObject({ requiresGm: true, gmApproverId: 'u-gm' });
    });

    it('refuses a GM who is not an active user', async () => {
      userRepo.exists = jest.fn(async () => false);
      await expect(service.createRequest('u-requester', 'Requester', { ...baseDto, formType: EFormType.VPN, managerId: 'u-manager', gmApproverId: 'u-gone' } as any))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('ignores a GM on Synology, which has no approval steps', async () => {
      await service.createRequest('u-requester', 'Requester', { ...baseDto, formType: EFormType.SYNOLOGY_NAS, gmApproverId: 'u-gm' } as any);
      expect(eformRepo.save.mock.calls[0][0]).toMatchObject({ requiresGm: false, gmApproverId: null });
    });

    it.each(MANAGER_TYPES)('rejects %s submitted without a manager', async (formType) => {
      await expect(
        service.createRequest('u-requester', 'Requester', { ...baseDto, formType } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('fulfillRequest', () => {
    const notesDto = { notes: 'Folder Finance/Shared ditambahkan ke akun bagas.p' };

    const fulfill = (role: UserRole, siteId: string | null, dto: any = notesDto) =>
      service.fulfillRequest({ role, siteId }, 'eform-1', 'u-ict', role, dto);

    it.each(ICT_ROLES)('lets %s fulfil a request on their own site', async (role) => {
      eformRepo.findOne.mockResolvedValue(makeEform());

      const result = await fulfill(role, SITE_SPJ);

      expect(result.status).toBe(EFormStatus.CONFIRMED);
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it.each(NON_ICT_ROLES)('blocks %s from fulfilling', async (role) => {
      eformRepo.findOne.mockResolvedValue(makeEform());

      await expect(fulfill(role, SITE_SPJ)).rejects.toBeInstanceOf(ForbiddenException);
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('blocks site-locked IT from fulfilling another site, before any write', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));

      await expect(fulfill(UserRole.AGENT_ADMIN, SITE_SPJ)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('blocks site-locked IT with no site at all (fail-closed)', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform());

      await expect(fulfill(UserRole.AGENT_ADMIN, null)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('lets cross-site ADMIN fulfil another site', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));

      const result = await fulfill(UserRole.ADMIN, null);
      expect(result.status).toBe(EFormStatus.CONFIRMED);
    });

    it.each([
      EFormStatus.DRAFT,
      EFormStatus.PENDING_MANAGER,
      EFormStatus.CONFIRMED,
      EFormStatus.REJECTED,
    ])('refuses to fulfil from %s', async (status) => {
      eformRepo.findOne.mockResolvedValue(makeEform({ status }));

      await expect(fulfill(UserRole.AGENT_ADMIN, SITE_SPJ)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('records the notes and marks the request credential-free', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ formData: { alasan: 'butuh akses' } }));

      const result = await fulfill(UserRole.AGENT_ADMIN, SITE_SPJ, {
        notes: 'Folder ditambahkan',
        accountName: 'bagas.p',
      });

      expect(result.formData).toMatchObject({
        alasan: 'butuh akses',
        fulfillmentNotes: 'Folder ditambahkan',
        fulfilledAccountName: 'bagas.p',
        fulfilledWithoutCredentials: true,
      });
    });

    it('omits the account name when IT did not supply one', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform());

      const result = await fulfill(UserRole.AGENT_ADMIN, SITE_SPJ);

      expect(result.formData).not.toHaveProperty('fulfilledAccountName');
      expect(result.formData.fulfilledWithoutCredentials).toBe(true);
    });

    it('emits eform.fulfilled so the requester is told', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform());

      await fulfill(UserRole.AGENT_ADMIN, SITE_SPJ);

      expect(eventEmitter.emit).toHaveBeenCalledWith('eform.fulfilled', expect.anything());
    });
  });

  describe('rejectRequest authorization', () => {
    const reject = (role: UserRole, siteId: string | null, userId = 'u-ict') =>
      service.rejectRequest({ role, siteId }, 'eform-1', userId, role, 'Folder tidak sesuai');

    it.each(ICT_ROLES)('lets %s reject a request sitting with IT', async (role) => {
      eformRepo.findOne.mockResolvedValue(makeEform({ currentApproverId: null }));

      const result = await reject(role, SITE_SPJ);

      expect(result.status).toBe(EFormStatus.REJECTED);
      expect(result.rejectionReason).toBe('Folder tidak sesuai');
    });

    it('still lets the assigned approver reject', async () => {
      eformRepo.findOne.mockResolvedValue(
        makeEform({ status: EFormStatus.PENDING_MANAGER, currentApproverId: 'u-manager' }),
      );

      const result = await reject(UserRole.USER, SITE_SPJ, 'u-manager');
      expect(result.status).toBe(EFormStatus.REJECTED);
    });

    it.each(NON_ICT_ROLES)('blocks unrelated %s from rejecting', async (role) => {
      eformRepo.findOne.mockResolvedValue(makeEform({ currentApproverId: 'u-manager' }));

      await expect(reject(role, SITE_SPJ, 'u-stranger')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it('blocks site-locked IT from rejecting another site, before any write', async () => {
      eformRepo.findOne.mockResolvedValue(makeEform({ siteId: SITE_SMG }));

      await expect(reject(UserRole.AGENT_ADMIN, SITE_SPJ)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(eformRepo.save).not.toHaveBeenCalled();
    });

    it.each([EFormStatus.CONFIRMED, EFormStatus.REJECTED])(
      'refuses to reject a request already %s',
      async (status) => {
        eformRepo.findOne.mockResolvedValue(makeEform({ status }));

        await expect(reject(UserRole.AGENT_ADMIN, SITE_SPJ)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(eformRepo.save).not.toHaveBeenCalled();
      },
    );
  });
});
