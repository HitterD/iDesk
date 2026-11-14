import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto } from '../dto/period.dto';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { normalizeName } from '../org/csi-name-match';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiTemplatePicView, CsiTemplateView } from '../org/csi-template-view';
import { CsiAssignmentTemplateService } from './csi-assignment-template.service';
import { CsiPeriodService, samePeriodTitle } from './csi-period.service';
import { enableSectionsWithRatees } from './csi-period-sections.util';
import { assertHcScope, assertPeriodInScope } from './csi-scope.util';
import { CsiMasterSeed, existingMaster, loadMasterContext, mastersIndex, newMasterOf } from './csi-template-import.service';

export type CsiTemplateApplyReport = {
    picsAdded: number; teamsAdded: number; ratersAdded: number; pairsAdded: number;
    /** Distinct applied rater accounts matched by name only (status ok), i.e. not yet confirmed by HC. */
    ratersUnconfirmed: number;
    /** PICs / teams without any applied rater ("belum punya penilai"): listed and not added as ratees until they have raters. */
    picsWithoutRaters: string[];
    /** Rows left out, each as "NAME (reason)": inactive or ambiguous PIC master, ambiguous directory name, inactive team. */
    picsUnmatched: string[]; ratersNoAccount: string[]; ratersAmbiguous: string[];
    /**
     * Applied raters (template names) whose account site is not a site of the survey: they are added as raters but the
     * survey only shows to respondents of its sites, so they would never see it. A warning, never a block.
     */
    ratersOutsideSites: string[];
    /** Site code a sync adds to the survey so the template's raters can see it (null = already covered). */
    siteAdded: string | null;
    /** Why the template cannot be synced into this survey without locking people out (null = it can). */
    blockedReason: string | null;
    committed: boolean;
};
/** "Ambil dari template": the merged report plus the survey's people who are no PIC (user-account ratees). */
export type CsiTemplateApplyManyReport = CsiTemplateApplyReport & { nonPicRatees: number };
type PeriodInput = { title: string; startDate: string; endDate: string };

const BLOCKED = {
    open: 'Survei ini terbuka untuk semua user di site. Template hanya bisa dipakai di survei dengan penilai terdaftar; buat survei baru dari template.',
    picks: 'Di survei ini responden memilih PIC sendiri. Template hanya bisa dipakai di survei yang siapa-menilai-siapa ditetapkan HC.',
    unmapped: 'Survei ini memakai "semua orang menilai semua PIC" untuk penilai yang sudah terdaftar. Menambah pasangan akan menyembunyikan survei dari mereka; buat survei baru dari template.',
    cancelled: 'Survei ini sudah dibatalkan.',
} as const;
const ANSWERED_MESSAGE = 'Survei sudah ada jawaban; ambil template hanya untuk survei tanpa jawaban';
const NO_QUESTIONS_MESSAGE = 'Belum ada pertanyaan HC aktif. Buat template 5 dimensi dulu.';
const siteMissingMessage = (code: string) => `Site ${code} tidak ditemukan`;
const overlapMessage = (code: string, title: string) => `Menambah site ${code} membuat survei ini bertabrakan dengan survei "${title}" yang sudah terbit.`;
const APPLIED_STATUSES = new Set(['ok', 'confirmed']);
const NOT_SCORED = new Set<string>([CsiQuestionType.CHOICE, CsiQuestionType.TEXT]);
const unique = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
/** Why a template row is not rated (shown after the name in picsUnmatched). */
const UNMATCHED_REASON = {
    inactive: 'PIC master nonaktif', missing: 'PIC master tidak ditemukan', ambiguousMaster: 'nama ganda di PIC master',
    ambiguousPerson: 'nama ganda di direktori karyawan', team: 'tim nonaktif atau tidak ditemukan',
} as const;
/** Id of a PIC master a dry run would create (one per name, so two templates naming the same person count once). */
const DRY_MASTER_PREFIX = 'new:';

/** One rated subject of a template row: a PIC master (PERSON ratee) or an active custom team (TEAM ratee). */
type Subject = { key: string; row: CsiTemplatePicView; pic?: CsiPic; team?: CsiTeam; excluded: ReadonlySet<string> };
const picKey = (picId: string) => `pic:${picId}`;
const teamKey = (teamId: string) => `team:${teamId}`;
const rateeKey = (ratee: CsiPeriodRatee) => (ratee.kind === CsiRateeKind.TEAM ? (ratee.teamId ? teamKey(ratee.teamId) : null) : (ratee.picId ? picKey(ratee.picId) : null));

