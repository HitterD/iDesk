import { NotificationCenterService } from './notification-center.service';
import { UserRole } from '../users/enums/user-role.enum';

describe('NotificationCenterService site isolation (no global fanout)', () => {
  let service: NotificationCenterService;
  let userRepo: any;
  let snoozeRepo: any;
  let preferenceRepo: any;
  let logRepo: any;
  let notificationRepo: any;
  let entityManager: any;
  let cacheService: any;
  let emailChannel: any;
  let inAppChannel: any;
  let pushChannel: any;
  let eventsGateway: any;

  beforeEach(() => {
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'u', email: 'u@x.com' }),
    };
    snoozeRepo = { find: jest.fn().mockResolvedValue([]) };
    preferenceRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x: any) => x),
      update: jest.fn(),
    };
    logRepo = { create: jest.fn((x) => x), save: jest.fn() };
    notificationRepo = { create: jest.fn((x) => x), save: jest.fn(async (x: any) => x) };
    entityManager = { query: jest.fn().mockResolvedValue([]) };
    cacheService = {
      getOrSet: jest.fn(async (_k: string, fn: () => Promise<any>) => fn()),
    };
    emailChannel = { send: jest.fn().mockResolvedValue({ success: true }) };
    inAppChannel = { send: jest.fn().mockResolvedValue({ success: true }) };
    pushChannel = { send: jest.fn().mockResolvedValue({ success: true }) };
    eventsGateway = { server: { to: jest.fn().mockReturnThis(), emit: jest.fn() } };

    // Minimal constructor wiring — only the deps we touch in the tested paths
    service = new NotificationCenterService(
      snoozeRepo as any,
      eventsGateway as any,
      notificationRepo as any,
      preferenceRepo as any,
      logRepo as any,
      userRepo as any,
      emailChannel as any,
      inAppChannel as any,
      pushChannel as any,
      entityManager as any,
      cacheService as any,
    );

    // Channels are registered in onModuleInit — call it
    (service as any).onModuleInit?.();
  });

  describe('findUsersWithPageAccess', () => {
    it('keeps active users whose preset, or role default, opens the page', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'agent', role: UserRole.AGENT, appliedPresetId: null },
        { id: 'dev', role: UserRole.AGENT_ORACLE, appliedPresetId: null },
        { id: 'preset-off', role: UserRole.AGENT, appliedPresetId: 'p-off' },
        { id: 'user-preset-on', role: UserRole.USER, appliedPresetId: 'p-on' },
      ]);
      entityManager.getRepository = jest.fn(() => ({
        find: jest.fn().mockResolvedValue([{ id: 'p-off', pageAccess: { renewal: false } }, { id: 'p-on', pageAccess: { renewal: true } }]),
      }));

      const users = await service.findUsersWithPageAccess('renewal');

      expect(users.map(u => u.id)).toEqual(['agent', 'user-preset-on']);
      expect(userRepo.find.mock.calls[0][0].where).toEqual(expect.objectContaining({ isActive: true }));
    });
  });

  describe('sendToRoleAtSite', () => {
    it('without siteId returns {sent:0} and does not call global sendToRole (no fanout)', async () => {
      const sendToRoleSpy = jest.spyOn(service as any, 'sendToRole');

      const result = await service.sendToRoleAtSite('ADMIN', null, { type: 'TEST' as any, title: 't', message: 'm' });

      expect(result).toEqual({ sent: 0 });
      expect(sendToRoleSpy).not.toHaveBeenCalled();
      // Also ensure we did not query users globally
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('with siteId queries only users for that site and never falls back', async () => {
      userRepo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

      const result = await service.sendToRoleAtSite('ADMIN', 'site-spj', { type: 'TEST' as any, title: 't', message: 'm' });

      expect(result.sent).toBeGreaterThan(0);
      // Active users at that site, plus active cross-site staff (no site) - never other sites.
      const where = userRepo.find.mock.calls[0][0].where;
      expect(where).toHaveLength(2);
      expect(where[0]).toEqual(expect.objectContaining({ siteId: 'site-spj', isActive: true }));
      expect(where[1]).toEqual(expect.objectContaining({ isActive: true }));
      expect(where[1].siteId).toEqual(expect.objectContaining({ _type: 'isNull' }));
    });

    it('with siteId and zero matches does not fallback to global sendToRole', async () => {
      userRepo.find.mockResolvedValue([]); // no users at site
      const sendToRoleSpy = jest.spyOn(service as any, 'sendToRole');

      const result = await service.sendToRoleAtSite('ADMIN', 'site-smg', { type: 'TEST' as any, title: 't', message: 'm' });

      expect(result).toEqual({ sent: 0 });
      expect(sendToRoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('getActionItems / fetchActionItemData scopes hardware and eform by site when provided', () => {
    it('passes siteId into hardware_requests and eform_requests queries for non-cross-site role', async () => {
      // getActionItems calls fetchActionItemData via cache getOrSet
      // We just need to ensure the query strings contain the site filter and params include siteId.

      await service.getActionItems('u1', 'MANAGER', 'site-spj');

      // Find calls that target hardware_requests and eform_requests
      const hwCall = (entityManager.query as jest.Mock).mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('hardware_requests'),
      );
      const eformCall = (entityManager.query as jest.Mock).mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('eform_requests'),
      );

      expect(hwCall).toBeTruthy();
      expect(eformCall).toBeTruthy();

      // The query should include the site filter fragment we added
      expect(hwCall[0]).toMatch(/siteId/);
      // params for hardware when site provided: [siteId]
      expect(hwCall[1]).toEqual(['site-spj']);

      // For eform: first param is userId, second (when site) is siteId
      expect(eformCall[0]).toMatch(/siteId/);
      expect(eformCall[1]).toEqual(['u1', 'site-spj']);
    });

    it('omits site filter for cross-site role when no siteId provided (explicit all-sites)', async () => {
      await service.getActionItems('u1', 'ADMIN', null);

      const hwCall = (entityManager.query as jest.Mock).mock.calls.find((c: any[]) =>
        typeof c[0] === 'string' && c[0].includes('hardware_requests'),
      );

      // When no siteId, the added fragment should not be present for hardware
      expect(hwCall[0]).not.toMatch(/siteId/);
      // And params should be empty for the site part
      expect(hwCall[1]).toEqual([]);
    });
  });
});
