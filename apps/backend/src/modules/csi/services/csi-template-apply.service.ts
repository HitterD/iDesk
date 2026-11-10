import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto } from '../dto/period.dto';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiTemplatePicView, CsiTemplateView } from '../org/csi-template-view';
import { CsiAssignmentTemplateService } from './csi-assignment-template.service';
import { CsiPeriodService } from './csi-period.service';
import { assertPeriodInScope } from './csi-scope.util';

export type CsiTemplateApplyReport = {
    picsAdded: number; teamsAdded: number; ratersAdded: number; pairsAdded: number;
    /** Distinct applied rater accounts matched by name only (status ok), i.e. not yet confirmed by HC. */
    ratersUnconfirmed: number;
    picsSkippedNoRaters: string[]; picsUnmatched: string[]; ratersNoAccount: string[]; ratersAmbiguous: string[];
    /** Site code a sync adds to the survey so the template's raters can see it (null = already covered). */
    siteAdded: string | null;
    /** Why the template cannot be synced into this survey without locking people out (null = it can). */
    blockedReason: string | null;
    committed: boolean;
};
type PeriodInput = { title: string; startDate: string; endDate: string };

const BLOCKED = {
    open: 'Survei ini terbuka untuk semua user di site. Template hanya bisa dipakai di survei dengan penilai terdaftar; buat survei baru dari template.',
    picks: 'Di survei ini responden memilih PIC sendiri. Template hanya bisa dipakai di survei yang siapa-menilai-siapa ditetapkan HC.',
    unmapped: 'Survei ini memakai "semua orang menilai semua PIC" untuk penilai yang sudah terdaftar. Menambah pasangan akan menyembunyikan survei dari mereka; buat survei baru dari template.',
    cancelled: 'Survei ini sudah dibatalkan.',
} as const;
const NO_QUESTIONS_MESSAGE = 'Belum ada pertanyaan HC aktif. Buat template 5 dimensi dulu.';
const siteMissingMessage = (code: string) => `Site ${code} tidak ditemukan`;
const overlapMessage = (code: string, title: string) => `Menambah site ${code} membuat survei ini bertabrakan dengan survei "${title}" yang sudah terbit.`;
const APPLIED_STATUSES = new Set(['ok', 'confirmed']);
const NOT_SCORED = new Set<string>([CsiQuestionType.CHOICE, CsiQuestionType.TEXT]);
const unique = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

/** One rated subject of a template row: a PIC master (PERSON ratee) or an active custom team (TEAM ratee). */
type Subject = { key: string; row: CsiTemplatePicView; pic?: CsiPic; team?: CsiTeam; excluded: ReadonlySet<string> };
const picKey = (picId: string) => `pic:${picId}`;
const teamKey = (teamId: string) => `team:${teamId}`;
const rateeKey = (ratee: CsiPeriodRatee) => (ratee.kind === CsiRateeKind.TEAM ? (ratee.teamId ? teamKey(ratee.teamId) : null) : (ratee.picId ? picKey(ratee.picId) : null));

/** What one template adds; sets so several templates (and a rater in two locations) merge without double counting. */
type Tally = {
    pics: Set<string>; teams: Set<string>; raters: Set<string>; pairs: Set<string>; unconfirmed: Set<string>;
    skipped: Set<string>; unmatched: Set<string>; noAccount: Set<string>; ambiguous: Set<string>;
};
const emptyTally = (): Tally => ({
    pics: new Set(), teams: new Set(), raters: new Set(), pairs: new Set(), unconfirmed: new Set(),
    skipped: new Set(), unmatched: new Set(), noAccount: new Set(), ambiguous: new Set(),
});
const mergeTally = (into: Tally, from: Tally) => (Object.keys(into) as Array<keyof Tally>).forEach((key) => from[key].forEach((value) => into[key].add(value)));
const toReport = (tally: Tally, extra: Pick<CsiTemplateApplyReport, 'siteAdded' | 'blockedReason' | 'committed'>): CsiTemplateApplyReport => ({
    picsAdded: tally.pics.size, teamsAdded: tally.teams.size, ratersAdded: tally.raters.size, pairsAdded: tally.pairs.size,
    ratersUnconfirmed: tally.unconfirmed.size, picsSkippedNoRaters: unique(tally.skipped), picsUnmatched: unique(tally.unmatched),
    ratersNoAccount: unique(tally.noAccount), ratersAmbiguous: unique(tally.ambiguous), ...extra,
});

type Plan = {
    tally: Tally; newSubjects: Subject[]; pairs: Array<{ key: string; userId: string }>;
    /** The survey already had raters before the sync (its mode is then left alone). */
    hadRaters: boolean;
};
type Repos = {
    ratees: Repository<CsiPeriodRatee>; rateeDims: Repository<CsiPeriodRateeDimension>;
    raters: Repository<CsiPeriodRater>; pairs: Repository<CsiPeriodRaterRatee>; periods: Repository<CsiPeriod>;
    teams: Repository<CsiTeam>; members: Repository<CsiTeamMember>;
};
/** Ratees, raters and pairs already in the survey (all empty for a preview without a survey). */
type PeriodState = { ratees: CsiPeriodRatee[]; raters: CsiPeriodRater[]; pairs: CsiPeriodRaterRatee[] };
const EMPTY_STATE: PeriodState = { ratees: [], raters: [], pairs: [] };

