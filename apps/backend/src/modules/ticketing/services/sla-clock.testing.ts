import { SlaClockService } from './sla-clock.service';
import { SlaConfig } from '../entities/sla-config.entity';
import { BusinessSchedule } from '../../sla-config/business-hours.calc';

/** Every minute counts, so business-hours math equals wall-clock math. */
export const ROUND_THE_CLOCK: BusinessSchedule = {
    workDays: [0, 1, 2, 3, 4, 5, 6],
    startTime: 0,
    endTime: 1440,
    timezone: 'Asia/Jakarta',
    holidays: [],
};

/** Real SlaClockService over in-memory configs, for unit tests. */
export function createTestSlaClock(
    configs: Partial<SlaConfig>[] = [],
    schedule: BusinessSchedule = ROUND_THE_CLOCK,
): SlaClockService {
    const repo = {
        findOne: jest.fn(async ({ where }: { where: { priority: string } }) =>
            (configs.find(c => c.priority === where.priority) as SlaConfig) ?? null),
        find: jest.fn(async () => configs as SlaConfig[]),
    };
    const businessHours = { getSchedule: jest.fn(async () => schedule) };
    return new SlaClockService(businessHours as any, repo as any);
}
