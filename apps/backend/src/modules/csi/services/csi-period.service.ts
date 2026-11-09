import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not, QueryFailedError, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { wibEndOfDate, wibStartOfDate } from '../../../shared/core/utils/wib-date.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CSI_CANCEL_REASON_MIN, CSI_SLA_TARGET_DEFAULT, CSI_TEAM_LABEL_DEFAULT, CsiPairMode, CsiPeriodPublishStatus, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto, RateeAssignmentDto, UpdatePeriodDto, UpdatePeriodRateeDto } from '../dto/period.dto';
import { CSI_TAGLINE_MAX } from '../dto/subject.dto';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiAssignmentService } from './csi-assignment.service';
import { lockPeriodRow, lockUnlockedPeriod } from './csi-period-lock.util';
import { assertPeriodInScope } from './csi-scope.util';
import { CsiSubjectService } from './csi-subject.service';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiPic } from '../entities/csi-pic.entity';
import { ictServiceOfRole } from '../org/csi-services';

export { lockPeriodRow, lockUnlockedPeriod };

export type CsiPeriodStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

const DEFAULT_RESPONDENT_MODE: Record<ServiceScope, CsiRespondentMode> = {
    ICT: CsiRespondentMode.LISTED,
    HC: CsiRespondentMode.LISTED,
};
const INACTIVE_USER_MESSAGE = 'Pengguna tidak ditemukan atau tidak aktif';
const INCOMPLETE_MESSAGE = 'Survei belum lengkap';
const NO_SECTION_MESSAGE = 'Aktifkan minimal satu bagian penilaian';
const SITE_NOT_FOUND_MESSAGE = 'Site tidak ditemukan';
const NO_SITE_MESSAGE = 'Pilih minimal satu site';
const QUESTION_NOT_FOUND_MESSAGE = 'Pertanyaan tidak ditemukan atau tidak aktif';
const SITE_NOT_IN_PERIOD_MESSAGE = 'Site tidak termasuk periode ini';
const TEAM_SITE_TAKEN_MESSAGE = 'Site ini sudah memiliki tim di periode ini';
const RATEE_NOT_FOUND_MESSAGE = 'Subjek tidak ditemukan';
const PG_UNIQUE_VIOLATION = '23505';
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
const LOCKED_FIELDS = ['respondentMode', 'teamEnabled', 'individualEnabled', 'teamLabel', 'respondentPicks'] as const;
const changesLockedField = (period: Omit<CsiPeriod, 'sites'>, dto: UpdatePeriodDto) =>
    LOCKED_FIELDS.some((field) => dto[field] !== undefined && dto[field] !== period[field]);
