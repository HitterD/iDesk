import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiPairMode, CsiRateeKind } from '../csi.constants';
import { Site } from '../../sites/entities/site.entity';
import { AssignmentPairDto } from '../dto/assignment.dto';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiRaterAssignment } from '../entities/csi-rater-assignment.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiSubjectProfile } from '../entities/csi-subject-profile.entity';
import { LOCKED_MESSAGE, lockPeriodForRaterAdditions, lockUnlockedPeriod } from './csi-period-lock.util';
import { assertPeriodInScope } from './csi-scope.util';
import { picSubjectKey, teamSubjectKey, userSubjectKey } from './csi-subject-key.util';

const SELF_PAIR_MESSAGE = 'Penilai tidak bisa menilai dirinya sendiri';
const FOREIGN_PAIR_MESSAGE = 'Penilai atau subjek tidak termasuk periode ini';
const ANSWERED_RATER_PAIRS_LOCKED_MESSAGE = 'Pemetaan penilai yang sudah mengisi survei tidak dapat diubah';

export type CsiAssignmentPair = { periodRaterId: string; periodRateeId: string };
export type CsiAssignmentView = {
    raters: Array<{ periodRaterId: string; userId: string; fullName: string; department: string | null; siteId: string | null; answered?: boolean }>;
    ratees: Array<{ periodRateeId: string; kind: CsiRateeKind; name: string; siteId: string | null; photoUrl: string | null }>;
    pairs: CsiAssignmentPair[];
    siteHandlers?: Record<string, string>;
};

