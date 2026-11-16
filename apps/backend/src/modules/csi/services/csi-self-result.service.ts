import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiPairMode, CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode, CsiTeamKind } from '../csi.constants';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { normalizeName } from '../org/csi-name-match';
import { normalizeNik } from '../org/csi-org.constants';
import { computeStatus, CsiPeriodStatus } from './csi-period.service';
import { ratedAccountOf } from './csi-ratee-owner.util';
import { CsiReminderService } from './csi-reminder.service';
import { bandsOf, CsiScoreBands } from './csi-score-bands';

/** Results stay hidden until this many people rated the person, so no single rater can be singled out. */
export const CSI_SELF_RESULT_MIN_RATERS = 3;
export const CSI_TEAM_SELF_RESULT_MIN_RATERS = 1;
export const CSI_RANDOM = Symbol('CSI_RANDOM');
const NOT_SCORED = new Set<string>([CsiQuestionType.CHOICE, CsiQuestionType.TEXT]);
const NOT_FOUND_MESSAGE = 'Hasil penilaian tidak ditemukan';
const NOT_ACTIVE_MESSAGE = 'Pengingat hanya dapat dikirim saat survei sedang berjalan';
const LISTED_ONLY_MESSAGE = 'Pengingat hanya tersedia untuk survei dengan penilai terpilih';

