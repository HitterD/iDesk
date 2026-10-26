import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { wibEndOfDate, wibStartOfDate } from '../../../shared/core/utils/wib-date.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto, RateeAssignmentDto, UpdatePeriodDto } from '../dto/period.dto';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
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

export type CsiReadinessKey = 'ratees' | 'dimensions' | 'departments' | 'raters';
export type CsiReadiness = { ready: boolean; checks: Array<{ key: CsiReadinessKey; ok: boolean; label: string }> };
const READINESS_LABELS: Record<CsiReadinessKey, string> = {
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

/** Publish prerequisites; the `raters` check only applies to LISTED periods. */
export function computeReadiness(input: {
    ratees: Array<{ dimensions: unknown[] }>; raterCount: number; respondentMode: CsiRespondentMode; activeDepartmentCount: number;
}): CsiReadiness {
    const results: Array<[CsiReadinessKey, boolean]> = [
        ['ratees', input.ratees.length > 0],
        ['dimensions', input.ratees.every((ratee) => ratee.dimensions.length > 0)],
        ['departments', input.activeDepartmentCount > 0],
        ...(input.respondentMode === CsiRespondentMode.LISTED ? [['raters', input.raterCount > 0] as [CsiReadinessKey, boolean]] : []),
    ];
    const checks = results.map(([key, ok]) => ({ key, ok, label: READINESS_LABELS[key] }));
    return { ready: checks.every((check) => check.ok), checks };
}

const pickSite = (site?: Site | null) => site ? { id: site.id, code: site.code, name: site.name } : null;
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
        const rows = await this.periods.find({
            where: { scope, ...(siteId ? { siteId } : {}) }, relations: { site: true }, order: { startDate: 'DESC' },
        });
        const counts = await this.countResponses(rows.map((row) => row.id));
        return rows.map((row) => ({
            ...row, site: pickSite(row.site), status: computeStatus(row, now), responseCount: counts.get(row.id) ?? 0,
        }));
    }

    async get(scope: ServiceScope, id: string, now: Date = new Date()) {
        const period = await this.findInScope(scope, id, true);
        // No user.isActive filter: assignments are snapshots and must survive later deactivation.
        const ratees = await this.ratees.find({ where: { periodId: id }, order: { sortOrder: 'ASC' } });
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
        return {
            ...period, site: pickSite(period.site), status: computeStatus(period, now), locked: await this.isLocked(id),
            ratees: rateesWithDimensions,
            raters,
            readiness: computeReadiness({
                ratees: rateesWithDimensions, raterCount: raters.length, respondentMode: period.respondentMode, activeDepartmentCount,
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
        const site = await this.sites.findOne({ where: { id: dto.siteId } });
        if (!site) throw new BadRequestException('Site tidak ditemukan');
        const source = dto.copyFromPeriodId
            ? assertPeriodInScope(await this.periods.findOne({ where: { id: dto.copyFromPeriodId } }), scope)
            : null;
        const title = dto.title ?? source?.title;
        if (!title) throw new BadRequestException('Judul periode wajib diisi');
        await this.assertNoOverlap(scope, dto.siteId, dto.startDate, dto.endDate);
        const copied = source ? await this.copyAssignments(scope, source.id) : { ratees: [], raterIds: [] };

        const periodId = await this.dataSource.transaction(async (manager) => {
            const saved = await manager.save(CsiPeriod, {
                scope, siteId: dto.siteId, title,
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
        const period = await this.findInScope(scope, id);
        const next = { ...period, ...definedOnly(dto) };
        assertDateOrder(next.startDate, next.endDate);
        await this.assertNoOverlap(scope, next.siteId, next.startDate, next.endDate, id);
        if (dto.respondentMode !== undefined && dto.respondentMode !== period.respondentMode) {
            // Only texts and dates stay editable after the first answer. The exclusive row lock serialises this
            // with respondent submits (FOR SHARE), so a first answer cannot commit between the check and the save.
            await this.dataSource.transaction(async (manager) => {
                await lockUnlockedPeriod(manager, id);
                await manager.getRepository(CsiPeriod).save(next);
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
            await manager.delete(CsiPeriodRatee, { periodId: id });
            await this.writeRatees(manager, id, ratees);
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

    private async findInScope(scope: ServiceScope, id: string, withSite = false) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id }, ...(withSite ? { relations: { site: true } } : {}) }), scope);
    }

    private async isLocked(periodId: string) {
        return (await this.responses.count({ where: { periodId } })) > 0;
    }

    private async assertNoOverlap(scope: ServiceScope, siteId: string, startDate: string, endDate: string, excludeId?: string) {
        const clash = await this.periods.findOne({ where: {
            scope, siteId, startDate: LessThanOrEqual(endDate), endDate: MoreThanOrEqual(startDate),
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

    /** Lenient copy: drops users and dimensions that are no longer active, re-snapshotting current names. */
    private async copyAssignments(scope: ServiceScope, sourceId: string) {
        const sourceRatees = await this.ratees.find({ where: { periodId: sourceId }, order: { sortOrder: 'ASC' } });
        const sourceDimensions = sourceRatees.length ? await this.rateeDimensions.find({
            where: { periodRateeId: In(sourceRatees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        }) : [];
        const sourceRaters = await this.periodRaters.find({ where: { periodId: sourceId } });
        const users = await this.activeUsers([...new Set([...sourceRatees, ...sourceRaters].map((row) => row.userId))]);
        const dimensions = await this.activeDimensions(scope, [...new Set(sourceDimensions.map((row) => row.dimensionId))]);
        const ratees = [...sourceRatees].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((ratee) => {
            const user = users.get(ratee.userId);
            const kept = sourceDimensions.filter((row) => row.periodRateeId === ratee.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((row) => dimensions.get(row.dimensionId)).filter((dimension): dimension is CsiDimension => !!dimension);
            return user && kept.length ? [toSnapshot(user, kept)] : [];
        });
        return { ratees, raterIds: sourceRaters.map((rater) => rater.userId).filter((userId) => users.has(userId)) };
    }

    private async writeRatees(manager: EntityManager, periodId: string, ratees: RateeSnapshot[]) {
        if (!ratees.length) return;
        const saved = await manager.save(CsiPeriodRatee, ratees.map((ratee, index) => ({
            periodId, userId: ratee.userId, displayName: ratee.displayName, jobTitle: ratee.jobTitle, sortOrder: index,
        })));
        await manager.save(CsiPeriodRateeDimension, saved.flatMap((row, rateeIndex) => ratees[rateeIndex].dimensions.map((dimension, index) => ({
            periodRateeId: row.id, dimensionId: dimension.id, dimensionName: dimension.name, sortOrder: index,
        }))));
    }

    private async writeRaters(manager: EntityManager, periodId: string, userIds: string[]) {
        if (!userIds.length) return;
        await manager.save(CsiPeriodRater, userIds.map((userId) => ({ periodId, userId })));
    }
}

type RateeSnapshot = { userId: string; displayName: string; jobTitle: string | null; dimensions: Array<{ id: string; name: string }> };

function toSnapshot(user: User, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        userId: user.id, displayName: user.fullName, jobTitle: user.jobTitle ?? null,
        dimensions: dimensions.map((dimension) => ({ id: dimension.id, name: dimension.name })),
    };
}

/**
 * Locks the period row (serialising with respondent submissions, which take the same lock)
 * and rejects with 409 once any response exists. Must run inside the caller's transaction.
 */
async function lockUnlockedPeriod(manager: EntityManager, periodId: string) {
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