/** What one template adds; sets so several templates (and a rater in two locations) merge without double counting. */
type Tally = {
    pics: Set<string>; teams: Set<string>; raters: Set<string>; pairs: Set<string>; unconfirmed: Set<string>;
    withoutRaters: Set<string>; unmatched: Set<string>; noAccount: Set<string>; ambiguous: Set<string>;
};
const emptyTally = (): Tally => ({
    pics: new Set(), teams: new Set(), raters: new Set(), pairs: new Set(), unconfirmed: new Set(),
    withoutRaters: new Set(), unmatched: new Set(), noAccount: new Set(), ambiguous: new Set(),
});
const mergeTally = (into: Tally, from: Tally) => (Object.keys(into) as Array<keyof Tally>).forEach((key) => from[key].forEach((value) => into[key].add(value)));
type ReportExtra = Pick<CsiTemplateApplyReport, 'ratersOutsideSites' | 'siteAdded' | 'blockedReason' | 'committed'>;
const toReport = (tally: Tally, extra: ReportExtra): CsiTemplateApplyReport => ({
    picsAdded: tally.pics.size, teamsAdded: tally.teams.size, ratersAdded: tally.raters.size, pairsAdded: tally.pairs.size,
    ratersUnconfirmed: tally.unconfirmed.size, picsWithoutRaters: unique(tally.withoutRaters), picsUnmatched: unique(tally.unmatched),
    ratersNoAccount: unique(tally.noAccount), ratersAmbiguous: unique(tally.ambiguous), ...extra,
});

const mergeNames = (into: Map<string, string>, from: Map<string, string>) =>
    from.forEach((name, userId) => { if (!into.has(userId)) into.set(userId, name); });

type Plan = {
    tally: Tally; newSubjects: Subject[]; pairs: Array<{ key: string; userId: string }>;
    /** Existing ratees in this survey whose `siteId` is null or stale relative to the subject's template location(s). */
    siteUpdates: Array<{ id: string; siteId: string }>;
    /** Template location's Site id (overrides pic.siteId so cross-site HC staff are grouped under the template location). */
    siteId: string | null;
    /** Every applied rater account (new or already in the survey) -> its template name. */
    raterNames: Map<string, string>;
    /** The survey already had raters before the sync (its mode is then left alone). */
    hadRaters: boolean;
};
type Repos = {
    ratees: Repository<CsiPeriodRatee>; rateeDims: Repository<CsiPeriodRateeDimension>;
    raters: Repository<CsiPeriodRater>; pairs: Repository<CsiPeriodRaterRatee>; periods: Repository<CsiPeriod>;
    teams: Repository<CsiTeam>; members: Repository<CsiTeamMember>; users: Repository<User>;
    masters: Repository<CsiPic>; templatePics: Repository<CsiAssignmentTemplatePic>; manager: EntityManager;
};
/** A template with every PIC row linked to a master where possible; `masters` = new or (dry run) would-be masters. */
type Resolved = { view: CsiTemplateView; masters: Map<string, CsiPic>; reasons: Map<string, string> };
/** Ratees, raters and pairs already in the survey (all empty for a preview without a survey). */
type PeriodState = { ratees: CsiPeriodRatee[]; raters: CsiPeriodRater[]; pairs: CsiPeriodRaterRatee[] };
const EMPTY_STATE: PeriodState = { ratees: [], raters: [], pairs: [] };
/** PERSON ratees without a PIC master (picked from user accounts): no HC report row, no HC pairs. */
const isNonPicPerson = (ratee: CsiPeriodRatee) => ratee.kind !== CsiRateeKind.TEAM && !ratee.picId;
/**
 * The survey state once the given ratees are gone: their pairs go with them, and a rater left without any pair (who
 * only rated those people) goes too, so the survey never ends up as "everyone rates everyone" for them.
 */
function withoutRatees(state: PeriodState, rateeIds: ReadonlySet<string>): PeriodState {
    const pairs = state.pairs.filter((row) => !rateeIds.has(row.periodRateeId));
    const orphaned = new Set(state.pairs.filter((row) => rateeIds.has(row.periodRateeId)).map((row) => row.periodRaterId));
    pairs.forEach((row) => orphaned.delete(row.periodRaterId));
    return { ratees: state.ratees.filter((row) => !rateeIds.has(row.id)), raters: state.raters.filter((row) => !orphaned.has(row.id)), pairs };
}

/**
 * Puts location templates into a survey, add-only: PICs and active custom teams missing from the period become ratees
 * (with the scope's active HC questions and the service function snapshot), rater accounts become raters, and their
 * pairs are added. Nothing already in the period is removed or changed, so it also works after answers ("Sinkronkan").
 */
@Injectable()
export class CsiTemplateApplyService {
    private readonly logger = new Logger(CsiTemplateApplyService.name);