const sameIds =(a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
const assertSomeSection = (sections: { teamEnabled: boolean; individualEnabled: boolean }) => {
    if (!sections.teamEnabled && !sections.individualEnabled) throw new BadRequestException(NO_SECTION_MESSAGE);
};
const CANCELLED_MESSAGE = 'Survei ini sudah dibatalkan. Aktifkan lagi dulu.';
const CONFIRM_TITLE_MESSAGE = 'Judul yang diketik tidak sama dengan judul survei';
const collapse = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/** Double confirmation of destructive actions: the exact title (case/space-insensitive) and a short reason. */
function assertConfirmed(period: Pick<CsiPeriod, 'title'>, input: { confirmTitle: string; reason: string }): string {
    if (collapse(input.confirmTitle ?? '') !== collapse(period.title)) throw new BadRequestException(CONFIRM_TITLE_MESSAGE);
    const reason = (input.reason ?? '').trim();
    if (reason.length < CSI_CANCEL_REASON_MIN) throw new BadRequestException(`Alasan minimal ${CSI_CANCEL_REASON_MIN} karakter`);
    return reason;
}

/** One survey schedule change per scope at a time (publish / restore), released at commit. */
async function lockScopeSchedule(manager: EntityManager, scope: ServiceScope) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`csi-schedule:${scope}`]);
}

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
        private readonly assignments: CsiAssignmentService,
        private readonly subjects: CsiSubjectService,
        private readonly org: CsiOrgService,
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
        const teamRatees = rateesWithDimensions.filter((ratee) => ratee.kind === CsiRateeKind.TEAM);
        return {
            ...withSites(period), status: computeStatus(period, now), locked: await this.isLocked(id),
            ratees: rateesWithDimensions,
            raters,
            readiness: computeReadiness({
                // Readiness only looks at PERSON ratees; a kept TEAM ratee is ignored while the team section is off.
                ratees: rateesWithDimensions.filter((ratee) => ratee.kind !== CsiRateeKind.TEAM),
                raterCount: eligibleRaterCount, respondentMode: period.respondentMode, activeDepartmentCount,
                teamEnabled: period.teamEnabled, individualEnabled: period.individualEnabled,
                // One team per site: the check passes only when every site team has at least one question.
                teamQuestionCount: teamRatees.length ? Math.min(...teamRatees.map((ratee) => ratee.dimensions.length)) : 0,
            }),
        };
    }

    /**
     * Re-computes readiness server-side; already published is a no-op. The clash check and the status change run in
     * one transaction holding a per-scope advisory lock, so two clashing drafts published at the same time cannot both
     * pass (the second waits and then sees the first one published).
     */
    async publish(scope: ServiceScope, id: string) {
        const detail = await this.get(scope, id);
        if (detail.publishStatus === CsiPeriodPublishStatus.PUBLISHED) return detail;
        if (detail.publishStatus === CsiPeriodPublishStatus.CANCELLED) throw new BadRequestException(CANCELLED_MESSAGE);
        if (!detail.readiness.ready) throw new BadRequestException(INCOMPLETE_MESSAGE);
        await this.dataSource.transaction(async (manager) => {
            await lockScopeSchedule(manager, scope);
            await this.assertNoOverlap(scope, detail.sites.map((site) => site.id), detail.startDate, detail.endDate, id, manager);
            await manager.getRepository(CsiPeriod).update({ id, scope }, { publishStatus: CsiPeriodPublishStatus.PUBLISHED });
        });
        return this.get(scope, id);
    }

    /**
     * Stops a survey (running or not, answered or not): hidden from respondents, dashboards and clash checks.
     * Answers and the report are kept. The caller confirms by retyping the title; the reason goes to the audit log.
     */
    async cancel(scope: ServiceScope, id: string, input: { confirmTitle: string; reason: string }, actorId: string) {
        const period = await this.findInScope(scope, id);
        if (period.publishStatus === CsiPeriodPublishStatus.CANCELLED) return this.get(scope, id);
        const reason = assertConfirmed(period, input);
        await this.periods.update({ id, scope }, {
            publishStatus: CsiPeriodPublishStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason,
        });
        return { detail: await this.get(scope, id), audit: { reason, previous: period.publishStatus, responses: await this.countOne(id) } };
    }

    /** Brings a cancelled survey back as published (same clash rules as publishing); only while its end date is ahead. */
    async restore(scope: ServiceScope, id: string, now: Date = new Date()) {
        const period = await this.findInScope(scope, id, { sites: true });
        if (period.publishStatus !== CsiPeriodPublishStatus.CANCELLED) return this.get(scope, id);
        if (computeStatus(period, now) === 'ENDED') throw new BadRequestException('Survei sudah melewati tanggal selesai. Buat survei baru atau ubah tanggalnya dulu.');
        await this.dataSource.transaction(async (manager) => {
            await lockScopeSchedule(manager, scope);
            await this.assertNoOverlap(scope, siteIdsOf(period), period.startDate, period.endDate, id, manager);
            await manager.getRepository(CsiPeriod).update({ id, scope }, {
                publishStatus: CsiPeriodPublishStatus.PUBLISHED, cancelledAt: null, cancelledById: null, cancelReason: null,
            });
        });
        return this.get(scope, id);
    }

    /** Deletes a cancelled survey with all its answers (second step after cancel; title retyped again). */
    async purge(scope: ServiceScope, id: string, input: { confirmTitle: string; reason: string }) {
        const period = await this.findInScope(scope, id);
        if (period.publishStatus !== CsiPeriodPublishStatus.CANCELLED) throw new BadRequestException('Batalkan survei dulu sebelum menghapus permanen.');
        const reason = assertConfirmed(period, input);
        const responses = await this.countOne(id);
        await this.dataSource.transaction(async (manager) => {
            await lockPeriodRow(manager, id);
            // csi_responses has no ON DELETE CASCADE to periods (items/comments cascade from responses).
            await manager.delete(CsiResponse, { periodId: id });
            await manager.delete(CsiPeriod, { id, scope });
        });
        return { period, audit: { reason, responses } };
    }

    /** "Siapa menilai siapa" mode chosen in the wizard; ALL also clears the pairs. */
    async setPairMode(scope: ServiceScope, id: string, mode: CsiPairMode) {
        await this.findInScope(scope, id);
        await this.periods.update({ id, scope }, { pairMode: mode });
        if (mode === CsiPairMode.ALL && (await this.assignments.hasPairs(id))) await this.assignments.setPairs(scope, id, []);
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
            // HC defaults to "respondents pick the PICs who served them"; ICT keeps rating every visible ratee.
            // HC decides who rates whom by default (unit rules); "respondents pick" is opt-in.
            respondentPicks: dto.respondentPicks ?? source?.respondentPicks ?? false,
            targetRespondents: dto.targetRespondents ?? source?.targetRespondents ?? null,
        };
        assertSomeSection(sections);
        // New periods are drafts: they may overlap; the clash is enforced at publish (see assertNoOverlap).
        const copied = source ? await this.copyAssignments(scope, source.id, siteIds) : { ratees: [], raterIds: [] };

        const periodId = await this.dataSource.transaction(async (manager) => {
            // Each requested site is written as one csi_period_sites row (cascade insert).
            const saved = await manager.save(CsiPeriod, {
                scope, sites: siteIds.map((siteId) => ({ siteId }) as CsiPeriodSite), title, ...sections,
                intro: dto.intro ?? source?.intro ?? '',
                thankYou: dto.thankYou ?? source?.thankYou ?? '',
                startDate: dto.startDate, endDate: dto.endDate,
                respondentMode: dto.respondentMode ?? source?.respondentMode ?? DEFAULT_RESPONDENT_MODE[scope],
                pairMode: source?.pairMode ?? null,
                unitRules: source?.unitRules ?? [],
                publishStatus: CsiPeriodPublishStatus.DRAFT,
                createdById: actorId,
            });
            await this.writeRatees(manager, saved.id, copied.ratees);
            await this.writeRaters(manager, saved.id, copied.raterIds);
            return saved.id;
        });
        // A copied period takes the source's pairs; a fresh one gets the scope template once it has members
        // (see applyTemplateWhileUnmapped in setRatees/setRaters).
        if (source) await this.assignments.copyPairs(scope, source.id, periodId);
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
        if (period.publishStatus === CsiPeriodPublishStatus.PUBLISHED) await this.assertNoOverlap(scope, siteIds, next.startDate, next.endDate, id);
        // A published period's dates/sites can only move inside the clash rules; others ignore them (see overlaps()).
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
                    // A team belongs to one period site: drop the teams of removed sites (their pairs/questions cascade).
                    await manager.delete(CsiPeriodRatee, { periodId: id, kind: CsiRateeKind.TEAM, siteId: Not(In(siteIds)) });
                }
                // teamLabel is kept for compatibility only: team ratees are named after their csi_teams master.
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
        const unmapped = !(await this.assignments.hasPairs(id));
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            // Only people are diffed here; TEAM ratees are managed by setTeamQuestions.
            await this.syncPeople(manager, id, ratees);
        });
        await this.applyTemplateWhileUnmapped(scope, id, unmapped);
        return this.get(scope, id);
    }

    /**
     * HC per PIC: replaces the PIC ratees of the period with the given active PICs, every one with the same questions
     * (in master order). PICs who stay keep their row (and pairs); user people and teams are not touched.
     */
    async setPics(scope: ServiceScope, id: string, picIds: string[], dimensionIds: string[]) {
        await this.findInScope(scope, id);
        const ids = [...new Set(picIds)];
        if (ids.length && !dimensionIds.length) throw new BadRequestException('Pilih minimal satu pertanyaan untuk PIC');
        if (new Set(dimensionIds).size !== dimensionIds.length) throw new BadRequestException('Pertanyaan tidak boleh duplikat');
        const pics = (await this.org.findPics(scope, ids)).filter((pic) => pic.isActive);
        if (pics.length !== ids.length) throw new BadRequestException('PIC tidak ditemukan atau tidak aktif');
        const questions = await this.activeDimensions(scope, dimensionIds);
        if (questions.size !== dimensionIds.length) throw new BadRequestException(QUESTION_NOT_FOUND_MESSAGE);
        const ordered = [...questions.values()].sort((a, b) => a.sortOrder - b.sortOrder);
        const byId = new Map(pics.map((pic) => [pic.id, pic]));
        const snapshots = [...pics].sort(picOrder).map((pic) => picSnapshot(pic, ordered));
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            const repository = manager.getRepository(CsiPeriodRatee);
            const existing = await repository.find({ where: { periodId: id, picId: Not(IsNull()) } });
            const keep = new Map(existing.filter((row) => byId.has(row.picId!)).map((row) => [row.picId!, row]));
            const removed = existing.filter((row) => !byId.has(row.picId!)).map((row) => row.id);
            if (removed.length) await manager.delete(CsiPeriodRatee, { id: In(removed) });
            const keptIds = [...keep.values()].map((row) => row.id);
            if (keptIds.length) await manager.delete(CsiPeriodRateeDimension, { periodRateeId: In(keptIds) });
            if (!snapshots.length) return;
            const offset = await repository.count({ where: { periodId: id, kind: CsiRateeKind.PERSON, picId: IsNull() } });
            const saved = await manager.save(CsiPeriodRatee, snapshots.map((snapshot, index) => {
                const kept = keep.get(snapshot.picId!);
                return {
                    ...(kept ? { id: kept.id } : {}), periodId: id, kind: snapshot.kind, userId: snapshot.userId,
                    displayName: snapshot.displayName, jobTitle: snapshot.jobTitle, siteId: snapshot.siteId, teamId: null,
                    photoUrl: kept?.photoUrl ?? null, tagline: kept?.tagline ?? null,
                    picId: snapshot.picId, serviceCode: snapshot.serviceCode, bagian: snapshot.bagian,
                    serviceFunction: snapshot.serviceFunction ?? null, sortOrder: offset + index,
                };
            }));
            await manager.save(CsiPeriodRateeDimension, saved.flatMap((row, index) => snapshots[index].dimensions.map((dimension, order) =>
                dimensionRow(row.id, dimension, order))));
        });
        return this.get(scope, id);
    }

    /**
     * Replaces the question set of the TEAM ratee of one period site, in the given order (one team per site); an empty
     * list removes that site's team only. The team is named after its csi_teams master (created when missing); a
     * per-period photo/tagline override of an existing team ratee is kept.
     */
    async setTeamQuestions(scope: ServiceScope, id: string, siteId: string, questionIds: string[]) {
        const period = await this.findInScope(scope, id, { sites: true });
        assertPeriodSite(period, siteId);
        if (new Set(questionIds).size !== questionIds.length) throw new BadRequestException('Pertanyaan tidak boleh duplikat');
        const questions = await this.activeDimensions(scope, questionIds);
        if (questions.size !== questionIds.length) throw new BadRequestException(QUESTION_NOT_FOUND_MESSAGE);
        const snapshots = questionIds.map((questionId) => questionSnapshot(questions.get(questionId)!));
        const team = snapshots.length ? await this.subjects.createTeam(scope, siteId) : null;
        await rethrowTeamConflict(this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            const where = { periodId: id, kind: CsiRateeKind.TEAM, siteId };
            if (!team) {
                await manager.delete(CsiPeriodRatee, where);
                return;
            }
            const existing = await manager.getRepository(CsiPeriodRatee).findOne({ where });
            if (existing) await manager.delete(CsiPeriodRateeDimension, { periodRateeId: existing.id });
            const saved = await manager.save(CsiPeriodRatee, {
                ...(existing ?? { photoUrl: null, tagline: null }), periodId: id, kind: CsiRateeKind.TEAM, userId: null,
                siteId, teamId: team.teamId, displayName: team.name, jobTitle: null, sortOrder: TEAM_SORT_ORDER,
            });
            await manager.save(CsiPeriodRateeDimension, snapshots.map((snapshot, index) => dimensionRow(saved.id, snapshot, index)));
        }));
        return this.get(scope, id);
    }

    /**
     * Per-period override of one ratee ("Hanya untuk periode ini"): tagline (empty → back to master), photo reset (null)
     * and site. The master (csi_teams / csi_subject_profiles) is never touched. Moving a TEAM ratee re-binds it to the
     * target site's team; a site that already has a team in the period is a 409.
     */
    async updateRatee(scope: ServiceScope, id: string, periodRateeId: string, dto: UpdatePeriodRateeDto) {
        const period = await this.findInScope(scope, id, { sites: true });
        const ratee = await this.ratees.findOne({ where: { id: periodRateeId, periodId: id } });
        if (!ratee) throw new NotFoundException(RATEE_NOT_FOUND_MESSAGE);
        const tagline = normalizeTagline(dto.tagline);
        const overrides = definedOnly({ tagline, photoUrl: dto.photoUrl === null ? null : undefined });
        if (dto.siteId === undefined || dto.siteId === ratee.siteId) {
            await this.ratees.save({ ...ratee, ...overrides });
            return this.get(scope, id);
        }
        const siteId = assertPeriodSite(period, dto.siteId);
        const team = ratee.kind === CsiRateeKind.TEAM ? await this.subjects.createTeam(scope, siteId) : null;
        await rethrowTeamConflict(this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            const repository = manager.getRepository(CsiPeriodRatee);
            if (team && await repository.findOne({ where: { periodId: id, kind: CsiRateeKind.TEAM, siteId } })) {
                throw new ConflictException(TEAM_SITE_TAKEN_MESSAGE);
            }
            await repository.save({ ...ratee, ...overrides, siteId, ...(team ? { teamId: team.teamId, displayName: team.name } : {}) });
        }));
        return this.get(scope, id);
    }

    async setRaters(scope: ServiceScope, id: string, userIds: string[]) {
        await this.findInScope(scope, id);
        const ids = [...new Set(userIds)];
        const active = await this.activeUsers(ids);
        if (active.size !== ids.length) throw new BadRequestException(INACTIVE_USER_MESSAGE);
        const unmapped = !(await this.assignments.hasPairs(id));
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, id);
            // Diff by userId: rows (and their pairs) of raters who stay are kept.
            const existing = await manager.getRepository(CsiPeriodRater).find({ where: { periodId: id } });
            const removed = existing.filter((row) => !ids.includes(row.userId)).map((row) => row.id);
            if (removed.length) await manager.delete(CsiPeriodRater, { id: In(removed) });
            const kept = new Set(existing.map((row) => row.userId));
            await this.writeRaters(manager, id, ids.filter((userId) => !kept.has(userId)));
        });
        await this.applyTemplateWhileUnmapped(scope, id, unmapped);
        return this.get(scope, id);
    }

    /**
     * "Periode baru: pemetaan disalin dari template master". Applied only when the period had no pairs before the edit
     * (checked before writing, because replacing people/raters cascades their pairs away): admin mappings and pairs
     * copied from a source period are never overwritten.
     */
    private async applyTemplateWhileUnmapped(scope: ServiceScope, id: string, unmapped: boolean) {
        if (!unmapped) return;
        const period = await this.periods.findOne({ where: { id }, select: { id: true, pairMode: true } });
        // "Semua menilai semua" chosen explicitly must stay that way.
        if (period?.pairMode === CsiPairMode.ALL) return;
        await this.assignments.applyTemplate(scope, id);
    }

    private countOne(periodId: string) {
        return this.responses.count({ where: { periodId } });
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

    /**
     * Published periods of the scope sharing a site and intersecting the dates (optionally excluding one period).
     * Drafts never count: they are invisible to respondents, so admins may prepare the next survey freely.
     */
    async overlaps(scope: ServiceScope, siteIds: string[], startDate: string, endDate: string, excludeId?: string, manager?: EntityManager) {
        if (!siteIds.length || !startDate || !endDate || endDate < startDate) return [];
        const periods = manager ? manager.getRepository(CsiPeriod) : this.periods;
        const matching = await periods.find({
            where: {
                scope, publishStatus: CsiPeriodPublishStatus.PUBLISHED, sites: { siteId: In(siteIds) },
                startDate: LessThanOrEqual(endDate), endDate: MoreThanOrEqual(startDate),
                ...(excludeId ? { id: Not(excludeId) } : {}),
            },
            select: { id: true },
        });
        if (!matching.length) return [];
        const rows = await periods.find({ where: { id: In(matching.map((row) => row.id)) }, relations: WITH_SITES, order: { startDate: 'ASC' } });
        return rows.map((row) => {
            const view = withSites(row);
            return {
                id: row.id, title: row.title, startDate: row.startDate, endDate: row.endDate,
                sites: view.sites.filter((site) => siteIds.includes(site.id)),
            };
        });
    }

    /** One published survey per scope, site and day: 409 naming the clashing survey (structured for the form). */
    private async assertNoOverlap(scope: ServiceScope, siteIds: string[], startDate: string, endDate: string, excludeId?: string, manager?: EntityManager) {
        const [clash] = await this.overlaps(scope, siteIds, startDate, endDate, excludeId, manager);
        if (!clash) return;
        const where = clash.sites.map((site) => site.code ?? site.name).filter(Boolean).join(', ');
        throw new ConflictException({
            statusCode: 409, code: 'CSI_PERIOD_OVERLAP', overlap: clash,
            message: `Tanggal bertabrakan dengan survei "${clash.title}" (${where}, ${clash.startDate} s.d. ${clash.endDate}) yang sudah terbit`,
        });
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
        const rows = await this.users.find({ where: { id: In(ids), isActive: true }, select: { id: true, fullName: true, jobTitle: true, siteId: true, role: true } });
        return new Map(rows.map((user) => [user.id, user]));
    }

    /**
     * ICT people carry their layanan (team from the account role) and fungsi pelayanan into the period, like HC PICs;
     * HC user people (picked by hand) have neither.
     */
    private async servicesOf(scope: ServiceScope, users: User[]): Promise<ServiceSnapshots> {
        if (scope !== ServiceScope.ICT || !users.length) return new Map();
        const functions = await this.subjects.serviceFunctionsOf(scope, users.map((user) => user.id));
        return new Map(users.map((user) => [user.id, { serviceCode: ictServiceOfRole(user.role), serviceFunction: functions.get(user.id) ?? null }]));
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
        const services = await this.servicesOf(scope, [...users.values()]);
        return assignments.map((assignment) => toSnapshot(users.get(assignment.userId)!, assignment.dimensionIds.map((dimensionId) => dimensions.get(dimensionId)!), services));
    }

    /**
     * Lenient copy: drops users and questions that are no longer active, re-snapshotting their current definition.
     * Each site team (when it keeps at least one question and its site is in the new period) comes first, named after
     * its current csi_teams master. Per-period overrides (photo/tagline) are not carried over.
     */
    private async copyAssignments(scope: ServiceScope, sourceId: string, siteIds: string[]) {
        const sourceRatees = await this.ratees.find({ where: { periodId: sourceId }, order: { sortOrder: 'ASC' } });
        const sourceDimensions = sourceRatees.length ? await this.rateeDimensions.find({
            where: { periodRateeId: In(sourceRatees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        }) : [];
        const sourceRaters = await this.periodRaters.find({ where: { periodId: sourceId } });
        const teamSources = sourceRatees.filter((ratee): ratee is CsiPeriodRatee & { siteId: string } =>
            ratee.kind === CsiRateeKind.TEAM && ratee.siteId !== null && siteIds.includes(ratee.siteId));
        const personRatees = sourceRatees.filter((ratee): ratee is CsiPeriodRatee & { userId: string } => ratee.kind !== CsiRateeKind.TEAM && !ratee.picId && ratee.userId !== null);
        const picRatees = sourceRatees.filter((ratee): ratee is CsiPeriodRatee & { picId: string } => ratee.kind !== CsiRateeKind.TEAM && !!ratee.picId);
        const users = await this.activeUsers([...new Set([...personRatees, ...sourceRaters].map((row) => row.userId))]);
        const dimensions = await this.activeDimensions(scope, [...new Set(sourceDimensions.map((row) => row.dimensionId))]);
        const keptOf = (rateeId: string) => sourceDimensions.filter((row) => row.periodRateeId === rateeId)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((row) => dimensions.get(row.dimensionId)).filter((dimension): dimension is CsiDimension => !!dimension);
        const services = await this.servicesOf(scope, [...users.values()]);
        const people = [...personRatees].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((ratee) => {
            const user = users.get(ratee.userId);
            const kept = keptOf(ratee.id);
            return user && kept.length ? [toSnapshot(user, kept, services)] : [];
        });
        const teams: RateeSnapshot[] = [];
        for (const source of teamSources) {
            const kept = keptOf(source.id);
            if (kept.length) teams.push(teamSnapshot(await this.subjects.createTeam(scope, source.siteId), kept));
        }
        // HC PICs: still-active PICs keep their questions (re-snapshotted from the current master).
        const activePics = new Map((await this.org.findPics(scope, picRatees.map((ratee) => ratee.picId))).filter((pic) => pic.isActive).map((pic) => [pic.id, pic]));
        const pics = picRatees.flatMap((ratee) => {
            const pic = activePics.get(ratee.picId);
            const kept = keptOf(ratee.id);
            return pic && kept.length ? [picSnapshot(pic, kept)] : [];
        });
        const ratees = [...teams, ...[...people, ...pics].map((person, index) => ({ ...person, sortOrder: index }))];
        return { ratees, raterIds: sourceRaters.map((rater) => rater.userId).filter((userId) => users.has(userId)) };
    }

    private async writeRatees(manager: EntityManager, periodId: string, ratees: RateeSnapshot[]) {
        if (!ratees.length) return;
        const saved = await manager.save(CsiPeriodRatee, ratees.map((ratee, index) => ({
            periodId, kind: ratee.kind, userId: ratee.userId, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
            siteId: ratee.siteId, teamId: ratee.teamId, photoUrl: ratee.photoUrl, tagline: ratee.tagline,
            picId: ratee.picId ?? null, serviceCode: ratee.serviceCode ?? null, bagian: ratee.bagian ?? null, serviceFunction: ratee.serviceFunction ?? null,
            sortOrder: ratee.sortOrder ?? index,
        })));
        await manager.save(CsiPeriodRateeDimension, saved.flatMap((row, rateeIndex) => ratees[rateeIndex].dimensions.map((dimension, index) =>
            dimensionRow(row.id, dimension, index))));
    }

    /**
     * Replaces the PERSON ratees by userId diff so that csi_period_rater_ratees of people who stay survive (pairs cascade
     * only from deleted rows). Kept rows keep their id and per-period overrides (siteId/photoUrl/tagline); their name,
     * job title, order and question snapshots are refreshed in place.
     */
    private async syncPeople(manager: EntityManager, periodId: string, ratees: RateeSnapshot[]) {
        const existing = await manager.getRepository(CsiPeriodRatee).find({ where: { periodId, kind: CsiRateeKind.PERSON, picId: IsNull() } });
        const byUser = new Map(existing.map((row) => [row.userId, row]));
        const wanted = new Set(ratees.map((ratee) => ratee.userId));
        const removed = existing.filter((row) => !wanted.has(row.userId)).map((row) => row.id);
        if (removed.length) await manager.delete(CsiPeriodRatee, { id: In(removed) });
        const keptIds = ratees.flatMap((ratee) => byUser.get(ratee.userId)?.id ?? []);
        if (keptIds.length) await manager.delete(CsiPeriodRateeDimension, { periodRateeId: In(keptIds) });
        if (!ratees.length) return;
        const saved = await manager.save(CsiPeriodRatee, ratees.map((ratee, index) => {
            const kept = byUser.get(ratee.userId);
            return {
                ...(kept ? { id: kept.id } : {}),
                periodId, kind: ratee.kind, userId: ratee.userId, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
                siteId: kept ? kept.siteId : ratee.siteId, teamId: ratee.teamId,
                photoUrl: kept ? kept.photoUrl : ratee.photoUrl, tagline: kept ? kept.tagline : ratee.tagline,
                serviceCode: ratee.serviceCode ?? null, serviceFunction: ratee.serviceFunction ?? null,
                sortOrder: ratee.sortOrder ?? index,
            };
        }));
        await manager.save(CsiPeriodRateeDimension, saved.flatMap((row, rateeIndex) => ratees[rateeIndex].dimensions.map((dimension, index) =>
            dimensionRow(row.id, dimension, index))));
    }

    private async writeRaters(manager: EntityManager, periodId: string, userIds: string[]) {
        if (!userIds.length) return;
        await manager.save(CsiPeriodRater, userIds.map((userId) => ({ periodId, userId })));
    }
}

/** Question definition copied onto a ratee at assignment time (name, shortLabel, type/required/options). */
type QuestionSnapshot = Pick<CsiDimension, 'id' | 'name' | 'shortLabel' | 'type' | 'required' | 'options'>;
type RateeSnapshot = {
    kind: CsiRateeKind; userId: string | null; displayName: string; jobTitle: string | null;
    /** PERSON: User.siteId at snapshot time; TEAM: the team's site. */
    siteId: string | null; teamId: string | null;
    /** Per-period overrides; always null in a snapshot (master values are resolved on read). */
    photoUrl: null; tagline: null;
    /** HC PIC ratee: the PIC and its layanan / bagian. */
    picId?: string | null; serviceCode?: string | null; bagian?: string | null; serviceFunction?: string | null;
    /** Explicit order (TEAM = -1); absent means the index in the written list. */
    sortOrder?: number; dimensions: QuestionSnapshot[];
};

const questionSnapshot = ({ id, name, shortLabel, type, required, options }: CsiDimension): QuestionSnapshot =>
    ({ id, name, shortLabel: shortLabel ?? null, type, required, options });

const dimensionRow = (periodRateeId: string, question: QuestionSnapshot, sortOrder: number) => ({
    periodRateeId, dimensionId: question.id, dimensionName: question.name, shortLabel: question.shortLabel ?? null,
    type: question.type, required: question.required, options: question.options, sortOrder,
});

type ServiceSnapshots = Map<string, { serviceCode: string | null; serviceFunction: string | null }>;

function toSnapshot(user: User, dimensions: CsiDimension[], services: ServiceSnapshots = new Map()): RateeSnapshot {
    const service = services.get(user.id);
    return {
        kind: CsiRateeKind.PERSON, userId: user.id, displayName: user.fullName, jobTitle: user.jobTitle ?? null,
        siteId: user.siteId ?? null, teamId: null, photoUrl: null, tagline: null,
        serviceCode: service?.serviceCode ?? null, serviceFunction: service?.serviceFunction ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

function picSnapshot(pic: CsiPic, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.PERSON, userId: pic.userId, displayName: pic.fullName, jobTitle: pic.jobTitle,
        siteId: pic.siteId, teamId: null, photoUrl: null, tagline: null,
        picId: pic.id, serviceCode: pic.serviceCode, bagian: pic.bagian, serviceFunction: pic.serviceFunction ?? null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

function teamSnapshot(team: { teamId: string | null; name: string; siteId: string }, dimensions: CsiDimension[]): RateeSnapshot {
    return {
        kind: CsiRateeKind.TEAM, userId: null, displayName: team.name, jobTitle: null, sortOrder: TEAM_SORT_ORDER,
        siteId: team.siteId, teamId: team.teamId, photoUrl: null, tagline: null,
        dimensions: dimensions.map(questionSnapshot),
    };
}

/** PICs in layanan -> bagian -> name order (the order respondents and reports see). */
const picOrder = (a: CsiPic, b: CsiPic) =>
    a.serviceCode.localeCompare(b.serviceCode) || (a.bagian ?? '').localeCompare(b.bagian ?? '') || a.fullName.localeCompare(b.fullName);

/** 400 unless the site belongs to the period; returns the site id. */
function assertPeriodSite(period: CsiPeriod, siteId: string) {
    if (!siteIdsOf(period).includes(siteId)) throw new BadRequestException(SITE_NOT_IN_PERIOD_MESSAGE);
    return siteId;
}

/** Trimmed tagline; '' or null clears the override (back to master), undefined leaves it unchanged. */
function normalizeTagline(value: string | null | undefined) {
    if (value === undefined) return undefined;
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > CSI_TAGLINE_MAX) throw new BadRequestException('Tagline maksimal 90 karakter');
    return text || null;
}

/** UQ_csi_period_ratees_team_site (one team per site per period) surfaces as 409, e.g. on a concurrent create. */
async function rethrowTeamConflict<T>(work: Promise<T>): Promise<T> {
    try {
        return await work;
    } catch (error) {
        if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
            throw new ConflictException(TEAM_SITE_TAKEN_MESSAGE);
        }
        throw error;
    }
}

function assertDateOrder(startDate: string, endDate: string) {
    if (endDate < startDate) throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai');
}
