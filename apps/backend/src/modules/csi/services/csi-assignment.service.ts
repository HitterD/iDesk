import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiRateeKind } from '../csi.constants';
import { AssignmentPairDto } from '../dto/assignment.dto';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiRaterAssignment } from '../entities/csi-rater-assignment.entity';
import { CsiSubjectProfile } from '../entities/csi-subject-profile.entity';
import { lockUnlockedPeriod } from './csi-period-lock.util';
import { assertPeriodInScope } from './csi-scope.util';
import { teamSubjectKey, userSubjectKey } from './csi-subject-key.util';

const SELF_PAIR_MESSAGE = 'Penilai tidak bisa menilai dirinya sendiri';
const FOREIGN_PAIR_MESSAGE = 'Penilai atau subjek tidak termasuk periode ini';

export type CsiAssignmentPair = { periodRaterId: string; periodRateeId: string };
export type CsiAssignmentView = {
    raters: Array<{ periodRaterId: string; userId: string; fullName: string; department: string | null; siteId: string | null }>;
    ratees: Array<{ periodRateeId: string; kind: CsiRateeKind; name: string; siteId: string | null; photoUrl: string | null }>;
    pairs: CsiAssignmentPair[];
};

const pairKey = (pair: CsiAssignmentPair) => `${pair.periodRaterId}>${pair.periodRateeId}`;
const isTeam = (ratee: CsiPeriodRatee) => ratee.kind === CsiRateeKind.TEAM;
/** TEAM rows first, then people by sortOrder (same order as the period detail). */
const teamFirst = (a: CsiPeriodRatee, b: CsiPeriodRatee) => Number(isTeam(b)) - Number(isTeam(a)) || a.sortOrder - b.sortOrder;
/** Template subject key of a period ratee; null for a legacy TEAM ratee without a csi_teams row. */
const subjectKeyOf = (ratee: CsiPeriodRatee) =>
    isTeam(ratee) ? (ratee.teamId ? teamSubjectKey(ratee.teamId) : null) : (ratee.userId ? userSubjectKey(ratee.userId) : null);
const uniquePairs = (pairs: CsiAssignmentPair[]) =>
    [...new Map(pairs.map((pair) => [pairKey(pair), { periodRaterId: pair.periodRaterId, periodRateeId: pair.periodRateeId }])).values()];