const pairKey = (pair: CsiAssignmentPair) => `${pair.periodRaterId}>${pair.periodRateeId}`;
const effectiveSite = (siteId: string | null | undefined, handlers: Record<string, string>) => (siteId ? handlers[siteId] ?? siteId : null);
const isTeam = (ratee: CsiPeriodRatee) => ratee.kind === CsiRateeKind.TEAM;
/** TEAM rows first, then people by sortOrder (same order as the period detail). */
const teamFirst = (a: CsiPeriodRatee, b: CsiPeriodRatee) => Number(isTeam(b)) - Number(isTeam(a)) || a.sortOrder - b.sortOrder;
/** Template subject key of a period ratee; null for a legacy TEAM ratee without a csi_teams row. */
const subjectKeyOf = (ratee: CsiPeriodRatee) => {
    if (isTeam(ratee)) return ratee.teamId ? teamSubjectKey(ratee.teamId) : null;
    if (ratee.picId) return picSubjectKey(ratee.picId);
    return ratee.userId ? userSubjectKey(ratee.userId) : null;
};
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
        const siteHandlers = await this.loadSiteHandlers(scope);
        const answered = await this.answeredUserIds(periodId);
        return {
            raters: raters.map((rater) => ({
                periodRaterId: rater.id, userId: rater.userId, fullName: rater.user?.fullName ?? '',
                department: rater.user?.department?.name ?? null, siteId: rater.user?.siteId ?? null,
                answered: answered.has(rater.userId),
            })),
            ratees: ratees.map((ratee) => ({
                periodRateeId: ratee.id, kind: ratee.kind, name: ratee.displayName, siteId: ratee.siteId,
                photoUrl: ratee.photoUrl ?? (isTeam(ratee) ? ratee.team?.photoUrl ?? null : photos.get(ratee.userId ?? '') ?? ratee.user?.avatarUrl ?? null),
            })),
            pairs: pairs.map(({ periodRaterId, periodRateeId }) => ({ periodRaterId, periodRateeId })),
            ...(Object.keys(siteHandlers).length ? { siteHandlers } : {}),
        };
    }

    /** Replaces pairs in one locked transaction (400 on self/foreign pair; when answered, only unanswered raters may change). */
    async setPairs(scope: ServiceScope, periodId: string, requested: AssignmentPairDto[], externalManager?: EntityManager) {
        await this.findInScope(scope, periodId, externalManager);
        const pairs = uniquePairs(requested);
        await this.replacePairs(periodId, async (manager) => {
            const { raters, ratees } = await this.loadMembers(periodId, manager);
            const raterById = new Map(raters.map((rater) => [rater.id, rater]));
            const rateeById = new Map(ratees.map((ratee) => [ratee.id, ratee]));
            pairs.forEach((pair) => {
                const rater = raterById.get(pair.periodRaterId);
                const ratee = rateeById.get(pair.periodRateeId);
                if (!rater || !ratee) throw new BadRequestException(FOREIGN_PAIR_MESSAGE);
                if (ratee.userId !== null && rater.userId === ratee.userId) throw new BadRequestException(SELF_PAIR_MESSAGE);
            });
            return pairs;
        }, externalManager, !externalManager);
        return externalManager ? ({ raters: [], ratees: [], pairs } as CsiAssignmentView) : this.get(scope, periodId);
    }

    /** Pairs every listed rater with every ratee of the rater's effective site (delegated sites like SKD -> SPJ merged; skips self/site-less). */
    async autoSameSite(scope: ServiceScope, periodId: string) {
        await this.findInScope(scope, periodId);
        const handlers = await this.loadSiteHandlers(scope);
        await this.replacePairs(periodId, async (manager) => {
            const { raters, ratees } = await this.loadMembers(periodId, manager);
            return raters.flatMap((rater) => {
                const raterSite = effectiveSite(rater.user?.siteId, handlers);
                if (!raterSite) return [];
                return ratees
                    .filter((ratee) => effectiveSite(ratee.siteId, handlers) === raterSite && ratee.userId !== rater.userId)
                    .map((ratee) => ({ periodRaterId: rater.id, periodRateeId: ratee.id }));
            });
        });
        return this.get(scope, periodId);
    }

    /**
     * Adds effective-site pairs ONLY for newly added raters or ratees in an already-mapped ICT period,
     * leaving existing custom pairs untouched.
     */
    async syncNewMembersSameSite(
        scope: ServiceScope,
        periodId: string,
        before: { raterUserIds?: ReadonlySet<string>; rateeIds?: ReadonlySet<string> },
    ) {
        if (scope !== ServiceScope.ICT) return;
        const { raters, ratees } = await this.loadMembers(periodId);
        const existing = await this.pairs.find({ where: { periodId } });
        if (!existing.length) return;
        const handlers = await this.loadSiteHandlers(scope);
        const seen = new Set(existing.map(pairKey));
        const newRaters = before.raterUserIds ? raters.filter((rater) => !before.raterUserIds!.has(rater.userId)) : [];
        const newRatees = before.rateeIds ? ratees.filter((ratee) => !before.rateeIds!.has(ratee.id)) : [];
        const added: CsiAssignmentPair[] = [];
        const addIfMatch = (rater: typeof raters[number], ratee: typeof ratees[number]) => {
            const raterSite = effectiveSite(rater.user?.siteId, handlers);
            if (!raterSite || effectiveSite(ratee.siteId, handlers) !== raterSite || ratee.userId === rater.userId) return;
            const pair = { periodRaterId: rater.id, periodRateeId: ratee.id };
            const key = pairKey(pair);
            if (!seen.has(key)) { seen.add(key); added.push(pair); }
        };
        newRaters.forEach((rater) => ratees.forEach((ratee) => addIfMatch(rater, ratee)));
        newRatees.forEach((ratee) => raters.forEach((rater) => addIfMatch(rater, ratee)));
        if (!added.length) return;
        await this.dataSource.transaction(async (manager: EntityManager) => {
            await lockPeriodForRaterAdditions(manager, periodId);
            await manager.save(CsiPeriodRaterRatee, added.map((pair) => ({ periodId, ...pair })));
        });
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
        await this.replacePairs(periodId, async (manager) => {
            const { raters, ratees } = await this.loadMembers(periodId, manager);
            const raterByUser = new Map(raters.map((rater) => [rater.userId, rater]));
            const rateeBySubject = new Map(ratees.flatMap((ratee) => {
                const key = subjectKeyOf(ratee);
                return key ? [[key, ratee] as const] : [];
            }));
            const template = await manager.getRepository(CsiRaterAssignment).find({ where: { scope } });
            const pairs = template.flatMap((row) => {
                const rater = raterByUser.get(row.raterUserId);
                const ratee = rateeBySubject.get(row.subjectKey);
                if (!rater || !ratee || ratee.userId === rater.userId) return [];
                return [{ periodRaterId: rater.id, periodRateeId: ratee.id }];
            });
            return uniquePairs(pairs);
        });
        return this.get(scope, periodId);
    }

    /**
     * Copies the pairs of a source period onto a new one, matched by rater userId and subject (user / team); pairs whose
     * rater or subject did not survive the copy are dropped. Used instead of the template when a period is copied.
     */
    async copyPairs(scope: ServiceScope, sourceId: string, periodId: string, externalManager?: EntityManager) {
        const periods = externalManager ? externalManager.getRepository(CsiPeriod) : this.periods;
        assertPeriodInScope(await periods.findOne({ where: { id: sourceId } }), scope);
        assertPeriodInScope(await periods.findOne({ where: { id: periodId } }), scope);
        await this.replacePairs(periodId, async (manager) => {
            const source = await this.loadMembers(sourceId, manager);
            const target = await this.loadMembers(periodId, manager);
            const sourceRaterUser = new Map(source.raters.map((rater) => [rater.id, rater.userId]));
            const sourceSubject = new Map(source.ratees.map((ratee) => [ratee.id, subjectKeyOf(ratee)]));
            const raterByUser = new Map(target.raters.map((rater) => [rater.userId, rater]));
            const rateeBySubject = new Map(target.ratees.flatMap((ratee) => {
                const key = subjectKeyOf(ratee);
                return key ? [[key, ratee] as const] : [];
            }));
            const pairs = (await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodId: sourceId } })).flatMap((pair) => {
                const rater = raterByUser.get(sourceRaterUser.get(pair.periodRaterId) ?? '');
                const ratee = rateeBySubject.get(sourceSubject.get(pair.periodRateeId) ?? '');
                if (!rater || !ratee || ratee.userId === rater.userId) return [];
                return [{ periodRaterId: rater.id, periodRateeId: ratee.id }];
            });
            return uniquePairs(pairs);
        }, externalManager);
    }

    /** True once the period has at least one pair. */
    async hasPairs(periodId: string, manager?: EntityManager): Promise<boolean> {
        const repo = manager ? manager.getRepository(CsiPeriodRaterRatee) : this.pairs;
        return (await repo.count({ where: { periodId } })) > 0;
    }

    /**
     * Period rater ids (csi_period_raters.id) that have at least one pair; `null` when pairMode is ALL or when an
     * unchosen/legacy period has no pairs at all. A CUSTOM period with 0 pairs returns an empty Set (never collapses to ALL).
     */
    async ratersWithPairs(periodId: string): Promise<Set<string> | null> {
        const period = await this.periods.findOne({ where: { id: periodId }, select: { id: true, pairMode: true } });
        if (period?.pairMode === CsiPairMode.ALL) return null;
        const rows = await this.pairs.find({ where: { periodId }, select: { periodRaterId: true } });
        if (period?.pairMode === CsiPairMode.CUSTOM) return new Set(rows.map((row) => row.periodRaterId));
        return rows.length ? new Set(rows.map((row) => row.periodRaterId)) : null;
    }

    /**
     * Period ratee ids (csi_period_ratees.id) that have at least one assigned pair; `null` when pairMode is ALL or when
     * an unchosen/legacy period has no pairs at all.
     */
    async rateesWithPairs(periodId: string): Promise<Set<string> | null> {
        const period = await this.periods.findOne({ where: { id: periodId }, select: { id: true, pairMode: true } });
        if (period?.pairMode === CsiPairMode.ALL) return null;
        const rows = await this.pairs.find({ where: { periodId }, select: { periodRateeId: true } });
        if (period?.pairMode === CsiPairMode.CUSTOM) return new Set(rows.map((row) => row.periodRateeId));
        return rows.length ? new Set(rows.map((row) => row.periodRateeId)) : null;
    }

    /** `null` when pairMode is ALL or an unchosen/legacy period has no pairs; otherwise the rater's ratee ids. */
    async pairsFor(periodId: string, raterUserId: string): Promise<Set<string> | null> {
        const period = await this.periods.findOne({ where: { id: periodId }, select: { id: true, pairMode: true } });
        if (period?.pairMode === CsiPairMode.ALL) return null;
        const total = await this.pairs.count({ where: { periodId } });
        if (!total && period?.pairMode !== CsiPairMode.CUSTOM) return null;
        if (!total) return new Set();
        const rater = await this.periodRaters.findOne({ where: { periodId, userId: raterUserId } });
        if (!rater) return new Set();
        const rows = await this.pairs.find({ where: { periodId, periodRaterId: rater.id } });
        return new Set(rows.map((row) => row.periodRateeId));
    }

    private async loadSiteHandlers(scope: ServiceScope): Promise<Record<string, string>> {
        if (scope !== ServiceScope.ICT) return {};
        const repo = this.dataSource.getRepository?.(Site);
        if (!repo) return {};
        const rows = await repo.find({ where: { isActive: true }, select: { id: true, handledBySiteId: true } });
        const map: Record<string, string> = {};
        rows.forEach((row) => { if (row.handledBySiteId) map[row.id] = row.handledBySiteId; });
        return map;
    }

    private async findInScope(scope: ServiceScope, periodId: string, manager?: EntityManager) {
        const repo = manager ? manager.getRepository(CsiPeriod) : this.periods;
        return assertPeriodInScope(await repo.findOne({ where: { id: periodId } }), scope);
    }

    private async loadMembers(periodId: string, manager?: EntityManager) {
        const raterRepo = manager ? manager.getRepository(CsiPeriodRater) : this.periodRaters;
        const rateeRepo = manager ? manager.getRepository(CsiPeriodRatee) : this.ratees;
        const raters = await raterRepo.find({
            where: { periodId }, relations: { user: { department: true } }, order: { user: { fullName: 'ASC' } },
        });
        const ratees = (await rateeRepo.find({ where: { periodId }, relations: { user: true, team: true } })).sort(teamFirst);
        return { raters, ratees };
    }

    /** Master photo per person ratee (csi_subject_profiles of the scope). */
    private async profilePhotos(scope: ServiceScope, ratees: CsiPeriodRatee[]) {
        const userIds = ratees.flatMap((ratee) => (!isTeam(ratee) && ratee.userId ? [ratee.userId] : []));
        if (!userIds.length) return new Map<string, string>();
        const rows = await this.profiles.find({ where: { scope, userId: In(userIds) } });
        return new Map(rows.flatMap((row) => (row.photoUrl ? [[row.userId, row.photoUrl] as const] : [])));
    }

    private async answeredUserIds(periodId: string): Promise<Set<string>> {
        const repo = this.dataSource.getRepository?.(CsiResponse);
        if (!repo) return new Set();
        const rows = await repo.find({ where: { periodId }, select: { respondentId: true } });
        return new Set(rows.map((row) => row.respondentId));
    }

    private async replacePairs(
        periodId: string,
        buildPairs: (manager: EntityManager) => Promise<CsiAssignmentPair[]>,
        externalManager?: EntityManager,
        preserveAnswered = false,
    ) {
        const run = async (manager: EntityManager) => {
            const responseCount = preserveAnswered
                ? (await lockPeriodForRaterAdditions(manager, periodId)).responseCount
                : (await lockUnlockedPeriod(manager, periodId), 0);
            const pairs = await buildPairs(manager);
            if (responseCount > 0) {
                await this.replaceUnlockedRaterPairs(manager, periodId, pairs);
                return;
            }
            await manager.delete(CsiPeriodRaterRatee, { periodId });
            if (pairs.length) {
                await manager.save(CsiPeriodRaterRatee, pairs.map((pair) => ({ periodId, ...pair })));
                const periodRepo = manager.getRepository(CsiPeriod);
                const current = await periodRepo.findOne({ where: { id: periodId }, select: { id: true, pairMode: true } });
                if (current && current.pairMode !== CsiPairMode.CUSTOM) {
                    await periodRepo.save({ ...current, pairMode: CsiPairMode.CUSTOM });
                }
            }
        };
        if (externalManager) {
            await run(externalManager);
        } else {
            await this.dataSource.transaction(run);
        }
    }

    /**
     * When answers already exist, preserves every pair of raters who have already submitted and applies edits
     * only for unanswered raters on an already-mapped period.
     */
    private async replaceUnlockedRaterPairs(manager: EntityManager, periodId: string, requested: CsiAssignmentPair[]) {
        const period = await manager.getRepository(CsiPeriod).findOne({ where: { id: periodId }, select: { id: true, pairMode: true } });
        const existingPairs = await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodId } });
        const isMapped = period?.pairMode === CsiPairMode.CUSTOM || existingPairs.length > 0;
        if (!isMapped) throw new ConflictException(LOCKED_MESSAGE);

        const raters = await manager.getRepository(CsiPeriodRater).find({ where: { periodId }, select: { id: true, userId: true } });
        const responses = await manager.getRepository(CsiResponse).find({ where: { periodId }, select: { respondentId: true } });
        const answeredUsers = new Set(responses.map((row) => row.respondentId));
        const lockedRaterIds = new Set(raters.filter((rater) => answeredUsers.has(rater.userId)).map((rater) => rater.id));

        const existingLocked = new Set(existingPairs.filter((pair) => lockedRaterIds.has(pair.periodRaterId)).map(pairKey));
        const requestedLocked = new Set(requested.filter((pair) => lockedRaterIds.has(pair.periodRaterId)).map(pairKey));
        if (existingLocked.size !== requestedLocked.size || ![...existingLocked].every((key) => requestedLocked.has(key))) {
            throw new ConflictException(ANSWERED_RATER_PAIRS_LOCKED_MESSAGE);
        }

        const unlockedWithPairs = [...new Set(existingPairs.filter((pair) => !lockedRaterIds.has(pair.periodRaterId)).map((pair) => pair.periodRaterId))];
        if (unlockedWithPairs.length) {
            await manager.delete(CsiPeriodRaterRatee, { periodId, periodRaterId: In(unlockedWithPairs) });
        }
        const toSave = requested.filter((pair) => !lockedRaterIds.has(pair.periodRaterId));
        if (toSave.length) {
            await manager.save(CsiPeriodRaterRatee, toSave.map((pair) => ({ periodId, ...pair })));
        }
    }
}
