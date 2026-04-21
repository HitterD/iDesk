import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgingReminderCron } from './aging-reminder.cron';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';

describe('AgingReminderCron', () => {
    let cron: AgingReminderCron;
    const repo = { find: jest.fn() };
    const emitter = { emit: jest.fn() };

    beforeEach(async () => {
        const mod = await Test.createTestingModule({
            providers: [
                AgingReminderCron,
                { provide: getRepositoryToken(HardwareRequest), useValue: repo },
                { provide: EventEmitter2, useValue: emitter },
            ],
        }).compile();
        cron = mod.get(AgingReminderCron);
        jest.clearAllMocks();
    });

    it('emits AGING_FLAGGED for requests stuck > 7 days in non-terminal', async () => {
        const oldDate = new Date(Date.now() - 8 * 24 * 3600 * 1000);
        repo.find.mockResolvedValue([{ id: 'r1', status: 'UNDER_REVIEW', updatedAt: oldDate, requesterId: 'u1' }]);
        await cron.runDaily();
        expect(emitter.emit).toHaveBeenCalledWith('hardware-request.aging.flagged', expect.objectContaining({
            requestId: 'r1', daysInStatus: 8, status: 'UNDER_REVIEW',
        }));
    });

    it('ignores terminal statuses', async () => {
        repo.find.mockResolvedValue([]);
        await cron.runDaily();
        expect(emitter.emit).not.toHaveBeenCalled();
    });
});