/** Rater → subject mapping per period (csi_period_rater_ratees) and its per-scope template (csi_rater_assignments). */
@Injectable()
export class CsiAssignmentService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRaterRatee) private readonly pairs: Repository<CsiPeriodRaterRatee>,
        @InjectRepository(CsiRaterAssignment) private readonly templates: Repository<CsiRaterAssignment>,
        @InjectRepository(CsiSubjectProfile) private readonly profiles: Repository<CsiSubjectProfile>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async get(scope: ServiceScope, periodId: string): Promise<CsiAssignmentView> {
        await this.findInScope(scope, periodId);
        const { raters, ratees } = await this.loadMembers(periodId);
        const pairs = await this.pairs.find({ where: { periodId } });
        const photos = await this.profilePhotos(scope, ratees);
        return {
            raters: raters.map((rater) => ({
                periodRaterId: rater.id, userId: rater.userId, fullName: rater.user?.fullName ?? '',
                department: rater.user?.department?.name ?? null, siteId: rater.user?.siteId ?? null,
            })),
            ratees: ratees.map((ratee) => ({
                periodRateeId: ratee.id, kind: ratee.kind, name: ratee.displayName, siteId: ratee.siteId,
                photoUrl: ratee.photoUrl ?? (isTeam(ratee) ? ratee.team?.photoUrl ?? null : photos.get(ratee.userId ?? '') ?? ratee.user?.avatarUrl ?? null),
            })),
            pairs: pairs.map(({ periodRaterId, periodRateeId }) => ({ periodRaterId, periodRateeId })),
        };
    }

    /** Replaces every pair of the period in one locked transaction (400 on a self pair or a foreign rater/ratee). */
    async setPairs(scope: ServiceScope, periodId: string, requested: AssignmentPairDto[]) {
        await this.findInScope(scope, periodId);
        const pairs = uniquePairs(requested);
        const { raters, ratees } = await this.loadMembers(periodId);
        const raterById = new Map(raters.map((rater) => [rater.id, rater]));
        const rateeById = new Map(ratees.map((ratee) => [ratee.id, ratee]));
        pairs.forEach((pair) => {
            const rater = raterById.get(pair.periodRaterId);
            const ratee = rateeById.get(pair.periodRateeId);
            if (!rater || !ratee) throw new BadRequestException(FOREIGN_PAIR_MESSAGE);
            if (ratee.userId !== null && rater.userId === ratee.userId) throw new BadRequestException(SELF_PAIR_MESSAGE);
        });
        await this.replacePairs(periodId, pairs);
        return this.get(scope, periodId);
    }

    /** Pairs every listed rater with every ratee of the rater's own site (never themselves; site-less ratees are skipped). */
    async autoSameSite(scope: ServiceScope, periodId: string) {
        await this.findInScope(scope, periodId);
        const { raters, ratees } = await this.loadMembers(periodId);
        const pairs = raters.flatMap((rater) => ratees
            .filter((ratee) => ratee.siteId !== null && ratee.siteId === rater.user?.siteId && ratee.userId !== rater.userId)
            .map((ratee) => ({ periodRaterId: rater.id, periodRateeId: ratee.id })));
        await this.replacePairs(periodId, pairs);
        return this.get(scope, periodId);
    }

    /** Rewrites the scope's template (csi_rater_assignments) from the period's pairs. */
    async saveTemplate(scope: ServiceScope, periodId: string) {
        await this.findInScope(scope, periodId);
        const { raters, ratees } = await this.loadMembers(periodId);
        const raterById = new Map(raters.map((rater) => [rater.id, rater]));
        const rateeById = new Map(ratees.map((ratee) => [ratee.id, ratee]));
        const pairs = await this.pairs.find({ where: { periodId } });
        const rows = pairs.flatMap((pair) => {
            const raterUserId = raterById.get(pair.periodRaterId)?.userId;
            const ratee = rateeById.get(pair.periodRateeId);
            const subjectKey = ratee ? subjectKeyOf(ratee) : null;
            return raterUserId && subjectKey ? [{ scope, raterUserId, subjectKey }] : [];
        });
        const unique = [...new Map(rows.map((row) => [`${row.raterUserId}|${row.subjectKey}`, row])).values()];
        await this.dataSource.transaction(async (manager) => {
            await manager.delete(CsiRaterAssignment, { scope });
            if (unique.length) await manager.save(CsiRaterAssignment, unique);
        });
        return this.get(scope, periodId);
    }

    /** Fills the period's pairs from the scope template, keeping only rows whose rater and subject are in the period. */
    async applyTemplate(scope: ServiceScope, periodId: string) {
        await this.findInScope(scope, periodId);
        const { raters, ratees } = await this.loadMembers(periodId);
        const raterByUser = new Map(raters.map((rater) => [rater.userId, rater]));
        const rateeBySubject = new Map(ratees.flatMap((ratee) => {
            const key = subjectKeyOf(ratee);
            return key ? [[key, ratee] as const] : [];
        }));
        const template = await this.templates.find({ where: { scope } });
        const pairs = template.flatMap((row) => {
            const rater = raterByUser.get(row.raterUserId);
            const ratee = rateeBySubject.get(row.subjectKey);
            if (!rater || !ratee || ratee.userId === rater.userId) return [];
            return [{ periodRaterId: rater.id, periodRateeId: ratee.id }];
        });
        await this.replacePairs(periodId, uniquePairs(pairs));
        return this.get(scope, periodId);
    }

    /**
     * Copies the pairs of a source period onto a new one, matched by rater userId and subject (user / team); pairs whose
     * rater or subject did not survive the copy are dropped. Used instead of the template when a period is copied.
     */
    async copyPairs(scope: ServiceScope, sourceId: string, periodId: string) {
        await this.findInScope(scope, sourceId);
        await this.findInScope(scope, periodId);
        const source = await this.loadMembers(sourceId);
        const target = await this.loadMembers(periodId);
        const sourceRaterUser = new Map(source.raters.map((rater) => [rater.id, rater.userId]));
        const sourceSubject = new Map(source.ratees.map((ratee) => [ratee.id, subjectKeyOf(ratee)]));
        const raterByUser = new Map(target.raters.map((rater) => [rater.userId, rater]));
        const rateeBySubject = new Map(target.ratees.flatMap((ratee) => {
            const key = subjectKeyOf(ratee);
            return key ? [[key, ratee] as const] : [];
        }));
        const pairs = (await this.pairs.find({ where: { periodId: sourceId } })).flatMap((pair) => {
            const rater = raterByUser.get(sourceRaterUser.get(pair.periodRaterId) ?? '');
            const ratee = rateeBySubject.get(sourceSubject.get(pair.periodRateeId) ?? '');
            if (!rater || !ratee || ratee.userId === rater.userId) return [];
            return [{ periodRaterId: rater.id, periodRateeId: ratee.id }];
        });
        await this.replacePairs(periodId, uniquePairs(pairs));
    }

    /** True once the period has at least one pair. */
    async hasPairs(periodId: string): Promise<boolean> {
        return (await this.pairs.count({ where: { periodId } })) > 0;
    }

    /**
     * Period rater ids (csi_period_raters.id) that have at least one pair; `null` when the period has no pairs at all
     * (unmapped: every rater is in the audience, so callers must not filter). A rater without pairs in a mapped period
     * cannot see the survey, so pending lists, the SLA basis and reminders leave them out.
     */
    async ratersWithPairs(periodId: string): Promise<Set<string> | null> {
        const rows = await this.pairs.find({ where: { periodId }, select: { periodRaterId: true } });
        return rows.length ? new Set(rows.map((row) => row.periodRaterId)) : null;
    }

    /** `null` when the period has no pairs at all (legacy: rate every visible subject); otherwise the rater's ratee ids. */
    async pairsFor(periodId: string, raterUserId: string): Promise<Set<string> | null> {
        const total = await this.pairs.count({ where: { periodId } });
        if (!total) return null;
        const rater = await this.periodRaters.findOne({ where: { periodId, userId: raterUserId } });
        if (!rater) return new Set();
        const rows = await this.pairs.find({ where: { periodId, periodRaterId: rater.id } });
        return new Set(rows.map((row) => row.periodRateeId));
    }

    private async findInScope(scope: ServiceScope, periodId: string) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
    }

    private async loadMembers(periodId: string) {
        const raters = await this.periodRaters.find({
            where: { periodId }, relations: { user: { department: true } }, order: { user: { fullName: 'ASC' } },
        });
        const ratees = (await this.ratees.find({ where: { periodId }, relations: { user: true, team: true } })).sort(teamFirst);
        return { raters, ratees };
    }

    /** Master photo per person ratee (csi_subject_profiles of the scope). */
    private async profilePhotos(scope: ServiceScope, ratees: CsiPeriodRatee[]) {
        const userIds = ratees.flatMap((ratee) => (!isTeam(ratee) && ratee.userId ? [ratee.userId] : []));
        if (!userIds.length) return new Map<string, string>();
        const rows = await this.profiles.find({ where: { scope, userId: In(userIds) } });
        return new Map(rows.flatMap((row) => (row.photoUrl ? [[row.userId, row.photoUrl] as const] : [])));
    }

    private async replacePairs(periodId: string, pairs: CsiAssignmentPair[]) {
        await this.dataSource.transaction(async (manager: EntityManager) => {
            await lockUnlockedPeriod(manager, periodId);
            await manager.delete(CsiPeriodRaterRatee, { periodId });
            if (pairs.length) await manager.save(CsiPeriodRaterRatee, pairs.map((pair) => ({ periodId, ...pair })));
        });
    }
}
