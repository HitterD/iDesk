import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, In, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { wibEndOfDate, wibStartOfDate } from '../../../shared/core/utils/wib-date.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CSI_SLA_TARGET_DEFAULT, CSI_TEAM_LABEL_DEFAULT, CsiPeriodPublishStatus, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto, RateeAssignmentDto, UpdatePeriodDto } from '../dto/period.dto';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { assertPeriodInScope } from './csi-scope.util';

export type CsiPeriodStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

const DEFAULT_RESPONDENT_MODE: Record<ServiceScope, CsiRespondentMode> = {
    ICT: CsiRespondentMode.OPEN,
    HC: CsiRespondentMode.LISTED,
};
const LOCKED_MESSAGE = 'Periode sudah memiliki jawaban';
const INACTIVE_USER_MESSAGE = 'Pengguna tidak ditemukan atau tidak aktif';
const INCOMPLETE_MESSAGE = 'Survei belum lengkap';
const NO_SECTION_MESSAGE = 'Aktifkan minimal satu bagian penilaian';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const NO_SITE_MESSAGE = 'Pilih minimal satu site';
const QUESTION_NOT_FOUND_MESSAGE = 'Pertanyaan tidak ditemukan atau tidak aktif';
const TEAM_SORT_ORDER = -1;

export type CsiReadinessKey = 'team' | 'ratees' | 'dimensions' | 'departments' | 'raters';
export type CsiReadiness = { ready: boolean; checks: Array<{ key: CsiReadinessKey; ok: boolean; label: string }> };
const READINESS_LABELS: Record<CsiReadinessKey, string> = {
    team: 'Penilaian tim punya minimal 1 pertanyaan',
    ratees: 'Minimal 1 orang dinilai',
    dimensions: 'Setiap orang punya minimal 1 dimensi',
    departments: 'Minimal 1 departemen aktif',
    raters: 'Minimal 1 penilai (mode terdaftar)',
};

/** Period dates are inclusive WIB calendar days. */
export function computeStatus(period: { startDate: string; endDate: string }, now: Date = new Date()): CsiPeriodStatus {
    if (now.getTime() < wibStartOfDate(period.startDate).getTime()) return 'UPCOMING';
    if (now.getTime() > wibEndOfDate(period.endDate).getTime()) return 'ENDED';
    return 'ACTIVE';
}

type ReadinessEntry = [CsiReadinessKey, boolean];

/**
 * Publish prerequisites. `team` only applies when the team section is enabled; `ratees`/`dimensions` (PERSON ratees)
 * only when the individual section is enabled; `raters` only to LISTED periods.
 */
export function computeReadiness(input: {
    ratees: Array<{ dimensions: unknown[] }>; raterCount: number; respondentMode: CsiRespondentMode; activeDepartmentCount: number;
    teamEnabled: boolean; individualEnabled: boolean; teamQuestionCount: number;
}): CsiReadiness {
    const results: ReadinessEntry[] = [
        ...(input.teamEnabled ? [['team', input.teamQuestionCount > 0] as ReadinessEntry] : []),
        ...(input.individualEnabled ? [
            ['ratees', input.ratees.length > 0] as ReadinessEntry,
            ['dimensions', input.ratees.length > 0 && input.ratees.every((ratee) => ratee.dimensions.length > 0)] as ReadinessEntry,
        ] : []),
        ['departments', input.activeDepartmentCount > 0],
        ...(input.respondentMode === CsiRespondentMode.LISTED ? [['raters', input.raterCount > 0] as ReadinessEntry] : []),
    ];
    const checks = results.map(([key, ok]) => ({ key, ok, label: READINESS_LABELS[key] }));
    return { ready: checks.every((check) => check.ok), checks };
}

const WITH_SITES: FindOptionsRelations<CsiPeriod> = { sites: { site: true } };
const siteIdsOf = (period: CsiPeriod) => (period.sites ?? []).map((row) => row.siteId);
const bySiteCode = (a: { code: string | null }, b: { code: string | null }) => (a.code ?? '￿').localeCompare(b.code ?? '￿');
/** Period JSON: raw `sites` join rows become `{ id, code, name }` summaries ordered by site code (no legacy `site`/`siteId`). */
const withSites = (period: CsiPeriod) => ({
    ...period,
    sites: (period.sites ?? [])
        .map((row) => ({ id: row.siteId, code: row.site?.code ?? null, name: row.site?.name ?? null }))
        .sort(bySiteCode),
});
/** TEAM first, then people by sortOrder (a legacy row without `kind` is a PERSON). */
const teamFirst = (a: CsiPeriodRatee, b: CsiPeriodRatee) =>
    Number(b.kind === CsiRateeKind.TEAM) - Number(a.kind === CsiRateeKind.TEAM) || a.sortOrder - b.sortOrder;
