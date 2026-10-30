import { BusinessSchedule } from './business-hours.calc';
import { SlaConfig } from '../ticketing/entities/sla-config.entity';

/** What a client needs to run SLA countdowns locally: the schedule and each priority's counting mode. */
export interface SlaClockInfo {
    schedule: BusinessSchedule;
    businessHoursOnly: Record<string, boolean>;
}

export function buildSlaClockInfo(schedule: BusinessSchedule, configs: Pick<SlaConfig, 'priority' | 'businessHoursOnly'>[]): SlaClockInfo {
    return {
        schedule,
        businessHoursOnly: Object.fromEntries(configs.map(c => [c.priority, c.businessHoursOnly !== false])),
    };
}
