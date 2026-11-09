import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { CsiPairMode, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CreatePeriodDto } from '../dto/period.dto';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiOrgService } from '../org/csi-org.service';
import { CsiTemplatePicView, CsiTemplateView } from '../org/csi-template-view';
import { CsiAssignmentTemplateService } from './csi-assignment-template.service';
import { CsiPeriodService } from './csi-period.service';
import { assertPeriodInScope } from './csi-scope.util';

export type CsiTemplateApplyReport = {
    picsAdded: number; ratersAdded: number; pairsAdded: number;
    picsSkippedNoRaters: string[]; picsUnmatched: string[]; ratersNoAccount: string[]; ratersAmbiguous: string[];
    /** Why the template cannot be synced into this survey without locking people out (null = it can). */
    blockedReason: string | null;
    committed: boolean;
};

const BLOCKED = {
    open: 'Survei ini terbuka untuk semua user di site. Template hanya bisa dipakai di survei dengan penilai terdaftar; buat survei baru dari template.',
    picks: 'Di survei ini responden memilih PIC sendiri. Template hanya bisa dipakai di survei yang siapa-menilai-siapa ditetapkan HC.',
    unmapped: 'Survei ini memakai "semua orang menilai semua PIC" untuk penilai yang sudah terdaftar. Menambah pasangan akan menyembunyikan survei dari mereka; buat survei baru dari template.',
    cancelled: 'Survei ini sudah dibatalkan.',
} as const;

/** A cancelled survey, or one whose sites do not include the template location (its raters could never see it). */
function blockedByPeriod(period: CsiPeriod, locationCode: string): string | null {
    if (period.cancelledAt) return BLOCKED.cancelled;
    const codes = (period.sites ?? []).map((row) => row.site?.code).filter(Boolean);
    return codes.includes(locationCode) ? null : `Survei ini tidak mencakup site ${locationCode}; penilai template tidak akan bisa melihatnya.`;
}
type Plan = {
    report: Omit<CsiTemplateApplyReport, 'committed'>; pics: CsiPic[]; pairs: Array<{ picId: string; userId: string }>;
    /** Service function of each PIC in the template (fallback when the PIC master has none yet). */
    templateFunctionOf: Map<string, string | null>;
    /** The survey already had raters before the sync (its mode is then left alone). */
    hadRaters: boolean;
};
type Repos = {
    ratees: Repository<CsiPeriodRatee>; rateeDims: Repository<CsiPeriodRateeDimension>;
    raters: Repository<CsiPeriodRater>; pairs: Repository<CsiPeriodRaterRatee>; periods: Repository<CsiPeriod>;
};

const NO_QUESTIONS_MESSAGE = 'Belum ada pertanyaan HC aktif. Buat template 5 dimensi dulu.';
const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const NOT_SCORED = new Set<string>([CsiQuestionType.CHOICE, CsiQuestionType.TEXT]);

