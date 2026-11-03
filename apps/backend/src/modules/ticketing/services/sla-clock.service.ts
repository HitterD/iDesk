import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { BusinessHoursService } from '../../sla-config/business-hours.service';
import {
    addBusinessMinutes,
    businessMinutesBetween,
    BusinessSchedule,
    endOfNextBusinessDay,
} from '../../sla-config/business-hours.calc';
import { UserRole } from '../../users/enums/user-role.enum';

const MS_PER_MINUTE = 60_000;

/** Roles whose first reply counts as the first response. */
export const SLA_RESPONDER_ROLES: readonly string[] = [
    UserRole.ADMIN,
    UserRole.AGENT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_WEB_DEV,
    UserRole.AGENT_MOBILE_DEV,
];

/** Everything needed to project SLA targets synchronously (list endpoints). */
export interface SlaSnapshot {
    schedule: BusinessSchedule;
    configs: Map<string, SlaConfig>;
}

/** Adds SLA minutes either in business hours or around the clock. */
export function addSlaMinutes(start: Date, minutes: number, businessHoursOnly: boolean, schedule: BusinessSchedule): Date {
    return businessHoursOnly
        ? addBusinessMinutes(start, minutes, schedule)
        : new Date(start.getTime() + Math.max(0, minutes) * MS_PER_MINUTE);
}

/** SLA minutes between two instants, counted the same way as {@link addSlaMinutes}. */
export function slaMinutesBetween(start: Date, end: Date, businessHoursOnly: boolean, schedule: BusinessSchedule): number {
    return businessHoursOnly
        ? businessMinutesBetween(start, end, schedule)
        : Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE));
}

/** Configs without the flag (older rows, test doubles) count in business hours. */
export function isBusinessHoursOnly(config: Pick<SlaConfig, 'businessHoursOnly'> | null | undefined): boolean {
    return config?.businessHoursOnly !== false;
}

/**
 * Single owner of SLA clock arithmetic. Every path that sets or moves a ticket's
 * SLA targets goes through here so they all respect business hours, holidays and
 * the per-priority "business hours only" switch.
 *
 * A paused clock (waiting vendor, resolved awaiting confirmation) stores the
 * minutes left in `slaRemainingMinutes` / `firstResponseRemainingMinutes`;
 * resuming re-projects the target from that remainder.
 */
@Injectable()
export class SlaClockService {
    constructor(
        private readonly businessHours: BusinessHoursService,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
    ) { }

    getSchedule(): Promise<BusinessSchedule> {
        return this.businessHours.getSchedule();
    }

    findConfig(priority: string | null | undefined): Promise<SlaConfig | null> {
        if (!priority) return Promise.resolve(null);
        return this.slaConfigRepo.findOne({ where: { priority } });
    }

    async snapshot(): Promise<SlaSnapshot> {
        const [schedule, configs] = await Promise.all([this.getSchedule(), this.slaConfigRepo.find()]);
        return { schedule, configs: new Map(configs.map(c => [c.priority, c])) };
    }

    /** Target `minutes` after `start` using the priority's counting mode. */
    async targetFor(priority: string | null | undefined, start: Date, minutes: number): Promise<Date> {
        const [config, schedule] = await Promise.all([this.findConfig(priority), this.getSchedule()]);
        return addSlaMinutes(start, minutes, isBusinessHoursOnly(config), schedule);
    }

    /** SLA minutes between two instants using the priority's counting mode. */
    async minutesBetween(priority: string | null | undefined, start: Date, end: Date): Promise<number> {
        const [config, schedule] = await Promise.all([this.findConfig(priority), this.getSchedule()]);
        return slaMinutesBetween(start, end, isBusinessHoursOnly(config), schedule);
    }

    /** Hardware installation: due at closing time of the first working day after the schedule. */
    async hardwareTarget(scheduledDate: Date): Promise<Date> {
        return endOfNextBusinessDay(scheduledDate, await this.getSchedule());
    }

    /** First-response target for a new ticket; null when the priority has no config. */
    async firstResponseTarget(priority: string, now: Date = new Date()): Promise<Date | null> {
        const config = await this.findConfig(priority);
        if (!config) return null;
        return addSlaMinutes(now, config.responseTimeMinutes, isBusinessHoursOnly(config), await this.getSchedule());
    }

    /**
     * Starts the resolution clock. Returns the config used, or null when the
     * priority has none (slaStartedAt is still stamped).
     */
    async startResolution(ticket: Ticket, now: Date = new Date()): Promise<SlaConfig | null> {
        ticket.slaStartedAt = now;
        ticket.slaRemainingMinutes = null;
        const config = await this.findConfig(ticket.priority);
        if (!config) return null;
        ticket.slaTarget = addSlaMinutes(now, config.resolutionTimeMinutes, isBusinessHoursOnly(config), await this.getSchedule());
        ticket.originalSlaTarget = new Date(ticket.slaTarget);
        return config;
    }

