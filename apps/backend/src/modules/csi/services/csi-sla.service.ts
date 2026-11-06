import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { wibStartOfDate } from '../../../shared/core/utils/wib-date.util';
import { Ticket } from '../../ticketing/entities/ticket.entity';
import { CsiRespondentMode } from '../csi.constants';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiAssignmentService } from './csi-assignment.service';
import { pengisiPct, slaTarget } from './csi-score.util';

const WINDOW_MONTHS = 12;

export type CsiSlaReporter = { email: string; department: string | null; fullName: string };
export type CsiSla = {
    mode: CsiRespondentMode; basis: number; targetPct: number; target: number; responses: number;
    pengisiPct: number | null; reporters: CsiSlaReporter[];
};
type ReporterRow = CsiSlaReporter & { id: string };

/** [startDate - 12 months, startDate) as WIB instants. */
export function slaWindow(startDate: string): { from: Date; to: Date } {
    const earlier = new Date(`${startDate}T00:00:00Z`);
    earlier.setUTCMonth(earlier.getUTCMonth() - WINDOW_MONTHS);
    return { from: wibStartOfDate(earlier.toISOString().slice(0, 10)), to: wibStartOfDate(startDate) };
}

const compareReporters = (a: CsiSlaReporter, b: CsiSlaReporter) =>
    (a.department ?? '￿').localeCompare(b.department ?? '￿', 'id') || a.fullName.localeCompare(b.fullName, 'id');
const toReporter = ({ email, department, fullName }: ReporterRow): CsiSlaReporter => ({ email, department, fullName });

@Injectable()
export class CsiSlaService {
    constructor(
        @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        private readonly assignments: CsiAssignmentService,
    ) { }

    /** SLA basis, target and % Pengisi for a period over the given sites (`responses` = distinct responses). */
    async compute(period: Pick<CsiPeriod, 'id' | 'respondentMode' | 'startDate' | 'slaTargetPct'> & Partial<Pick<CsiPeriod, 'targetRespondents'>>, sites: Array<{ id: string }>, responses: number): Promise<CsiSla> {
        const siteIds = sites.map((site) => site.id);
        // HC "respondents pick" (open) with a target set by HC: the target number is the basis, no people list.
        if (period.respondentMode === CsiRespondentMode.OPEN && period.targetRespondents) {
            // The HC target covers the whole survey; one site of several gets its share (rounded up).
            const allSites = (period as { sites?: unknown[] }).sites?.length || siteIds.length || 1;
            const basis = siteIds.length >= allSites ? period.targetRespondents : Math.ceil((period.targetRespondents * siteIds.length) / allSites);
            const target = slaTarget(basis, period.slaTargetPct);
            return { mode: period.respondentMode, basis, targetPct: period.slaTargetPct, target, responses, pengisiPct: pengisiPct(basis, responses, target), reporters: [] };
        }
        const rows = !siteIds.length ? []
            : period.respondentMode === CsiRespondentMode.LISTED
                ? await this.listedReporters(period.id, siteIds)
                : await this.ticketReporters(period.startDate, siteIds);
        const reporters = [...new Map(rows.map((row) => [row.id, row])).values()].map(toReporter).sort(compareReporters);
        const basis = reporters.length;
        const target = slaTarget(basis, period.slaTargetPct);
        return {
            mode: period.respondentMode, basis, targetPct: period.slaTargetPct, target, responses,
            pengisiPct: pengisiPct(basis, responses, target), reporters,
        };
    }

    /** Distinct ticket creators in the sites during the 12 months before the survey (deactivated users still count). */
    private async ticketReporters(startDate: string, siteIds: string[]): Promise<ReporterRow[]> {
        const { from, to } = slaWindow(startDate);
        return this.tickets.createQueryBuilder('ticket')
            .innerJoin('ticket.user', 'user')
            .leftJoin('user.department', 'department')
            .select('user.id', 'id').addSelect('user.email', 'email')
            .addSelect('department.name', 'department').addSelect('user.fullName', 'fullName')
            .where('ticket.userId IS NOT NULL')
            .andWhere('ticket.siteId IN (:...siteIds)', { siteIds })
            .andWhere('ticket.createdAt >= :from AND ticket.createdAt < :to', { from, to })
            .groupBy('user.id').addGroupBy('user.email').addGroupBy('department.name').addGroupBy('user.fullName')
            .getRawMany<ReporterRow>();
    }

    /** Active listed raters of the sites; in a mapped period only raters with at least one pair (the others never see it). */
    private async listedReporters(periodId: string, siteIds: string[]): Promise<ReporterRow[]> {
        const [raters, paired] = await Promise.all([
            this.periodRaters.find({
                where: { periodId, user: { isActive: true, siteId: In(siteIds) } },
                relations: { user: { department: true } },
            }),
            this.assignments.ratersWithPairs(periodId),
        ]);
        return raters.filter((rater) => !paired || paired.has(rater.id)).map(({ userId, user }) => ({
            id: userId, email: user.email, fullName: user.fullName, department: user.department?.name ?? null,
        }));
    }
}