/**
 * Puts a location template into a survey, add-only: PICs missing from the period become ratees (with the scope's
 * active HC questions and the service function snapshot), rater accounts become raters, and their pairs are added.
 * Nothing already in the period is removed or changed, so it also works after answers came in ("Sinkronkan").
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
            const plan = await this.plan(scope, view, periodId, repos);
            const blockedReason = blockedByPeriod(period, view.locationCode) ?? await this.blockedReason(period, repos);
            plan.report = { ...plan.report, blockedReason };
            if (!commit) return { ...plan.report, committed: false };
            if (blockedReason) throw new BadRequestException(blockedReason);
            if (plan.pics.length && !questions.length) throw new BadRequestException(NO_QUESTIONS_MESSAGE);
            await this.write(manager, repos, periodId, plan, questions);
            return { ...plan.report, committed: true };
        });
    }

    /** Draft HC period for the template's location (individual section, listed raters), then the template applied. */
    async createPeriodFromTemplate(scope: ServiceScope, templateId: string, input: { title: string; startDate: string; endDate: string }, actorId: string) {
        const view = await this.templates.get(scope, templateId);
        const site = await this.sites.findOne({ where: { code: view.locationCode } });
        if (!site) throw new BadRequestException(`Site ${view.locationCode} tidak ditemukan`);
        if (!(await this.hcQuestions(scope)).length) throw new BadRequestException(NO_QUESTIONS_MESSAGE);
        const dto: CreatePeriodDto = {
            ...input, siteIds: [site.id], respondentMode: CsiRespondentMode.LISTED, individualEnabled: true, teamEnabled: false,
        };
        const period = await this.periodService.create(scope, dto, actorId);
        try {
            const report = await this.applyToPeriod(scope, templateId, period.id, true);
            return { periodId: period.id, report };
        } catch (error) {
            // No half-built survey is left behind: the draft has no answers yet, so it can go.
            await this.periodService.remove(scope, period.id).catch(() => undefined);
            throw error;
        }
    }

    private async plan(scope: ServiceScope, view: CsiTemplateView, periodId: string, repos: Repos): Promise<Plan> {
        const withRaters = view.pics.filter((pic) => pic.raterCount > 0);
        const matched = withRaters.filter((pic): pic is CsiTemplatePicView & { picId: string } => !!pic.picId);
        const pics = (await this.org.findPics(scope, matched.map((pic) => pic.picId))).filter((pic) => pic.isActive);
        const active = new Set(pics.map((pic) => pic.id));
        const existingRatees = await repos.ratees.find({ where: { periodId } });
        const rateeOfPic = new Map(existingRatees.filter((row) => row.picId).map((row) => [row.picId!, row]));
        const existingRaters = await repos.raters.find({ where: { periodId } });
        const raterOfUser = new Map(existingRaters.map((row) => [row.userId, row]));
        const existingPairs = new Set((await repos.pairs.find({ where: { periodId } })).map((row) => `${row.periodRaterId}|${row.periodRateeId}`));
        const pairs = matched.filter((pic) => active.has(pic.picId)).flatMap((pic) => pic.raters
            .filter((rater) => rater.status === 'ok' && rater.userId)
            .map((rater) => ({ picId: pic.picId, userId: rater.userId! })))
            .filter((pair) => pics.find((pic) => pic.id === pair.picId)?.userId !== pair.userId);
        const fresh = pairs.filter((pair) => {
            const raterId = raterOfUser.get(pair.userId)?.id;
            const rateeId = rateeOfPic.get(pair.picId)?.id;
            return !raterId || !rateeId || !existingPairs.has(`${raterId}|${rateeId}`);
        });
        const all = view.pics.flatMap((pic) => pic.raters);
        return {
            pics: pics.filter((pic) => !rateeOfPic.has(pic.id)),
            pairs: fresh,
            templateFunctionOf: new Map(matched.map((pic) => [pic.picId, pic.serviceFunction])),
            hadRaters: existingRaters.length > 0,
            report: {
                blockedReason: null,
                picsAdded: pics.filter((pic) => !rateeOfPic.has(pic.id)).length,
                ratersAdded: new Set(fresh.map((pair) => pair.userId).filter((userId) => !raterOfUser.has(userId))).size,
                pairsAdded: new Set(fresh.map((pair) => `${pair.userId}|${pair.picId}`)).size,
                picsSkippedNoRaters: unique(view.pics.filter((pic) => !pic.raterCount).map((pic) => pic.picName)),
                picsUnmatched: unique(withRaters.filter((pic) => !pic.picId || !active.has(pic.picId)).map((pic) => pic.picName)),
                ratersNoAccount: unique(all.filter((rater) => rater.status === 'no-account').map((rater) => rater.raterName)),
                ratersAmbiguous: unique(all.filter((rater) => rater.status === 'ambiguous').map((rater) => rater.raterName)),
            },
        };
    }

    private async write(manager: EntityManager, repos: Repos, periodId: string, plan: Plan, questions: CsiDimension[]) {
        const offset = await repos.ratees.count({ where: { periodId } });
        const savedRatees = plan.pics.length ? await repos.ratees.save(plan.pics.map((pic, index) => ({
            periodId, kind: CsiRateeKind.PERSON, userId: pic.userId, displayName: pic.fullName, jobTitle: pic.jobTitle, siteId: pic.siteId, teamId: null,
            photoUrl: null, tagline: null, picId: pic.id, serviceCode: pic.serviceCode, bagian: pic.bagian,
            serviceFunction: pic.serviceFunction ?? plan.templateFunctionOf.get(pic.id) ?? null,
            sortOrder: offset + index,
        }))) : [];
        if (savedRatees.length) {
            await repos.rateeDims.save(savedRatees.flatMap((ratee) => questions.map((question, order) => ({
                periodRateeId: ratee.id, dimensionId: question.id, dimensionName: question.name, shortLabel: question.shortLabel ?? null,
                type: question.type, required: question.required, options: question.options, sortOrder: order,
            }))));
        }
        const rateeOfPic = new Map((await repos.ratees.find({ where: { periodId } })).filter((row) => row.picId).map((row) => [row.picId!, row.id]));
        const raterOfUser = new Map((await repos.raters.find({ where: { periodId } })).map((row) => [row.userId, row.id]));
        const newUsers = [...new Set(plan.pairs.map((pair) => pair.userId))].filter((userId) => !raterOfUser.has(userId));
        if (newUsers.length) (await repos.raters.save(newUsers.map((userId) => ({ periodId, userId })))).forEach((row) => raterOfUser.set(row.userId, row.id));
        const rows = [...new Map(plan.pairs.map((pair) => {
            const row = { periodId, periodRaterId: raterOfUser.get(pair.userId)!, periodRateeId: rateeOfPic.get(pair.picId)! };
            return [`${row.periodRaterId}|${row.periodRateeId}`, row] as const;
        })).values()];
        if (rows.length) await repos.pairs.save(rows);
        // Only an empty survey switches to the template's mode; an existing mapping already is LISTED + pairs.
        if (!plan.hadRaters) await manager.update(CsiPeriod, { id: periodId }, { respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false });
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

    /** Active scored HC questions in master order (the five star dimensions). */
    private async hcQuestions(scope: ServiceScope) {
        const rows = await this.dimensions.find({ where: { scope, isActive: true } });
        return rows.filter((row) => !NOT_SCORED.has(row.type)).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    private repos(manager: EntityManager): Repos {
        return {
            ratees: manager.getRepository(CsiPeriodRatee), rateeDims: manager.getRepository(CsiPeriodRateeDimension),
            raters: manager.getRepository(CsiPeriodRater), pairs: manager.getRepository(CsiPeriodRaterRatee), periods: manager.getRepository(CsiPeriod),
        };
    }
}