    constructor(
        private readonly templates: CsiAssignmentTemplateService,
        private readonly org: CsiOrgService,
        @InjectRepository(CsiDimension) private readonly dimensions: Repository<CsiDimension>,
        @InjectRepository(Site) private readonly sites: Repository<Site>,
        private readonly periodService: CsiPeriodService,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async applyToPeriod(scope: ServiceScope, templateId: string, periodId: string, commit: boolean): Promise<CsiTemplateApplyReport> {
        const view = await this.templates.get(scope, templateId);
        const questions = await this.hcQuestions(scope);
        return this.dataSource.transaction(async (manager) => {
            const repos = this.repos(manager);
            const period = assertPeriodInScope(await repos.periods.findOne({ where: { id: periodId }, relations: { sites: { site: true } } }), scope);
            await manager.query('SELECT "id" FROM "csi_periods" WHERE "id" = $1 FOR UPDATE', [periodId]);
            const plan = await this.plan(scope, view, repos, await this.stateOf(repos, periodId), commit);
            const missing = await this.missingSite(manager, period, view.locationCode);
            const blockedReason = period.cancelledAt ? BLOCKED.cancelled : missing.blockedReason ?? await this.blockedReason(period, repos);
            const siteIds = [...(period.sites ?? []).map((row) => row.siteId), ...(missing.site ? [missing.site.id] : [])];
            const ratersOutsideSites = await this.ratersOutside(repos, plan.raterNames, siteIds);
            const report = toReport(plan.tally, { ratersOutsideSites, siteAdded: missing.site?.code ?? null, blockedReason, committed: commit });
            if (!commit) return report;
            if (blockedReason) throw new BadRequestException(blockedReason);
            if (plan.newSubjects.length && !questions.length) throw new BadRequestException(NO_QUESTIONS_MESSAGE);
            if (missing.site) await manager.getRepository(CsiPeriodSite).save({ periodId, siteId: missing.site.id });
            await this.write(manager, repos, period, plan, questions);
            return report;
        });
    }

    /**
     * "Ambil dari template" in the survey wizard: several location templates synced into one existing HC survey in one
     * transaction (dry run unless commit). replaceNonPic first removes the people picked from user accounts (no PIC
     * master) with their pairs; only for a survey without answers.
     */
    async applyManyToPeriod(scope: ServiceScope, templateIds: string[], periodId: string, commit: boolean, replaceNonPic: boolean): Promise<CsiTemplateApplyManyReport> {
        assertHcScope(scope);
        const views = await Promise.all(templateIds.map((id) => this.templates.get(scope, id)));
        const questions = await this.hcQuestions(scope);
        return this.dataSource.transaction(async (manager) => {
            const repos = this.repos(manager);
            const period = assertPeriodInScope(await repos.periods.findOne({ where: { id: periodId }, relations: { sites: { site: true } } }), scope);
            await manager.query('SELECT "id" FROM "csi_periods" WHERE "id" = $1 FOR UPDATE', [periodId]);
            if (replaceNonPic && await manager.getRepository(CsiResponse).count({ where: { periodId } }) > 0) throw new BadRequestException(ANSWERED_MESSAGE);
            const before = await this.stateOf(repos, periodId);
            const nonPic = new Set(before.ratees.filter(isNonPicPerson).map((row) => row.id));
            const state = replaceNonPic ? withoutRatees(before, nonPic) : before;
            const sites = await this.missingSites(manager, period, views);
            const blockedReason = period.cancelledAt ? BLOCKED.cancelled : sites.blockedReason ?? this.blockedReasonOf(period, state);
            const siteIds = [...(period.sites ?? []).map((row) => row.siteId), ...sites.added.map((site) => site.id)];
            const extra = { siteAdded: sites.added.map((site) => site.code).join(', ') || null, blockedReason, committed: commit };
            if (!commit) return { ...await this.mergedReport(repos, views, state, siteIds, extra), nonPicRatees: nonPic.size };
            if (blockedReason) throw new BadRequestException(blockedReason);
            if (replaceNonPic) await this.removeRatees(repos, before, state);
            if (sites.added.length) await manager.getRepository(CsiPeriodSite).save(sites.added.map((site) => ({ periodId, siteId: site.id })));
            const report = await this.applyAll(manager, repos, period, views, questions, siteIds, extra);
            return { ...report, nonPicRatees: nonPic.size };
        });
    }

    /**
     * Merged dry run of several location templates as if they went into one new survey; nothing is written. What
     * create-period would refuse up front (a location without site, no HC questions) is reported as blockedReason.
     */
    async previewPeriod(scope: ServiceScope, templateIds: string[]): Promise<CsiTemplateApplyReport> {
        const views = await Promise.all(templateIds.map((id) => this.templates.get(scope, id)));
        const { blockedReason, foundSiteIds } = await this.preflight(scope, views);
        return this.dataSource.transaction(async (manager) => {
            const repos = this.repos(manager);
            const total = emptyTally();
            const raterNames = new Map<string, string>();
            for (const view of views) {
                const plan = await this.plan(scope, view, repos, EMPTY_STATE, false);
                mergeTally(total, plan.tally);
                mergeNames(raterNames, plan.raterNames);
            }
            const ratersOutsideSites = await this.ratersOutside(repos, raterNames, foundSiteIds);
            return toReport(total, { ratersOutsideSites, siteAdded: null, blockedReason, committed: false });
        });
    }

    /**
     * One draft HC survey covering every template location (individual section, listed raters), then all templates
     * applied in one transaction. Any failure removes the draft: it has no answers yet, so nothing half-built is left.
     */
    async createPeriodFromTemplates(scope: ServiceScope, templateIds: string[], input: PeriodInput, actorId: string) {
        const views = await Promise.all(templateIds.map((id) => this.templates.get(scope, id)));
        const { siteIds, questions, blockedReason } = await this.preflight(scope, views);
        if (blockedReason) throw new BadRequestException(blockedReason);
        const dto: CreatePeriodDto = { ...input, siteIds, respondentMode: CsiRespondentMode.LISTED, individualEnabled: true, teamEnabled: false };
        const period = await this.periodService.create(scope, dto, actorId);
        try {
            const report = await this.dataSource.transaction(async (manager) => {
                const repos = this.repos(manager);
                const total = emptyTally();
                const raterNames = new Map<string, string>();
                for (const view of views) {
                    const draft = assertPeriodInScope(await repos.periods.findOne({ where: { id: period.id } }), scope);
                    const plan = await this.plan(scope, view, repos, await this.stateOf(repos, period.id), true);
                    await this.write(manager, repos, draft, plan, questions);
                    mergeTally(total, plan.tally);
                    mergeNames(raterNames, plan.raterNames);
                }
                const ratersOutsideSites = await this.ratersOutside(repos, raterNames, siteIds);
                return toReport(total, { ratersOutsideSites, siteAdded: null, blockedReason: null, committed: true });
            });
            return { periodId: period.id, report };
        } catch (error) {
            // The original error is what the caller needs; a failed cleanup is logged so the stray draft can be found.
            await this.periodService.remove(scope, period.id).catch((cleanup: unknown) => this.logger.warn(
                `Failed to remove draft CSI period ${period.id} after a failed template apply: ${(cleanup as Error)?.message ?? String(cleanup)}`));
            throw error;
        }
    }

    /** Dry run of several templates against one survey state; sets merge, so a rater in two locations counts once. */
    private async mergedReport(repos: Repos, views: CsiTemplateView[], state: PeriodState, siteIds: string[], extra: Omit<ReportExtra, 'ratersOutsideSites'>) {
        const total = emptyTally();
        const raterNames = new Map<string, string>();
        for (const view of views) {
            const plan = await this.plan(ServiceScope.HC, view, repos, state, false);
            mergeTally(total, plan.tally);
            mergeNames(raterNames, plan.raterNames);
        }
        return toReport(total, { ...extra, ratersOutsideSites: await this.ratersOutside(repos, raterNames, siteIds) });
    }

    /** Writes the templates one after another (each plans against what the previous one wrote). */
    private async applyAll(manager: EntityManager, repos: Repos, period: CsiPeriod, views: CsiTemplateView[], questions: CsiDimension[],
        siteIds: string[], extra: Omit<ReportExtra, 'ratersOutsideSites'>) {
        const total = emptyTally();
        const raterNames = new Map<string, string>();
        for (const view of views) {
            const plan = await this.plan(ServiceScope.HC, view, repos, await this.stateOf(repos, period.id), true);
            if (plan.newSubjects.length && !questions.length) throw new BadRequestException(NO_QUESTIONS_MESSAGE);
            await this.write(manager, repos, period, plan, questions);
            mergeTally(total, plan.tally);
            mergeNames(raterNames, plan.raterNames);
        }
        return toReport(total, { ...extra, ratersOutsideSites: await this.ratersOutside(repos, raterNames, siteIds) });
    }

    /** Deletes what `withoutRatees` dropped: pairs, question snapshots and ratees, then the raters left without pairs. */
    private async removeRatees(repos: Repos, before: PeriodState, after: PeriodState) {
        const keptRatees = new Set(after.ratees.map((row) => row.id));
        const rateeIds = before.ratees.filter((row) => !keptRatees.has(row.id)).map((row) => row.id);
        if (!rateeIds.length) return;
        const keptRaters = new Set(after.raters.map((row) => row.id));
        const raterIds = before.raters.filter((row) => !keptRaters.has(row.id)).map((row) => row.id);
        await repos.pairs.delete({ periodRateeId: In(rateeIds) });
        await repos.rateeDims.delete({ periodRateeId: In(rateeIds) });
        await repos.ratees.delete({ id: In(rateeIds) });
        if (raterIds.length) await repos.raters.delete({ id: In(raterIds) });
    }

    /** missingSite for every distinct template location; the first refusal wins. */
    private async missingSites(manager: EntityManager, period: CsiPeriod, views: CsiTemplateView[]) {
        const added: Site[] = [];
        for (const code of [...new Set(views.map((view) => view.locationCode))]) {
            const missing = await this.missingSite(manager, period, code);
            if (missing.blockedReason) return { added, blockedReason: missing.blockedReason };
            if (missing.site) added.push(missing.site);
        }
        return { added, blockedReason: null };
    }

    private async plan(scope: ServiceScope, template: CsiTemplateView, repos: Repos, state: PeriodState, commit: boolean): Promise<Plan> {
        const [[site], resolved] = await Promise.all([
            this.sites.find({ where: { code: In([template.locationCode]) } }),
            this.resolveMasters(scope, template, repos, commit),
        ]);
        const { view } = resolved;
        const { subjects, reasons } = await this.subjectsOf(scope, resolved, repos);
        const existingRatee = new Map(state.ratees.map((row) => [rateeKey(row), row] as const).filter(([key]) => key !== null));
        const raterOfUser = new Map(state.raters.map((row) => [row.userId, row]));
        const existingPairs = new Set(state.pairs.map((row) => `${row.periodRaterId}|${row.periodRateeId}`));
        const applied = subjects.flatMap((subject) => subject.row.raters
            .filter((rater) => APPLIED_STATUSES.has(rater.status) && rater.userId && !subject.excluded.has(rater.userId))
            .map((rater) => ({ key: subject.key, userId: rater.userId!, name: rater.raterName, unconfirmed: rater.status === 'ok' })));
        const fresh = applied.filter((pair) => {
            const raterId = raterOfUser.get(pair.userId)?.id;
            const rateeId = existingRatee.get(pair.key)?.id;
            return !raterId || !rateeId || !existingPairs.has(`${raterId}|${rateeId}`);
        });
        // Two template rows may name the same PIC or team: it becomes one ratee (pairs of both rows still apply).
        // PICs / teams with zero applied raters are skipped rather than added as 0-rater ratees in the survey.
        const ratedKeys = new Set(applied.map((pair) => pair.key));
        const newSubjects = [...new Map(
            subjects.filter((subject) => !existingRatee.has(subject.key) && ratedKeys.has(subject.key)).map((subject) => [subject.key, subject]),
        ).values()];
        const tally = this.tallyOf(view, subjects, newSubjects, reasons);
        fresh.forEach((pair) => {
            tally.pairs.add(`${pair.userId}|${pair.key}`);
            if (!raterOfUser.has(pair.userId)) tally.raters.add(pair.userId);
        });
        applied.filter((pair) => pair.unconfirmed).forEach((pair) => tally.unconfirmed.add(pair.userId));
        // Rated = a template rater now, or already a pair in the survey (a sync never warns about a subject that has raters).
        const pairedRatees = new Set(state.pairs.map((row) => row.periodRateeId));
        const rated = new Set([...applied.map((pair) => pair.key), ...[...existingRatee].filter(([, ratee]) => pairedRatees.has(ratee.id)).map(([key]) => key)]);
        subjects.filter((subject) => !rated.has(subject.key)).forEach((subject) => tally.withoutRaters.add(subject.row.picName));
        const raterNames = new Map<string, string>();
        applied.forEach((pair) => { if (!raterNames.has(pair.userId)) raterNames.set(pair.userId, pair.name); });
        const siteUpdates = commit && site?.id ? await this.staleSiteUpdates(scope, site.id, subjects, existingRatee, repos.manager) : [];
        return { tally, newSubjects, pairs: fresh, siteUpdates, siteId: site?.id ?? null, raterNames, hadRaters: state.raters.length > 0 };
    }

    /** Existing ratees matched by this template whose stored `siteId` is null or no longer in any template for that subject. */
    private async staleSiteUpdates(scope: ServiceScope, templateSiteId: string, subjects: Subject[],
        existingRatee: ReadonlyMap<string | null, CsiPeriodRatee>, manager: EntityManager): Promise<Array<{ id: string; siteId: string }>> {
        const subjectSites = await this.subjectSiteIds(scope, manager);
        const updates = new Map<string, string>();
        for (const subject of subjects) {
            const existing = existingRatee.get(subject.key);
            if (!existing || existing.siteId === templateSiteId) continue;
            const allowed = subjectSites.get(subject.key);
            if (!existing.siteId || !allowed || !allowed.has(existing.siteId)) updates.set(existing.id, templateSiteId);
        }
        return [...updates].map(([id, siteId]) => ({ id, siteId }));
    }

    private async subjectSiteIds(scope: ServiceScope, manager: EntityManager): Promise<Map<string, Set<string>>> {
        const tplRepo = manager.getRepository(CsiAssignmentTemplate);
        if (!tplRepo) return new Map();
        const templates = await tplRepo.find({ where: { scope } });
        if (!templates.length) return new Map();
        const rows = await manager.getRepository(CsiAssignmentTemplatePic).find({ where: { templateId: In(templates.map((row) => row.id)) } });
        const codes = [...new Set(templates.map((row) => row.locationCode))];
        const sites = codes.length ? await this.sites.find({ where: { code: In(codes) } }) : [];
        const siteByCode = new Map(sites.map((site) => [site.code, site.id]));
        const siteOfTemplate = new Map(templates.flatMap((row) => {
            const siteId = siteByCode.get(row.locationCode);
            return siteId ? [[row.id, siteId] as const] : [];
        }));
        const map = new Map<string, Set<string>>();
        for (const row of rows) {
            const siteId = siteOfTemplate.get(row.templateId);
            const key = row.teamId ? teamKey(row.teamId) : (row.picId ? picKey(row.picId) : null);
            if (!siteId || !key) continue;
            const set = map.get(key) ?? new Set<string>();
            set.add(siteId);
            map.set(key, set);
        }
        return map;
    }

    private tallyOf(view: CsiTemplateView, subjects: Subject[], newSubjects: Subject[], reasons: ReadonlyMap<string, string>): Tally {
        const tally = emptyTally();
        const used = new Set(subjects.map((subject) => subject.row.id));
        newSubjects.forEach((subject) => (subject.team ? tally.teams : tally.pics).add(subject.key));
        view.pics.filter((row) => !used.has(row.id)).forEach((row) => tally.unmatched.add(`${row.picName} (${reasons.get(row.id) ?? UNMATCHED_REASON.missing})`));
        const all = view.pics.flatMap((row) => row.raters);
        all.filter((rater) => rater.status === 'no-account').forEach((rater) => tally.noAccount.add(rater.raterName));
        all.filter((rater) => rater.status === 'ambiguous').forEach((rater) => tally.ambiguous.add(rater.raterName));
        return tally;
    }

    /**
     * Every template PIC row without a master link gets one (same rules as the Excel import): an existing master by
     * NIK/name, else a new master from the HC directory, else from the row (file NIK, else TPL-), site = template
     * location. A commit saves the masters and the links; a dry run only pretends (ids DRY_MASTER_PREFIX + name).
     * Ambiguous names are left out with their reason.
     */
    private async resolveMasters(scope: ServiceScope, view: CsiTemplateView, repos: Repos, commit: boolean): Promise<Resolved> {
        const masters = new Map<string, CsiPic>();
        const reasons = new Map<string, string>();
        const open = view.pics.filter((row) => !row.picId && !row.teamId);
        if (!open.length) return { view, masters, reasons };
        const rows = await repos.templatePics.find({ where: { id: In(open.map((row) => row.id)) } });
        const nikOf = new Map(rows.map((row) => [row.id, row.picNik ?? null]));
        const ctx = await loadMasterContext(repos.manager, scope, view.locationCode);
        const known = await repos.masters.find({ where: { scope } });
        const links = new Map<string, string>();
        for (const row of open) {
            const seed: CsiMasterSeed = { picName: row.picName, nik: nikOf.get(row.id) ?? null, jobTitle: row.jobTitle, serviceCode: row.serviceCode, serviceFunction: row.serviceFunction };
            const hit = existingMaster(ctx, mastersIndex([...known, ...masters.values()]), seed);
            if (hit === 'ambiguous') { reasons.set(row.id, UNMATCHED_REASON.ambiguousMaster); continue; }
            if (!hit && ctx.findPerson(seed.picName, seed.nik) === 'ambiguous') { reasons.set(row.id, UNMATCHED_REASON.ambiguousPerson); continue; }
            const master = hit ?? (commit ? await repos.masters.save(newMasterOf(ctx, seed))
                : { ...newMasterOf(ctx, seed), id: DRY_MASTER_PREFIX + normalizeName(seed.picName) } as CsiPic);
            if (!hit) masters.set(master.id, master);
            links.set(row.id, master.id);
        }
        if (commit && links.size) await repos.templatePics.save(rows.filter((row) => links.has(row.id)).map((row) => ({ ...row, picId: links.get(row.id)! })));
        return { view: { ...view, pics: view.pics.map((row) => (links.has(row.id) ? { ...row, picId: links.get(row.id)! } : row)) }, masters, reasons };
    }

    /**
     * Every template row that can be rated, raters or not: an active PIC master (the PIC never rates themself) or an
     * active custom team (its members never rate their own team). The others come back with their reason.
     */
    private async subjectsOf(scope: ServiceScope, resolved: Resolved, repos: Repos): Promise<{ subjects: Subject[]; reasons: Map<string, string> }> {
        const { view, masters } = resolved;
        const reasons = new Map(resolved.reasons);
        const rows = view.pics;
        const picIds = rows.flatMap((row) => (row.picId && !masters.has(row.picId) ? [row.picId] : []));
        const teamIds = rows.flatMap((row) => (!row.picId && row.teamId ? [row.teamId] : []));
        const found = new Map([...(await this.org.findPics(scope, picIds)), ...masters.values()].map((pic) => [pic.id, pic]));
        const teams = teamIds.length ? (await repos.teams.find({ where: { id: In(teamIds), scope } })).filter((team) => team.isActive) : [];
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const members = teams.length ? await repos.members.find({ where: { teamId: In(teams.map((team) => team.id)) } }) : [];
        const subjects = rows.flatMap((row): Subject[] => {
            const pic = row.picId ? found.get(row.picId) : undefined;
            if (pic?.isActive) return [{ key: picKey(pic.id), row, pic, excluded: new Set(pic.userId ? [pic.userId] : []) }];
            if (row.picId) reasons.set(row.id, pic ? UNMATCHED_REASON.inactive : UNMATCHED_REASON.missing);
            const team = !row.picId && row.teamId ? teamById.get(row.teamId) : undefined;
            if (!row.picId && row.teamId && !team) reasons.set(row.id, UNMATCHED_REASON.team);
            if (!team) return [];
            const own = members.filter((member) => member.teamId === team.id && member.userId).map((member) => member.userId!);
            return [{ key: teamKey(team.id), row, team, excluded: new Set(own) }];
        });
        return { subjects, reasons };
    }

    private async write(manager: EntityManager, repos: Repos, period: CsiPeriod, plan: Plan, questions: CsiDimension[]) {
        const periodId = period.id;
        await this.writeRatees(repos, periodId, plan.newSubjects, questions, plan.siteId);
        for (const update of plan.siteUpdates) await manager.update(CsiPeriodRatee, { id: update.id }, { siteId: update.siteId });
        const rateeOf = new Map((await repos.ratees.find({ where: { periodId } })).map((row) => [rateeKey(row), row.id] as const).filter(([key]) => key !== null));
        const raterOfUser = new Map((await repos.raters.find({ where: { periodId } })).map((row) => [row.userId, row.id]));
        const newUsers = [...new Set(plan.pairs.map((pair) => pair.userId))].filter((userId) => !raterOfUser.has(userId));
        if (newUsers.length) (await repos.raters.save(newUsers.map((userId) => ({ periodId, userId })))).forEach((row) => raterOfUser.set(row.userId, row.id));
        const rows = [...new Map(plan.pairs.map((pair) => {
            const row = { periodId, periodRaterId: raterOfUser.get(pair.userId)!, periodRateeId: rateeOf.get(pair.key)! };
            return [`${row.periodRaterId}|${row.periodRateeId}`, row] as const;
        })).values()];
        if (rows.length) await repos.pairs.save(rows);
        // Only an empty survey switches to the template's mode; an existing mapping already is LISTED + pairs.
        if (!plan.hadRaters) await manager.update(CsiPeriod, { id: periodId }, { respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false });
        // A ratee is only shown and reported while its section is on.
        await enableSectionsWithRatees(manager, periodId, [...new Set(plan.newSubjects.map((subject) => (subject.team ? CsiRateeKind.TEAM : CsiRateeKind.PERSON)))]);
    }

    private async writeRatees(repos: Repos, periodId: string, subjects: Subject[], questions: CsiDimension[], templateSiteId: string | null) {
        if (!subjects.length) return;
        const offset = await repos.ratees.count({ where: { periodId } });
        const saved = await repos.ratees.save(subjects.map((subject, index) => ({
            periodId, photoUrl: null, tagline: null, sortOrder: offset + index, ...rateeFields(subject, templateSiteId),
        })));
        await repos.rateeDims.save(saved.flatMap((ratee) => questions.map((question, order) => ({
            periodRateeId: ratee.id, dimensionId: question.id, dimensionName: question.name, shortLabel: question.shortLabel ?? null,
            type: question.type, required: question.required, options: question.options, sortOrder: order,
        }))));
    }

    /**
     * Sync adds the template location to a survey that lacks it (its raters could not see the survey otherwise). A
     * published survey must not then clash with another published survey of that site.
     */
    private async missingSite(manager: EntityManager, period: CsiPeriod, locationCode: string): Promise<{ site: Site | null; blockedReason: string | null }> {
        if ((period.sites ?? []).some((row) => row.site?.code === locationCode)) return { site: null, blockedReason: null };
        const [site] = await this.sites.find({ where: { code: In([locationCode]) } });
        if (!site) return { site: null, blockedReason: siteMissingMessage(locationCode) };
        if (period.publishStatus !== CsiPeriodPublishStatus.PUBLISHED) return { site, blockedReason: null };
        const clashes = await this.periodService.overlaps(period.scope, [site.id], period.startDate, period.endDate, period.id, manager);
        const clash = clashes.find((item) => samePeriodTitle(item.title, period.title));
        return { site, blockedReason: clash ? overlapMessage(locationCode, clash.title) : null };
    }

    /**
     * What a new survey from these templates needs: the site of every location (template order, de-duplicated) and the
     * active HC questions. blockedReason names the first missing one (create-period throws it, preview reports it).
     */
    private async preflight(scope: ServiceScope, views: CsiTemplateView[]) {
        const wanted = [...new Set(views.map((view) => view.locationCode))];
        const found = await this.sites.find({ where: { code: In(wanted) } });
        const missing = wanted.find((code) => !found.some((site) => site.code === code));
        const questions = await this.hcQuestions(scope);
        const blockedReason = missing ? siteMissingMessage(missing) : questions.length ? null : NO_QUESTIONS_MESSAGE;
        const siteIds = missing ? [] : wanted.map((code) => found.find((site) => site.code === code)!.id);
        return { siteIds, foundSiteIds: found.map((site) => site.id), questions, blockedReason };
    }

    /**
     * Sync must never take the survey away from anyone who can answer it now: OPEN and respondent-picks surveys, and
     * LISTED surveys whose registered raters have no pairs yet ("everyone rates every PIC"), are refused.
     */
    private async blockedReason(period: CsiPeriod, repos: Repos): Promise<string | null> {
        return this.blockedReasonOf(period, await this.stateOf(repos, period.id));
    }

    private blockedReasonOf(period: CsiPeriod, state: PeriodState): string | null {
        if (period.respondentMode === CsiRespondentMode.OPEN) return BLOCKED.open;
        if (period.respondentPicks) return BLOCKED.picks;
        return state.raters.length > 0 && state.pairs.length === 0 ? BLOCKED.unmapped : null;
    }

    /** Template names of the rater accounts whose User.siteId is none of the survey sites (see ratersOutsideSites). */
    private async ratersOutside(repos: Repos, raterNames: Map<string, string>, siteIds: string[]): Promise<string[]> {
        if (!raterNames.size) return [];
        const covered = new Set(siteIds);
        const accounts = await repos.users.find({ where: { id: In([...raterNames.keys()]) }, select: { id: true, siteId: true } });
        return unique(accounts.filter((user) => !user.siteId || !covered.has(user.siteId)).map((user) => raterNames.get(user.id)!));
    }

    private async stateOf(repos: Repos, periodId: string): Promise<PeriodState> {
        const [ratees, raters, pairs] = await Promise.all([
            repos.ratees.find({ where: { periodId } }), repos.raters.find({ where: { periodId } }), repos.pairs.find({ where: { periodId } }),
        ]);
        return { ratees, raters, pairs };
    }

    /** Active scored HC questions in master order (the five star dimensions). */
    private async hcQuestions(scope: ServiceScope) {
        const rows = await this.dimensions.find({ where: { scope, isActive: true } });
        return rows.filter((row) => !NOT_SCORED.has(row.type)).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    private repos(manager: EntityManager): Repos {
        return {
            ratees: manager.getRepository(CsiPeriodRatee), rateeDims: manager.getRepository(CsiPeriodRateeDimension),
            raters: manager.getRepository(CsiPeriodRater), pairs: manager.getRepository(CsiPeriodRaterRatee), periods: manager.getRepository(CsiPeriod),
            teams: manager.getRepository(CsiTeam), members: manager.getRepository(CsiTeamMember), users: manager.getRepository(User),
            masters: manager.getRepository(CsiPic), templatePics: manager.getRepository(CsiAssignmentTemplatePic), manager,
        };
    }
}

/** Ratee snapshot of a subject: PIC fields from the master (template function as fallback), a team by its master name. */
function rateeFields(subject: Subject, templateSiteId: string | null) {
    const { row, pic, team } = subject;
    if (team) {
        return {
            kind: CsiRateeKind.TEAM, userId: null, picId: null, teamId: team.id, siteId: templateSiteId ?? team.siteId, displayName: team.name, jobTitle: null,
            serviceCode: team.serviceCode ?? row.serviceCode, bagian: null, serviceFunction: row.serviceFunction,
        };
    }
    return {
        kind: CsiRateeKind.PERSON, userId: pic!.userId, picId: pic!.id, teamId: null, siteId: templateSiteId ?? pic!.siteId, displayName: pic!.fullName, jobTitle: pic!.jobTitle,
        serviceCode: pic!.serviceCode, bagian: pic!.bagian, serviceFunction: pic!.serviceFunction ?? row.serviceFunction ?? null,
    };
}