    /**
     * Starts the clock of a ticket that never got one (it skipped IN_PROGRESS, e.g. TODO -> WAITING_VENDOR).
     * Counts from creation, which is the target the ticket page already projects; a paused ticket keeps
     * what is left as a hold. Returns false when the clock already runs or the priority has no config.
     */
    async adoptUnstarted(ticket: Ticket, now: Date = new Date(), opts: { paused?: boolean } = {}): Promise<boolean> {
        if (ticket.slaStartedAt) return false;
        const createdAt = new Date(ticket.createdAt);
        const config = await this.startResolution(ticket, createdAt);
        if (!config) {
            ticket.slaStartedAt = null;
            return false;
        }
        if (opts.paused) await this.hold(ticket, now);
        return true;
    }

    /** Freezes the running clocks, keeping the minutes left. Idempotent. */
    async hold(ticket: Ticket, now: Date = new Date()): Promise<void> {
        const needsResolution = ticket.slaTarget && ticket.slaRemainingMinutes == null;
        const needsResponse = ticket.firstResponseTarget && !ticket.firstResponseAt && ticket.firstResponseRemainingMinutes == null;
        if (!needsResolution && !needsResponse) return;

        const [config, schedule] = await Promise.all([this.findConfig(ticket.priority), this.getSchedule()]);
        const businessOnly = isBusinessHoursOnly(config);
        if (needsResolution) {
            ticket.slaRemainingMinutes = slaMinutesBetween(now, new Date(ticket.slaTarget!), businessOnly, schedule);
        }
        if (needsResponse) {
            ticket.firstResponseRemainingMinutes = slaMinutesBetween(now, new Date(ticket.firstResponseTarget!), businessOnly, schedule);
        }
    }

    /** Restarts held clocks from their remaining minutes. Returns true when a target moved. */
    async release(ticket: Ticket, now: Date = new Date()): Promise<boolean> {
        if (ticket.slaRemainingMinutes == null && ticket.firstResponseRemainingMinutes == null) return false;

        const [config, schedule] = await Promise.all([this.findConfig(ticket.priority), this.getSchedule()]);
        const businessOnly = isBusinessHoursOnly(config);
        if (ticket.slaRemainingMinutes != null) {
            ticket.slaTarget = addSlaMinutes(now, ticket.slaRemainingMinutes, businessOnly, schedule);
            if (ticket.slaTarget.getTime() > now.getTime()) ticket.isOverdue = false;
            ticket.slaRemainingMinutes = null;
        }
        if (ticket.firstResponseRemainingMinutes != null) {
            if (!ticket.firstResponseAt) {
                ticket.firstResponseTarget = addSlaMinutes(now, ticket.firstResponseRemainingMinutes, businessOnly, schedule);
            }
            ticket.firstResponseRemainingMinutes = null;
        }
        return true;
    }

    /**
     * Re-targets the resolution clock for a new priority, keeping the minutes
     * already used. Works for running and held clocks. Returns the new config,
     * or null when the clock has not started or the priority has no config.
     */
    async changePriority(ticket: Ticket, newPriority: string, now: Date = new Date()): Promise<SlaConfig | null> {
        if (!ticket.slaStartedAt) return null;
        const [oldConfig, newConfig, schedule] = await Promise.all([
            this.findConfig(ticket.priority),
            this.findConfig(newPriority),
            this.getSchedule(),
        ]);
        if (!newConfig) return null;

        const newBusinessOnly = isBusinessHoursOnly(newConfig);
        const held = ticket.slaRemainingMinutes != null;
        const remaining = held
            ? ticket.slaRemainingMinutes!
            : ticket.slaTarget
                ? slaMinutesBetween(now, new Date(ticket.slaTarget), isBusinessHoursOnly(oldConfig), schedule)
                : null;

        const nextRemaining = remaining == null || !oldConfig
            ? Math.max(0, newConfig.resolutionTimeMinutes - slaMinutesBetween(new Date(ticket.slaStartedAt), now, newBusinessOnly, schedule))
            : Math.max(0, remaining + newConfig.resolutionTimeMinutes - oldConfig.resolutionTimeMinutes);

        if (held) {
            ticket.slaRemainingMinutes = nextRemaining;
        } else {
            ticket.slaTarget = addSlaMinutes(now, nextRemaining, newBusinessOnly, schedule);
            if (ticket.slaTarget.getTime() > now.getTime()) ticket.isOverdue = false;
        }
        return newConfig;
    }
}
