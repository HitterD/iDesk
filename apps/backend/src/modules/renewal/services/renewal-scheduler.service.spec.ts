import { RenewalSchedulerService } from './renewal-scheduler.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

describe('RenewalSchedulerService reminders', () => {
    let renewalService: any;
    let notificationService: any;
    let emailChannel: any;
    let notificationCenter: any;
    let dataSource: any;
    let service: RenewalSchedulerService;

    beforeEach(() => {
        renewalService = {
            findContractsNeedingReminder: jest.fn(async (days: number) => (days === 7 || days === 1 ? [{ id: `c-${days}`, poNumber: 'PO', endDate: '2026-12-01' }] : [])),
            markReminderSent: jest.fn(),
            updateAllStatuses: jest.fn().mockResolvedValue(0),
        };
        notificationService = { create: jest.fn().mockResolvedValue({}) };
        emailChannel = { send: jest.fn().mockResolvedValue({ success: true }) };
        notificationCenter = { findUsersWithPageAccess: jest.fn().mockResolvedValue([{ id: 'a1', email: 'a1@x.co' }]) };
        dataSource = { query: jest.fn().mockResolvedValue([{ job: 'renewal-reminder-check' }]) };
        service = new RenewalSchedulerService(renewalService, notificationService, emailChannel, notificationCenter, dataSource);
    });

    it('reaches only Renewal Hub users and blocks the screen on the last day only', async () => {
        await service.checkExpiringContracts();

        expect(notificationCenter.findUsersWithPageAccess).toHaveBeenCalledWith('renewal');
        const calls = notificationService.create.mock.calls.map((c: any[]) => c[0]);
        expect(calls.find((c: any) => c.type === NotificationType.RENEWAL_D7_WARNING).requiresAcknowledge).toBe(false);
        expect(calls.find((c: any) => c.type === NotificationType.RENEWAL_D1_WARNING).requiresAcknowledge).toBe(true);
        expect(calls.every((c: any) => c.link === '/renewal?tab=contracts')).toBe(true);
    });

    it('runs once per day across replicas', async () => {
        dataSource.query.mockResolvedValueOnce([]);

        await service.checkExpiringContracts();

        expect(renewalService.findContractsNeedingReminder).not.toHaveBeenCalled();
        expect(notificationService.create).not.toHaveBeenCalled();
    });
});
