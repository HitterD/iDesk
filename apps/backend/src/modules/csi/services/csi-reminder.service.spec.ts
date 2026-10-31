import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CsiReminderService, formatReminderDate } from './csi-reminder.service';

const ICT = ServiceScope.ICT;
const NOW = new Date('2026-10-30T03:00:00Z');

const basePeriod = (over: Record<string, unknown> = {}) => ({
    id: 'p1', scope: ICT, title: 'CSI ICT Oktober', startDate: '2026-10-01', endDate: '2026-10-31',
    respondentMode: CsiRespondentMode.LISTED, publishStatus: CsiPeriodPublishStatus.PUBLISHED, ...over,
});

describe('CsiReminderService', () => {
    let period: Record<string, unknown> | null;
    let raters: Array<{ id: string; userId: string }>;
    let paired: Set<string> | null;
    let answered: Array<{ respondentId: string }>;
    let recent: Array<{ userId: string; createdAt: Date }>;
    let notifications: { create: jest.Mock };
    let service: CsiReminderService;

    beforeEach(() => {
        period = basePeriod();
        raters = [{ id: 'pr1', userId: 'u1' }, { id: 'pr2', userId: 'u2' }, { id: 'pr3', userId: 'u3' }];
        paired = null;
        answered = [];
        recent = [];
        notifications = { create: jest.fn(async (data: any) => ({ id: `n-${data.userId}`, createdAt: new Date(NOW.getTime() + 1000) })) };
        const periods = { findOne: jest.fn(async () => period) };
        const periodRaters = { find: jest.fn(async () => raters) };
        const responses = { find: jest.fn(async () => answered) };
        const notificationRepo = { find: jest.fn(async () => recent) };
        const assignments = { ratersWithPairs: jest.fn(async () => paired) };
        service = new CsiReminderService(periods as any, periodRaters as any, responses as any, notificationRepo as any, notifications as any, assignments as any);
    });

    it('sends to listed raters who have not answered', async () => {
        await expect(service.send(ICT, 'p1', undefined, NOW)).resolves.toEqual({ sent: 3, skipped: 0 });
        expect(notifications.create).toHaveBeenCalledTimes(3);
        expect(notifications.create).toHaveBeenCalledWith({
            userId: 'u1', type: NotificationType.CSI_REMINDER, title: 'Pengingat survei CSI',
            message: 'Mohon isi "CSI ICT Oktober" sebelum 31 Okt 2026.', referenceId: 'p1:u1', link: '/csi/p1',
        });
    });

    it('sends only to the given userIds and rejects users who are not raters of the period', async () => {
        await expect(service.send(ICT, 'p1', ['u2', 'u2'], NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
        await expect(service.send(ICT, 'p1', ['u9'], NOW)).rejects.toThrow(BadRequestException);
    });

    it('raters without pairs are excluded when the period is mapped', async () => {
        paired = new Set(['pr1', 'pr3']);
        await expect(service.send(ICT, 'p1', undefined, NOW)).resolves.toEqual({ sent: 2, skipped: 1 });
        expect(notifications.create).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
        await expect(service.send(ICT, 'p1', ['u2'], NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
    });

    it('no filtering when the period has no pairs', async () => {
        paired = null;
        await expect(service.send(ICT, 'p1', ['u2'], NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
    });

    it('skips raters who already answered', async () => {
        answered = [{ respondentId: 'u1' }];
        await expect(service.send(ICT, 'p1', ['u1', 'u2'], NOW)).resolves.toEqual({ sent: 1, skipped: 1 });
        expect(notifications.create).toHaveBeenCalledTimes(1);
        await expect(service.send(ICT, 'p1', undefined, NOW)).resolves.toEqual({ sent: 2, skipped: 1 });
    });

    it('counts deduplicated notifications as skipped', async () => {
        // u1 was reminded within 24h (pre-check); u2 races: create() hands back an older existing row.
        recent = [{ userId: 'u1', createdAt: new Date(NOW.getTime() - 3600_000) }];
        notifications.create.mockImplementation(async (data: any) => ({
            id: `n-${data.userId}`, createdAt: data.userId === 'u2' ? new Date(NOW.getTime() - 60_000) : new Date(NOW.getTime() + 1000),
        }));
        await expect(service.send(ICT, 'p1', undefined, NOW)).resolves.toEqual({ sent: 1, skipped: 2 });
        expect(notifications.create).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    });

    it('rejects reminders for a draft or ended period', async () => {
        period = basePeriod({ publishStatus: CsiPeriodPublishStatus.DRAFT });
        await expect(service.send(ICT, 'p1', undefined, NOW)).rejects.toThrow(BadRequestException);
        period = basePeriod({ endDate: '2026-10-29' });
        await expect(service.send(ICT, 'p1', undefined, NOW)).rejects.toThrow(BadRequestException);
        period = basePeriod({ startDate: '2026-11-01', endDate: '2026-11-30' });
        await expect(service.send(ICT, 'p1', undefined, NOW)).rejects.toThrow(BadRequestException);
        period = basePeriod({ respondentMode: CsiRespondentMode.OPEN });
        await expect(service.send(ICT, 'p1', undefined, NOW)).rejects.toThrow('Pengingat hanya untuk survei dengan penilai terpilih');
        period = basePeriod({ scope: ServiceScope.HC });
        await expect(service.send(ICT, 'p1', undefined, NOW)).rejects.toThrow(NotFoundException);
        expect(notifications.create).not.toHaveBeenCalled();
    });

    it('formats the end date with Indonesian short month names', () => {
        expect(formatReminderDate('2026-10-31')).toBe('31 Okt 2026');
        expect(formatReminderDate('2026-05-01')).toBe('1 Mei 2026');
        expect(formatReminderDate('2026-08-09')).toBe('9 Agu 2026');
    });
});