/**
 * Puts location templates into a survey, add-only: PICs and active custom teams missing from the period become ratees
 * (with the scope's active HC questions and the service function snapshot), rater accounts become raters, and their
 * pairs are added. Nothing already in the period is removed or changed, so it also works after answers ("Sinkronkan").
 */
@Injectable()
export class CsiTemplateApplyService {
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
            const plan = await this.plan(scope, view, repos, await this.stateOf(repos, periodId));
            const missing = await this.missingSite(manager, period, view.locationCode);
            const blockedReason = period.cancelledAt ? BLOCKED.cancelled : missing.blockedReason ?? await this.blockedReason(period, repos);
            const report = toReport(plan.tally, { siteAdded: missing.site?.code ?? null, blockedReason, committed: commit });
            if (!commit) return report;
            if (blockedReason) throw new BadRequestException(blockedReason);
            if (plan.newSubjects.length && !questions.length) throw new BadRequestException(NO_QUESTIONS_MESSAGE);
            if (missing.site) await manager.getRepository(CsiPeriodSite).save({ periodId, siteId: missing.site.id });
            await this.write(manager, repos, period, plan, questions);
            return report;
        });
    }

    /**
     * Merged dry run of several location templates as if they went into one new survey; nothing is written. What
     * create-period would refuse up front (a location without site, no HC questions) is reported as blockedReason.
     */
    async previewPeriod(scope: ServiceScope, templateIds: string[]): Promise<CsiTemplateApplyReport> {
        const views = await Promise.all(templateIds.map((id) => this.templates.get(scope, id)));
        const { blockedReason } = await this.preflight(scope, views);
        return this.dataSource.transaction(async (manager) => {
            const repos = this.repos(manager);
            const total = emptyTally();
            for (const view of views) mergeTally(total, (await this.plan(scope, view, repos, EMPTY_STATE)).tally);
            return toReport(total, { siteAdded: null, blockedReason, committed: false });
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
                for (const view of views) {
                    const draft = assertPeriodInScope(await repos.periods.findOne({ where: { id: period.id } }), scope);
                    const plan = await this.plan(scope, view, repos, await this.stateOf(repos, period.id));
                    await this.write(manager, repos, draft, plan, questions);
                    mergeTally(total, plan.tally);
                }
                return toReport(total, { siteAdded: null, blockedReason: null, committed: true });
            });
            return { periodId: period.id, report };
        } catch (error) {
            await this.periodService.remove(scope, period.id).catch(() => undefined);
            throw error;
        }
    }

    private async plan(scope: ServiceScope, view: CsiTemplateView, repos: Repos, state: PeriodState): Promise<Plan> {
        const subjects = await this.subjectsOf(scope, view, repos);
        const existingRatee = new Map(state.ratees.map((row) => [rateeKey(row), row] as const).filter(([key]) => key !== null));
        const raterOfUser = new Map(state.raters.map((row) => [row.userId, row]));
        const existingPairs = new Set(state.pairs.map((row) => `${row.periodRaterId}|${row.periodRateeId}`));
        const applied = subjects.flatMap((subject) => subject.row.raters
            .filter((rater) => APPLIED_STATUSES.has(rater.status) && rater.userId && !subject.excluded.has(rater.userId))
            .map((rater) => ({ key: subject.key, userId: rater.userId!, unconfirmed: rater.status === 'ok' })));
        const fresh = applied.filter((pair) => {
            const raterId = raterOfUser.get(pair.userId)?.id;
            const rateeId = existingRatee.get(pair.key)?.id;
            return !raterId || !rateeId || !existingPairs.has(`${raterId}|${rateeId}`);
        });
        // Two template rows may name the same PIC or team: it becomes one ratee (pairs of both rows still apply).
        const newSubjects = [...new Map(subjects.filter((subject) => !existingRatee.has(subject.key)).map((subject) => [subject.key, subject])).values()];
        const tally = this.tallyOf(view, subjects, newSubjects);
        fresh.forEach((pair) => {
            tally.pairs.add(`${pair.userId}|${pair.key}`);
            if (!raterOfUser.has(pair.userId)) tally.raters.add(pair.userId);
        });
        applied.filter((pair) => pair.unconfirmed).forEach((pair) => tally.unconfirmed.add(pair.userId));
        return { tally, newSubjects, pairs: fresh, hadRaters: state.raters.length > 0 };
    }

    private tallyOf(view: CsiTemplateView, subjects: Subject[], newSubjects: Subject[]): Tally {
        const tally = emptyTally();
        const used = new Set(subjects.map((subject) => subject.row.id));
        newSubjects.forEach((subject) => (subject.team ? tally.teams : tally.pics).add(subject.key));
        view.pics.filter((row) => !row.raterCount).forEach((row) => tally.skipped.add(row.picName));
        view.pics.filter((row) => row.raterCount > 0 && !used.has(row.id)).forEach((row) => tally.unmatched.add(row.picName));
        const all = view.pics.flatMap((row) => row.raters);
        all.filter((rater) => rater.status === 'no-account').forEach((rater) => tally.noAccount.add(rater.raterName));
        all.filter((rater) => rater.status === 'ambiguous').forEach((rater) => tally.ambiguous.add(rater.raterName));
        return tally;
    }

    /**
     * Template rows with raters that can be rated: an active PIC master (the PIC never rates themself) or an active
     * custom team (its members never rate their own team). Other rows are reported as unmatched.
     */
    private async subjectsOf(scope: ServiceScope, view: CsiTemplateView, repos: Repos): Promise<Subject[]> {
        const rows = view.pics.filter((row) => row.raterCount > 0);
        const picIds = rows.flatMap((row) => (row.picId ? [row.picId] : []));
        const teamIds = rows.flatMap((row) => (!row.picId && row.teamId ? [row.teamId] : []));
        const pics = new Map((await this.org.findPics(scope, picIds)).filter((pic) => pic.isActive).map((pic) => [pic.id, pic]));
        const teams = teamIds.length ? (await repos.teams.find({ where: { id: In(teamIds), scope } })).filter((team) => team.isActive) : [];
        const teamById = new Map(teams.map((team) => [team.id, team]));
        const members = teams.length ? await repos.members.find({ where: { teamId: In(teams.map((team) => team.id)) } }) : [];
        return rows.flatMap((row): Subject[] => {
            const pic = row.picId ? pics.get(row.picId) : undefined;
            if (pic) return [{ key: picKey(pic.id), row, pic, excluded: new Set(pic.userId ? [pic.userId] : []) }];
            const team = !row.picId && row.teamId ? teamById.get(row.teamId) : undefined;
            if (!team) return [];
            const own = members.filter((member) => member.teamId === team.id && member.userId).map((member) => member.userId!);
            return [{ key: teamKey(team.id), row, team, excluded: new Set(own) }];
        });
    }

    private async write(manager: EntityManager, repos: Repos, period: CsiPeriod, plan: Plan, questions: CsiDimension[]) {
        const periodId = period.id;
        await this.writeRatees(repos, periodId, plan.newSubjects, questions);
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
        // A TEAM ratee is only shown and reported while the team section is on.
        if (plan.newSubjects.some((subject) => subject.team) && !period.teamEnabled) await manager.update(CsiPeriod, { id: periodId }, { teamEnabled: true });
    }

    private async writeRatees(repos: Repos, periodId: string, subjects: Subject[], questions: CsiDimension[]) {
        if (!subjects.length) return;
        const offset = await repos.ratees.count({ where: { periodId } });
        const saved = await repos.ratees.save(subjects.map((subject, index) => ({
            periodId, photoUrl: null, tagline: null, sortOrder: offset + index, ...rateeFields(subject),
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
        const [clash] = await this.periodService.overlaps(period.scope, [site.id], period.startDate, period.endDate, period.id, manager);
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
        return { siteIds, questions, blockedReason };
    }

    /**
     * Sync must never take the survey away from anyone who can answer it now: OPEN and respondent-picks surveys, and
     * LISTED surveys whose registered raters have no pairs yet ("everyone rates every PIC"), are refused.
     */
    private async blockedReason(period: CsiPeriod, repos: Repos): Promise<string | null> {
        if (period.respondentMode === CsiRespondentMode.OPEN) return BLOCKED.open;
        if (period.respondentPicks) return BLOCKED.picks;
        const raters = await repos.raters.count({ where: { periodId: period.id } });
        const pairs = await repos.pairs.count({ where: { periodId: period.id } });
        return raters > 0 && pairs === 0 ? BLOCKED.unmapped : null;
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
            teams: manager.getRepository(CsiTeam), members: manager.getRepository(CsiTeamMember),
        };
    }
}

/** Ratee snapshot of a subject: PIC fields from the master (template function as fallback), a team by its master name. */
function rateeFields(subject: Subject) {
    const { row, pic, team } = subject;
    if (team) {
        return {
            kind: CsiRateeKind.TEAM, userId: null, picId: null, teamId: team.id, siteId: team.siteId, displayName: team.name, jobTitle: null,
            serviceCode: team.serviceCode ?? row.serviceCode, bagian: null, serviceFunction: row.serviceFunction,
        };
    }
    return {
        kind: CsiRateeKind.PERSON, userId: pic!.userId, picId: pic!.id, teamId: null, siteId: pic!.siteId, displayName: pic!.fullName, jobTitle: pic!.jobTitle,
        serviceCode: pic!.serviceCode, bagian: pic!.bagian, serviceFunction: pic!.serviceFunction ?? row.serviceFunction ?? null,
    };
}