/** Fields that become immutable once the period has answers (`siteIds` is compared separately). */
const LOCKED_FIELDS = ['respondentMode', 'teamEnabled', 'individualEnabled', 'teamLabel'] as const;
const changesLockedField = (period: Omit<CsiPeriod, 'sites'>, dto: UpdatePeriodDto) =>
    LOCKED_FIELDS.some((field) => dto[field] !== undefined && dto[field] !== period[field]);
const sameIds =(a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
const assertSomeSection = (sections: { teamEnabled: boolean; individualEnabled: boolean }) => {
    if (!sections.teamEnabled && !sections.individualEnabled) throw new BadRequestException(NO_SECTION_MESSAGE);
};
const definedOnly = <T extends object>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;

@Injectable()
export class CsiPeriodService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRateeDimension) private readonly rateeDimensions: Repository<CsiPeriodRateeDimension>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiResponse) private readonly responses: Repository<CsiResponse>,
        @InjectRepository(CsiDimension) private readonly dimensions: Repository<CsiDimension>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(Site) private readonly sites: Repository<Site>,
        @InjectRepository(CsiDepartment) private readonly departments: Repository<CsiDepartment>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async list(scope: ServiceScope, siteId?: string, now: Date = new Date()) {
        // Filtering on `sites` while also loading it would truncate the loaded relation to the matching site:
        // pick the matching period ids first, then load those periods with ALL their sites.
        const matching = siteId
            ? await this.periods.find({ where: { scope, sites: { siteId } }, select: { id: true } })
            : null;
        const rows = matching && !matching.length ? [] : await this.periods.find({
            where: { scope, ...(matching ? { id: In(matching.map((row) => row.id)) } : {}) },
            relations: WITH_SITES, order: { startDate: 'DESC' },
        });
        const counts = await this.countResponses(rows.map((row) => row.id));
        return rows.map((row) => ({
            ...withSites(row), status: computeStatus(row, now), responseCount: counts.get(row.id) ?? 0,
        }));
    }

    async get(scope: ServiceScope, id: string, now: Date = new Date()) {
        const period = await this.findInScope(scope, id, WITH_SITES);
        // No user.isActive filter: assignments are snapshots and must survive later deactivation.
        const ratees = (await this.ratees.find({ where: { periodId: id }, order: { sortOrder: 'ASC' } })).sort(teamFirst);
        const dimensions = ratees.length ? await this.rateeDimensions.find({
            where: { periodRateeId: In(ratees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        }) : [];
        const raters = await this.periodRaters.find({
            where: { periodId: id }, relations: { user: true },
            select: { id: true, periodId: true, userId: true, user: { id: true, fullName: true, email: true, jobTitle: true } },
            order: { user: { fullName: 'ASC' } },
        });
        const rateesWithDimensions = ratees.map((ratee) => ({
            ...ratee,
            dimensions: dimensions.filter((row) => row.periodRateeId === ratee.id).sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        const activeDepartmentCount = await this.departments.count({ where: { scope: period.scope, isActive: true } });
        const eligibleRaterCount = await this.countEligibleRaters(id, siteIdsOf(period));
        const teamRatee = rateesWithDimensions.find((ratee) => ratee.kind === CsiRateeKind.TEAM);
        return {
            ...withSites(period), status: computeStatus(period, now), locked: await this.isLocked(id),
            ratees: rateesWithDimensions,
            raters,
            readiness: computeReadiness({
                // Readiness only looks at PERSON ratees; a kept TEAM ratee is ignored while the team section is off.
                ratees: rateesWithDimensions.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM),
                raterCount: eligibleRaterCount, respondentMode: period.respondentMode, activeDepartmentCount,
                teamEnabled: period.teamEnabled, individualEnabled: period.individualEnabled,
                teamQuestionCount: teamRatee?.dimensions.length ?? 0,
            }),
        };
    }

    /** Re-computes readiness server-side; already published is a no-op. */
    async publish(scope: ServiceScope, id: string) {
        const detail = await this.get(scope, id);
        if (detail.publishStatus === CsiPeriodPublishStatus.PUBLISHED) return detail;
        if (!detail.readiness.ready) throw new BadRequestException(INCOMPLETE_MESSAGE);
        await this.periods.update({ id, scope }, { publishStatus: CsiPeriodPublishStatus.PUBLISHED });
        return this.get(scope, id);
    }

    /** Back to draft is only allowed before the first answer (same lock as assignment edits). */
    async unpublish(scope: ServiceScope, id: string) {
        await this.findInScope(scope, id);
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            await manager.getRepository(CsiPeriod).update({ id, scope }, { publishStatus: CsiPeriodPublishStatus.DRAFT });
        });
        return this.get(scope, id);
    }

    async create(scope: ServiceScope, dto: CreatePeriodDto, actorId: string) {
        assertDateOrder(dto.startDate, dto.endDate);
        const source = dto.copyFromPeriodId
            ? assertPeriodInScope(await this.periods.findOne({ where: { id: dto.copyFromPeriodId }, relations: { sites: true } }), scope)
            : null;
        const siteIds = await this.resolveSiteIds(dto.siteIds ?? (source ? siteIdsOf(source) : []));
        const title = dto.title ?? source?.title;
        if (!title) throw new BadRequestException('Judul periode wajib diisi');
        const sections = {
            teamEnabled: dto.teamEnabled ?? source?.teamEnabled ?? false,
            teamLabel: dto.teamLabel ?? source?.teamLabel ?? CSI_TEAM_LABEL_DEFAULT,
            individualEnabled: dto.individualEnabled ?? source?.individualEnabled ?? true,
            slaTargetPct: dto.slaTargetPct ?? source?.slaTargetPct ?? CSI_SLA_TARGET_DEFAULT,
        };
        assertSomeSection(sections);
        await this.assertNoOverlap(scope, siteIds, dto.startDate, dto.endDate);
        const copied = source ? await this.copyAssignments(scope, source.id, sections.teamLabel) : { ratees: [], raterIds: [] };

        const periodId = await this.dataSource.transaction(async (manager) => {
            // Each requested site is written as one csi_period_sites row (cascade insert).
            const saved = await manager.save(CsiPeriod, {
                scope, sites: siteIds.map((siteId) => ({ siteId }) as CsiPeriodSite), title, ...sections,
                intro: dto.intro ?? source?.intro ?? '',
                thankYou: dto.thankYou ?? source?.thankYou ?? '',
                startDate: dto.startDate, endDate: dto.endDate,
                respondentMode: dto.respondentMode ?? source?.respondentMode ?? DEFAULT_RESPONDENT_MODE[scope],
                publishStatus: CsiPeriodPublishStatus.DRAFT,
                createdById: actorId,
            });
            await this.writeRatees(manager, saved.id, copied.ratees);
            await this.writeRaters(manager, saved.id, copied.raterIds);
            return saved.id;
        });
        return this.get(scope, periodId);
    }

    async update(scope: ServiceScope, id: string, dto: UpdatePeriodDto) {
        const { sites, ...period } = await this.findInScope(scope, id, { sites: true });
        const { siteIds: requestedSiteIds, ...fields } = dto;
        const next = { ...period, ...definedOnly(fields) };
        assertDateOrder(next.startDate, next.endDate);
        assertSomeSection(next);
        const currentSiteIds = (sites ?? []).map((row) => row.siteId);
        const siteIds = requestedSiteIds ? await this.resolveSiteIds(requestedSiteIds) : currentSiteIds;
        await this.assertNoOverlap(scope, siteIds, next.startDate, next.endDate, id);
        const sitesChanged = !sameIds(siteIds, currentSiteIds);
        if (sitesChanged || changesLockedField(period, dto)) {
            // Sites, respondent mode, sections and team label are frozen after the first answer (title, texts, dates and
            // the SLA target stay editable). The exclusive row lock serialises this with respondent submits (FOR SHARE),
            // so a first answer cannot commit between the check and the save.
            await this.dataSource.transaction(async (manager) => {
                await lockUnlockedPeriod(manager, id);
                if (sitesChanged) {
                    await manager.delete(CsiPeriodSite, { periodId: id });
                    await manager.save(CsiPeriodSite, siteIds.map((siteId) => ({ periodId: id, siteId })));
                }
                await manager.getRepository(CsiPeriod).save(next);
                // The TEAM ratee's displayName snapshots the label; rename it in the same locked transaction.
                if (dto.teamLabel !== undefined && dto.teamLabel !== period.teamLabel) {
                    await manager.getRepository(CsiPeriodRatee).update({ periodId: id, kind: CsiRateeKind.TEAM }, { displayName: dto.teamLabel });
                }
            });
        } else {
            await this.periods.save(next);
        }
        return this.get(scope, id);
    }

    async remove(scope: ServiceScope, id: string) {
        const period = await this.findInScope(scope, id);
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            await manager.getRepository(CsiPeriod).delete({ id, scope });
        });
        return period;
    }

    async setRatees(scope: ServiceScope, id: string, assignments: RateeAssignmentDto[]) {
        await this.findInScope(scope, id);
        const ratees = await this.resolveRatees(scope, assignments);
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            // Only people are replaced; the TEAM ratee is managed by setTeamQuestions.
            await manager.delete(CsiPeriodRatee, { periodId: id, kind: CsiRateeKind.PERSON });
            await this.writeRatees(manager, id, ratees);
        });
        return this.get(scope, id);
    }

    /** Replaces the question set of the single TEAM ratee, in the given order; an empty list removes the TEAM ratee. */
    async setTeamQuestions(scope: ServiceScope, id: string, questionIds: string[]) {
        const period = await this.findInScope(scope, id);
        if (new Set(questionIds).size !== questionIds.length) throw new BadRequestException('Pertanyaan tidak boleh duplikat');
        const questions = await this.activeDimensions(scope, questionIds);
        if (questions.size !== questionIds.length) throw new BadRequestException(QUESTION_NOT_FOUND_MESSAGE);
        const snapshots = questionIds.map((questionId) => questionSnapshot(questions.get(questionId)!));
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            const existing = await manager.getRepository(CsiPeriodRatee).findOne({ where: { periodId: id, kind: CsiRateeKind.TEAM } });
            if (!snapshots.length) {
                await manager.delete(CsiPeriodRatee, { periodId: id, kind: CsiRateeKind.TEAM });
                return;
            }
            if (existing) await manager.delete(CsiPeriodRateeDimension, { periodRateeId: existing.id });
            const team = await manager.save(CsiPeriodRatee, {
                ...(existing ?? {}), periodId: id, kind: CsiRateeKind.TEAM, userId: null,
                displayName: period.teamLabel, jobTitle: null, sortOrder: TEAM_SORT_ORDER,
            });
            await manager.save(CsiPeriodRateeDimension, snapshots.map((snapshot, index) => dimensionRow(team.id, snapshot, index)));
        });
        return this.get(scope, id);
    }

    async setRaters(scope: ServiceScope, id: string, userIds: string[]) {
        await this.findInScope(scope, id);
        const ids = [...new Set(userIds)];
        const active = await this.activeUsers(ids);
        if (active.size !== ids.length) throw new BadRequestException(INACTIVE_USER_MESSAGE);
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            await manager.delete(CsiPeriodRater, { periodId: id });
            await this.writeRaters(manager, id, ids);
        });
        return this.get(scope, id);
    }

    private async findInScope(scope: ServiceScope, id: string, relations?: FindOptionsRelations<CsiPeriod>) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id }, ...(relations ? { relations } : {}) }), scope);
    }

    /** Raters who can actually open the survey (respondent eligibility): active users of any of the period's sites. */
    private async countEligibleRaters(periodId: string, siteIds: string[]) {
        if (!siteIds.length) return 0;
        return this.periodRaters.count({ where: { periodId, user: { isActive: true, siteId: In(siteIds) } } });
    }

    private async isLocked(periodId: string) {
        return (await this.responses.count({ where: { periodId } })) > 0;
    }

    /** De-duplicates the requested site ids and rejects (400) an empty list or any unknown site. */
    private async resolveSiteIds(requested: string[]) {
        const siteIds = [...new Set(requested)];
        if (!siteIds.length) throw new BadRequestException(NO_SITE_MESSAGE);
        const found = await this.sites.find({ where: { id: In(siteIds) }, select: { id: true } });
        if (found.length !== siteIds.length) throw new BadRequestException(SITE_NOT_FOUND_MESSAGE);
        return siteIds;
    }

    /** Overlap is per site: another period of the scope sharing any site and intersecting the dates clashes. */
    private async assertNoOverlap(scope: ServiceScope, siteIds: string[], startDate: string, endDate: string, excludeId?: string) {
        const clash = await this.periods.findOne({ where: {
            scope, sites: { siteId: In(siteIds) }, startDate: LessThanOrEqual(endDate), endDate: MoreThanOrEqual(startDate),
            ...(excludeId ? { id: Not(excludeId) } : {}),
        } });
        if (clash) throw new ConflictException('Rentang tanggal bertabrakan dengan periode lain');
    }

    private async countResponses(periodIds: string[]) {
        if (!periodIds.length) return new Map<string, number>();
        const rows: Array<{ periodId: string; count: string }> = await this.responses.createQueryBuilder('response')
            .select('response.periodId', 'periodId').addSelect('COUNT(*)', 'count')
            .where('response.periodId IN (:...periodIds)', { periodIds }).groupBy('response.periodId').getRawMany();
        return new Map(rows.map((row) => [row.periodId, Number(row.count)]));
    }

    private async activeUsers(ids: string[]) {
        if (!ids.length) return new Map<string, User>();
        const rows = await this.users.find({ where: { id: In(ids), isActive: true }, select: { id: true, fullName: true, jobTitle: true } });
        return new Map(rows.map((user) => [user.id, user]));
    }

    private async activeDimensions(scope: ServiceScope, ids: string[]) {
        if (!ids.length) return new Map<string, CsiDimension>();
        const rows = await this.dimensions.find({ where: { id: In(ids), scope, isActive: true } });
        return new Map(rows.map((dimension) => [dimension.id, dimension]));
    }

    /** Validates assignments strictly and returns snapshot rows (400 on any invalid entry). */
    private async resolveRatees(scope: ServiceScope, assignments: RateeAssignmentDto[]): Promise<RateeSnapshot[]> {
        const userIds = assignments.map((assignment) => assignment.userId);
        if (new Set(userIds).size !== userIds.length) throw new BadRequestException('Orang yang dinilai tidak boleh duplikat');
        assignments.forEach(({ dimensionIds }) => {
            if (!dimensionIds.length) throw new BadRequestException('Setiap orang yang dinilai wajib memiliki minimal satu dimensi');
            if (new Set(dimensionIds).size !== dimensionIds.length) throw new BadRequestException('Dimensi tidak boleh duplikat');
        });
        const users = await this.activeUsers(userIds);
        if (users.size !== userIds.length) throw new BadRequestException(INACTIVE_USER_MESSAGE);
        const allDimensionIds = [...new Set(assignments.flatMap((assignment) => assignment.dimensionIds))];
        const dimensions = await this.activeDimensions(scope, allDimensionIds);
        if (dimensions.size !== allDimensionIds.length) throw new BadRequestException('Dimensi tidak ditemukan atau tidak aktif');
        return assignments.map((assignment) => toSnapshot(users.get(assignment.userId)!, assignment.dimensionIds.map((dimensionId) => dimensions.get(dimensionId)!)));
    }

    /**
     * Lenient copy: drops users and questions that are no longer active, re-snapshotting their current definition.
     * The TEAM ratee (when it keeps at least one question) comes first, named after the new period's team label.
     */
    private async copyAssignments(scope: ServiceScope, sourceId: string, teamLabel: string) {
        const sourceRatees = await this.ratees.find({ where: { periodId: sourceId }, order: { sortOrder: 'ASC' } });
        const sourceDimensions = sourceRatees.length ? await this.rateeDimensions.find({
            where: { periodRateeId: In(sourceRatees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        }) : [];
        const sourceRaters = await this.periodRaters.find({ where: { periodId: sourceId } });
        const teamSource = sourceRatees.find((ratee) => ratee.kind === CsiRateeKind.TEAM);
        const personRatees = sourceRatees.filter((ratee): ratee is CsiPeriodRatee & { userId: string } => ratee.kind !== CsiRateeKind.TEAM && ratee.userId !== null);
        const users = await this.activeUsers([...new Set([...personRatees, ...sourceRaters].map((row) => row.userId))]);
        const dimensions = await this.activeDimensions(scope, [...new Set(sourceDimensions.map((row) => row.dimensionId))]);
        const keptOf = (rateeId: string) => sourceDimensions.filter((row) => row.periodRateeId === rateeId)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((row) => dimensions.get(row.dimensionId)).filter((dimension): dimension is CsiDimension => !!dimension);
        const people = [...personRatees].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((ratee) => {
            const user = users.get(ratee.userId);
            const kept = keptOf(ratee.id);
            return user && kept.length ? [toSnapshot(user, kept)] : [];
        });
        const teamKept = teamSource ? keptOf(teamSource.id) : [];
        const team = teamKept.length ? [teamSnapshot(teamLabel, teamKept)] : [];
        const ratees = [...team, ...people.map((person, index) => ({ ...person, sortOrder: index }))];
        return { ratees, raterIds: sourceRaters.map((rater) => rater.userId).filter((userId) => users.has(userId)) };
    }

    private async writeRatees(manager: EntityManager, periodId: string, ratees: RateeSnapshot[]) {
        if (!ratees.length) return;
        const saved = await manager.save(CsiPeriodRatee, ratees.map((ratee, index) => ({
            periodId, kind: ratee.kind, userId: ratee.userId, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
            sortOrder: ratee.sortOrder ?? index,
        })));
        await manager.save(CsiPeriodRateeDimension, saved.flatMap((row, rateeIndex) => ratees[rateeIndex].dimensions.map((dimension, index) =>
            dimensionRow(row.id, dimension, index))));
    }

    private async writeRaters(manager: EntityManager, periodId: string, userIds: string[]) {
        if (!userIds.length) return;
        await manager.save(CsiPeriodRater, userIds.map((userId) => ({ periodId, userId })));
    }
}

/** Question definition copied onto a ratee at assignment time (name + type/required/options). */
type QuestionSnapshot = Pick<CsiDimension, 'id' | 'name' | 'type' | 'required' | 'options'>;
type RateeSnapshot = {
    kind: CsiRateeKind; userId: string | null; displayName: string; jobTitle: string | null;
    /** Explicit order (TEAM = -1); absent means the index in the written list. */
    sortOrder?: number; dimensions: QuestionSnapshot[];
};

const questionSnapshot = ({ id, name, type, required, options }: CsiDimension): QuestionSnapshot => ({ id, name, type, required, options });

const dimensionRow = (periodRateeId: string, question: QuestionSnapshot, sortOrder: number) => ({
    periodRateeId, dimensionId: question.id, dimensionName: question.name,
    type: question.type, required: question.required, options: question.options, sortOrder,
});

function toSnapshot(user: User, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.PERSON, userId: user.id, displayName: user.fullName, jobTitle: user.jobTitle ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

function teamSnapshot(label: string, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.TEAM, userId: null, displayName: label, jobTitle: null, sortOrder: TEAM_SORT_ORDER,
        dimensions: dimensions.map(questionSnapshot),
    };
}

/**
 * Locks the period row (serialising with respondent submissions, which take the same lock)
 * and rejects with 409 once any response exists. Must run inside the caller's transaction.
 */
export async function lockUnlockedPeriod(manager: EntityManager, periodId: string) {
    await lockPeriodRow(manager, periodId);
    const responseCount = await manager.getRepository(CsiResponse).count({ where: { periodId } });
    if (responseCount > 0) throw new ConflictException(LOCKED_MESSAGE);
}

/**
 * Row lock on the period. Admin assignment edits take FOR UPDATE (`pessimistic_write`);
 * respondent submits take FOR SHARE (`pessimistic_read`) so they don't serialise among themselves.
 */
export function lockPeriodRow(
    manager: EntityManager, periodId: string, mode: 'pessimistic_write' | 'pessimistic_read' = 'pessimistic_write',
) {
    return manager.getRepository(CsiPeriod).createQueryBuilder('p')
        .setLock(mode).where('p.id = :id', { id: periodId }).getOne();
}

function assertDateOrder(startDate: string, endDate: string) {
    if (endDate < startDate) throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai');
}
