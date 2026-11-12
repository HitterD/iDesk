import { EFormExpirationReminderCron } from './eform-expiration-reminder.cron';
import { EFormRequest, EFormStatus, EFormType } from '../entities';
import { UserRole } from '../../users/enums/user-role.enum';

describe('EFormExpirationReminderCron', () => {
  let cron: EFormExpirationReminderCron;
  let mockEformRepo: any;
  let mockNotificationCenter: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockEformRepo = {
      find: jest.fn(),
    };
    mockNotificationCenter = {
      send: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      sendBulk: jest.fn().mockResolvedValue(undefined),
      findStaffAtSite: jest.fn().mockResolvedValue([{ id: 'ops-1' }]),
    };
    mockDataSource = { query: jest.fn().mockResolvedValue([{ job: 'eform-expiration-reminder' }]) };

    cron = new EFormExpirationReminderCron(
      mockEformRepo,
      mockNotificationCenter,
      mockDataSource,
    );
  });

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  it('returns 0 when no confirmed requests are found', async () => {
    mockEformRepo.find.mockResolvedValue([]);

    const count = await cron.scanAndNotify();

    expect(count).toBe(0);
    expect(mockNotificationCenter.send).not.toHaveBeenCalled();
    expect(mockNotificationCenter.sendBulk).not.toHaveBeenCalled();
  });

  it('skips requests without sampaiTanggal (permanent access)', async () => {
    mockEformRepo.find.mockResolvedValue([
      {
        id: 'req-perm-1',
        formType: EFormType.WEBSITE,
        status: EFormStatus.CONFIRMED,
        requesterId: 'user-1',
        requesterName: 'Bagas Pratama',
        formData: {
          dariTanggal: '2026-01-01',
          sampaiTanggal: '',
        },
      },
    ]);

    const count = await cron.scanAndNotify();

    expect(count).toBe(0);
    expect(mockNotificationCenter.send).not.toHaveBeenCalled();
  });

  it('triggers H-7 reminder when expiration is exactly 7 days away', async () => {
    const now = new Date();
    const endH7 = new Date();
    endH7.setDate(now.getDate() + 7);

    mockEformRepo.find.mockResolvedValue([
      {
        id: 'req-vpn-7days',
        formType: EFormType.VPN,
        status: EFormStatus.CONFIRMED,
        requesterId: 'user-1',
        requesterName: 'Bagas Pratama',
        formData: {
          dariTanggal: '2026-01-01',
          sampaiTanggal: formatDate(endH7),
        },
      },
    ]);

    const count = await cron.scanAndNotify();

    expect(count).toBe(1);
    expect(mockNotificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: expect.stringContaining('7 Hari'),
        referenceId: 'req-vpn-7days',
      }),
    );
    // H-7 is the requester's alone; ICT hears on the last day only.
    expect(mockNotificationCenter.sendBulk).not.toHaveBeenCalled();
  });

  it('triggers H-3 reminder when expiration is 3 days away', async () => {
    const now = new Date();
    const endH3 = new Date();
    endH3.setDate(now.getDate() + 3);

    mockEformRepo.find.mockResolvedValue([
      {
        id: 'req-fd-3days',
        formType: EFormType.FLASHDISK,
        status: EFormStatus.CONFIRMED,
        requesterId: 'user-2',
        requesterName: 'User Two',
        formData: {
          dariTanggal: '2026-01-01',
          sampaiTanggal: formatDate(endH3),
        },
      },
    ]);

    const count = await cron.scanAndNotify();

    expect(count).toBe(1);
    expect(mockNotificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        title: expect.stringContaining('3 Hari'),
      }),
    );
  });

  it('triggers H-0 reminder when expiration is today', async () => {
    const now = new Date();

    mockEformRepo.find.mockResolvedValue([
      {
        id: 'req-net-today',
        formType: EFormType.NETWORK,
        status: EFormStatus.CONFIRMED,
        requesterId: 'user-3',
        requesterName: 'User Three',
        siteId: 'site-1',
        formData: {
          dariTanggal: '2026-01-01',
          sampaiTanggal: formatDate(now),
        },
      },
    ]);

    const count = await cron.scanAndNotify();

    expect(count).toBe(1);
    expect(mockNotificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-3',
        title: expect.stringContaining('Hari Ini'),
      }),
    );
    // ICT at the request's site (plus cross-site), never every ICT user; the requester is not asked twice.
    expect(mockNotificationCenter.findStaffAtSite).toHaveBeenCalledWith([UserRole.AGENT_OPERATIONAL_SUPPORT], 'site-1', ['user-3']);
    expect(mockNotificationCenter.sendBulk).toHaveBeenCalledWith(['ops-1'], expect.objectContaining({ link: '/eform-access/req-net-today' }));
  });

  it('runs once per day across replicas', async () => {
    mockEformRepo.find.mockResolvedValue([]);
    mockDataSource.query.mockResolvedValueOnce([]); // another instance already claimed today

    await cron.runDaily();

    expect(mockEformRepo.find).not.toHaveBeenCalled();
  });
});
