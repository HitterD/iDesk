import { VpnSchedulerService } from './vpn-scheduler.service';
import { VpnStatusCreate } from './entities/vpn-access.entity';

describe('VpnSchedulerService reminders', () => {
    const today = new Date();
    const inDays = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);

    let vpnRepo: any;
    let notificationService: any;
    let notificationCenter: any;
    let dataSource: any;
    let service: VpnSchedulerService;

    beforeEach(() => {
        vpnRepo = { find: jest.fn(), save: jest.fn() };
        notificationService = { create: jest.fn().mockResolvedValue({}) };
        notificationCenter = { findUsersWithPageAccess: jest.fn().mockResolvedValue([{ id: 'ops-1' }]) };
        dataSource = { query: jest.fn().mockResolvedValue([{ job: 'vpn-reminder-check' }]) };
        service = new VpnSchedulerService(vpnRepo, notificationService, notificationCenter, dataSource);
    });

    it('notifies only people who work the Renewal Hub, with a link to the VPN tab', async () => {
        vpnRepo.find.mockResolvedValue([{ id: 'v1', namaUser: 'Budi', tanggalNonAktif: inDays(1), statusCreateVpn: VpnStatusCreate.SELESAI }]);

        await service.checkVpnExpirations();

        expect(notificationCenter.findUsersWithPageAccess).toHaveBeenCalledWith('renewal');
        expect(notificationService.create).toHaveBeenCalledTimes(1);
        expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'ops-1', referenceId: 'v1', link: '/renewal?tab=vpn', requiresAcknowledge: true,
        }));
    });

    it('does not notify again once the step is marked', async () => {
        vpnRepo.find.mockResolvedValue([{ id: 'v1', namaUser: 'Budi', tanggalNonAktif: inDays(1), statusUserH1: 'Notified', statusCreateVpn: VpnStatusCreate.SELESAI }]);

        await service.checkVpnExpirations();

        expect(notificationService.create).not.toHaveBeenCalled();
    });

    it('runs once per day across replicas', async () => {
        dataSource.query.mockResolvedValueOnce([]);

        await service.checkVpnExpirations();

        expect(vpnRepo.find).not.toHaveBeenCalled();
    });
});