export type CsiSelfResult = {
    periodRateeId: string;
    periodId: string; title: string; startDate: string; endDate: string; status: CsiPeriodStatus;
    serviceFunction: string | null; teamName: string | null;
    raters: number; expectedRaters: number | null; minRaters: number; ready: boolean;
    /** Colour bands of the survey (always sent, also before the results are ready). */
    scoreBands: CsiScoreBands;
    average: number | null; dimensions: Array<{ label: string; average: number }>; comments: string[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => (values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

/** Fisher–Yates with an injectable random source (tests pin it). */
function shuffled<T>(rows: T[], random: () => number): T[] {
    const copy = [...rows];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
}

/**
 * "Hasil penilaian saya" (HC, and ICT surveys created with selfResults): what people rated about the
 * signed-in account, live while the survey runs. Never carries a rater's name, unit, answer id or date;
 * scores and comments only appear from CSI_SELF_RESULT_MIN_RATERS raters on.
 */
@Injectable()
export class CsiSelfResultService {
    constructor(
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRateeDimension) private readonly dimensions: Repository<CsiPeriodRateeDimension>,
        @InjectRepository(CsiResponseItem) private readonly items: Repository<CsiResponseItem>,
        @InjectRepository(CsiResponseComment) private readonly comments: Repository<CsiResponseComment>,
        @InjectRepository(CsiPic) private readonly pics: Repository<CsiPic>,
        @Optional() @Inject(CSI_RANDOM) private readonly random: () => number = Math.random,
        @InjectRepository(CsiTeamMember) private readonly members: Repository<CsiTeamMember>,
        @Optional() @InjectRepository(CsiPeriodRater) private readonly periodRaters?: Repository<CsiPeriodRater>,
        @Optional() @InjectRepository(CsiPeriodRaterRatee) private readonly pairs?: Repository<CsiPeriodRaterRatee>,
        @Optional() @InjectRepository(User) private readonly users?: Repository<User>,
        @Optional() private readonly reminders?: CsiReminderService,
    ) { }

    async list(userId: string, now: Date = new Date()): Promise<CsiSelfResult[]> {
        const { rows, linkedByPic } = await this.ownedRatees(userId);
        const targetByRatee = await this.assignedRaterUserIdsByRatee(rows, linkedByPic);
        const results = await Promise.all(rows.map((row) => this.resultOf(row, targetByRatee.get(row.id) ?? null, now)));
        return results.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }

    /** Sends anonymous in-app + Web Push reminders (deduped 24h) to assigned raters who have not filled yet. */
    async remindRaters(userId: string, periodRateeId: string, now: Date = new Date()): Promise<{ reminded: boolean }> {
        const { rows, linkedByPic } = await this.ownedRatees(userId);
        const ratee = rows.find((row) => row.id === periodRateeId);
        if (!ratee) throw new NotFoundException(NOT_FOUND_MESSAGE);
        if (computeStatus(ratee.period, now) !== 'ACTIVE') throw new BadRequestException(NOT_ACTIVE_MESSAGE);
        if (ratee.period.respondentMode !== CsiRespondentMode.LISTED) throw new BadRequestException(LISTED_ONLY_MESSAGE);
        const targetByRatee = await this.assignedRaterUserIdsByRatee([ratee], linkedByPic);
        const targets = targetByRatee.get(ratee.id) ?? [];
        if (!targets.length || !this.reminders) return { reminded: false };
        const result = await this.reminders.send(ratee.period.scope, ratee.period.id, targets, now);
        return { reminded: result.sent > 0 };
    }

    /** Resolves and returns published non-cancelled ratees owned by `userId` (personal first, then custom teams). */
    private async ownedRatees(userId: string): Promise<{ rows: CsiPeriodRatee[]; linkedByPic: Map<string, string | null> }> {
        const picIds = await this.resolveOwnedPicIds(userId);
        // Load direct member rows without nested relation filters so TypeORM OR-joins never drop matches.
        const memberRows = await this.members.find({ where: { userId }, relations: { team: true } });
        const teamIds = memberRows
            .filter((member) => !member.team || member.team.kind === CsiTeamKind.CUSTOM)
            .map((member) => member.teamId);
        const rawRows = (await this.ratees.find({
            where: [
                { kind: CsiRateeKind.PERSON, userId },
                ...(picIds.length ? [{ kind: CsiRateeKind.PERSON, picId: In(picIds) }] : []),
                ...(teamIds.length ? [{ kind: CsiRateeKind.TEAM, teamId: In(teamIds) }] : []),
            ],
            relations: { period: { sites: true }, team: true },
        }))
            .filter((row) => row.period?.publishStatus === CsiPeriodPublishStatus.PUBLISHED)
            .filter((row) => row.period?.scope === ServiceScope.HC || (row.period?.scope === ServiceScope.ICT && row.period.selfResults === true))
            .filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);
        const rowPicIds = [...new Set(rawRows.map((row) => row.picId).filter((id): id is string => !!id))];
        const rowPics = rowPicIds.length ? await this.pics.find({ where: { id: In(rowPicIds) }, select: { id: true, userId: true } }) : [];
        const linkedByPic = new Map(rowPics.map((pic) => [pic.id, pic.userId ?? null]));
        const rows = rawRows
            .filter((row) => row.kind === CsiRateeKind.TEAM
                ? row.team?.kind === CsiTeamKind.CUSTOM && teamIds.includes(row.teamId!)
                : ratedAccountOf(row, linkedByPic) === userId)
            .filter((row) => row.period && !row.period.cancelledAt
                && (row.kind === CsiRateeKind.TEAM ? row.period.teamEnabled === true : row.period.individualEnabled !== false));
        const ordered = [...rows.filter((row) => row.kind !== CsiRateeKind.TEAM), ...rows.filter((row) => row.kind === CsiRateeKind.TEAM)];
        return { rows: ordered, linkedByPic };
    }

    /**
     * Reconciles unlinked (or inactive-user-linked) HC PICs when the signed-in active user matches by normalised
     * NIK (`employeeId === pic.nik`) or uniquely by normalised full name across active users & HC PICs.
     */
    private async resolveOwnedPicIds(userId: string): Promise<string[]> {
        const direct = (await this.pics.find({ where: { userId }, select: { id: true } })).map((pic) => pic.id);
        if (direct.length || !this.users) return direct;
        const viewer = await this.users.findOne({ where: { id: userId }, select: { id: true, fullName: true, employeeId: true, isActive: true } });
        if (!viewer || viewer.isActive === false) return direct;

        const hcPics = await this.pics.find({ where: { scope: ServiceScope.HC }, relations: { user: true } });
        if (hcPics.some((pic) => pic.userId === userId)) return hcPics.filter((pic) => pic.userId === userId).map((pic) => pic.id);

        const eligible = (pic: CsiPic) => !pic.userId || pic.user?.isActive === false;
        const viewerNik = normalizeNik(viewer.employeeId);
        let matched = viewerNik ? hcPics.find((pic) => eligible(pic) && normalizeNik(pic.nik) === viewerNik) : undefined;

        if (!matched) {
            const viewerName = normalizeName(viewer.fullName ?? '');
            const namedPics = viewerName ? hcPics.filter((pic) => normalizeName(pic.fullName) === viewerName) : [];
            if (namedPics.length === 1 && eligible(namedPics[0])) {
                const activeUsers = await this.users.find({ where: { isActive: true }, select: { id: true, fullName: true } });
                const matchingUsers = activeUsers.filter((account) => normalizeName(account.fullName ?? '') === viewerName);
                if (matchingUsers.length === 1 && matchingUsers[0].id === userId) matched = namedPics[0];
            }
        }
        if (!matched) return direct;

        const { user: _staleUser, ...picRow } = matched;
        await this.pics.save({ ...picRow, userId }).catch(() => undefined);
        return [matched.id];
    }

    /** Computes assigned active rater userIds per ratee (`null` for OPEN periods without fixed raters). */
    private async assignedRaterUserIdsByRatee(
        rows: CsiPeriodRatee[],
        linkedByPic: ReadonlyMap<string, string | null>,
    ): Promise<Map<string, string[] | null>> {
        const result = new Map<string, string[] | null>();
        const byPeriod = new Map<string, CsiPeriodRatee[]>();
        for (const row of rows) byPeriod.set(row.periodId, [...(byPeriod.get(row.periodId) ?? []), row]);

        for (const [periodId, group] of byPeriod) {
            const period = group[0].period;
            if (period.respondentMode !== CsiRespondentMode.LISTED || !this.periodRaters) {
                group.forEach((ratee) => result.set(ratee.id, null));
                continue;
            }
            const raters = await this.periodRaters.find({ where: { periodId }, relations: { user: true } });
            const hasSites = Array.isArray(period.sites);
            const siteIds = (period.sites ?? []).map((row) => row.siteId);
            const activeRaters = raters.filter((rater) => {
                if (!rater.user) return !hasSites;
                if (rater.user.isActive === false) return false;
                return hasSites ? Boolean(rater.user.siteId && siteIds.includes(rater.user.siteId)) : true;
            });
            const raterUserById = new Map(activeRaters.map((rater) => [rater.id, rater.userId]));
            const allActiveUserIds = [...new Set(activeRaters.map((rater) => rater.userId))];

            const pairs = this.pairs && period.pairMode !== CsiPairMode.ALL
                ? await this.pairs.find({ where: { periodId } })
                : [];
            const isMapped = period.pairMode === CsiPairMode.CUSTOM || pairs.length > 0;

            for (const ratee of group) {
                const ownerId = ratee.kind === CsiRateeKind.PERSON ? ratedAccountOf(ratee, linkedByPic) : null;
                const rawUserIds = isMapped
                    ? pairs.filter((pair) => pair.periodRateeId === ratee.id)
                        .map((pair) => raterUserById.get(pair.periodRaterId))
                        .filter((id): id is string => Boolean(id))
                    : allActiveUserIds;
                result.set(ratee.id, [...new Set(rawUserIds)].filter((id) => id !== ownerId));
            }
        }
        return result;
    }

    private async resultOf(ratee: CsiPeriodRatee, targetUserIds: string[] | null, now: Date): Promise<CsiSelfResult> {
        const questions = (await this.dimensions.find({ where: { periodRateeId: ratee.id } }))
            .filter((row) => !NOT_SCORED.has(row.type ?? CsiQuestionType.STAR))
            .sort((a, b) => a.sortOrder - b.sortOrder);
        const scored = questions.length
            ? (await this.items.find({ where: { periodRateeId: ratee.id, periodRateeDimensionId: In(questions.map((row) => row.id)) } }))
                .filter((item) => item.score !== null && item.score !== undefined)
            : [];
        const byResponse = new Map<string, number[]>();
        scored.forEach((item) => byResponse.set(item.responseId, [...(byResponse.get(item.responseId) ?? []), item.score!]));
        const raters = byResponse.size;
        const expectedRaters = targetUserIds === null ? null : targetUserIds.length;
        const minRaters = ratee.kind === CsiRateeKind.TEAM ? CSI_TEAM_SELF_RESULT_MIN_RATERS : CSI_SELF_RESULT_MIN_RATERS;
        const ready = raters >= minRaters;
        const { period } = ratee;
        const base = {
            periodRateeId: ratee.id,
            periodId: period.id, title: period.title, startDate: period.startDate, endDate: period.endDate, status: computeStatus(period, now),
            serviceFunction: ratee.serviceFunction ?? null,
            teamName: ratee.kind === CsiRateeKind.TEAM ? ratee.team?.name ?? ratee.displayName : null,
            raters, expectedRaters, minRaters, ready, scoreBands: bandsOf(period),
        };
        if (!ready) return { ...base, average: null, dimensions: [], comments: [] };
        const dimensions = questions.flatMap((question) => {
            const average = mean(scored.filter((item) => item.periodRateeDimensionId === question.id).map((item) => item.score!));
            return average === null ? [] : [{ label: question.shortLabel || question.dimensionName, average }];
        });
        const average = mean([...byResponse.values()].map((scores) => mean(scores)!));
        const texts = (await this.comments.find({ where: { periodRateeId: ratee.id } })).map((row) => row.comment.trim()).filter(Boolean);
        return { ...base, average, dimensions, comments: shuffled(texts, this.random) };
    }
}
