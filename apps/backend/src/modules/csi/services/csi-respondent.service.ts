import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { User } from '../../users/entities/user.entity';
import {
    CSI_ANSWER_TEXT_MAX, CSI_COMMENT_MAX, CSI_OPTION_LABEL_MAX, CSI_RESPONDENT_NAME_MAX, CSI_RESPONDENT_NAME_MIN, CSI_SCORE_MAX, CSI_SCORE_MIN,
    CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode,
} from '../csi.constants';
import { SubmitResponseDto } from '../dto/submit.dto';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { computeStatus, lockPeriodRow } from './csi-period.service';

/** Only the user id is taken from the token; site and active flag are always re-read from the database. */
export type CsiRespondentRef = { id: string };

const NOT_FOUND_MESSAGE = 'Survei tidak ditemukan';
const ENDED_MESSAGE = 'Periode penilaian sudah berakhir';
const NAME_TAKEN_MESSAGE = 'Nama ini sudah mengisi survei ini';
const WRONG_TYPE_MESSAGE = 'Jawaban tidak sesuai jenis pertanyaan ini';
const REQUIRED_MESSAGE = 'Semua pertanyaan wajib harus dijawab';
const NAME_LENGTH_MESSAGE = `Nama harus ${CSI_RESPONDENT_NAME_MIN}–${CSI_RESPONDENT_NAME_MAX} karakter`;
const PG_UNIQUE_VIOLATION = '23505';

type Respondent = Pick<User, 'id' | 'fullName' | 'siteId'>;
type Audience = { respondent: Respondent; ratees: CsiPeriodRatee[]; dimensions: CsiPeriodRateeDimension[] };
type ResolvedItem = { dimension: CsiPeriodRateeDimension; score: number | null; answerLabel: string | null; answerText: string | null };
type CommentRow = { periodRateeId: string; comment: string };
/** Repositories for assignment reads; inside the submit transaction they come from its EntityManager. */
type AssignmentReaders = {
    periodRaters: Repository<CsiPeriodRater>;
    ratees: Repository<CsiPeriodRatee>;
    rateeDimensions: Repository<CsiPeriodRateeDimension>;
    departments: Repository<CsiDepartment>;
};

const readersOf = (manager: EntityManager): AssignmentReaders => ({
    periodRaters: manager.getRepository(CsiPeriodRater),
    ratees: manager.getRepository(CsiPeriodRatee),
    rateeDimensions: manager.getRepository(CsiPeriodRateeDimension),
    departments: manager.getRepository(CsiDepartment),
});

@Injectable()
export class CsiRespondentService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectRepository(CsiPeriodRateeDimension) private readonly rateeDimensions: Repository<CsiPeriodRateeDimension>,
        @InjectRepository(CsiPeriodRater) private readonly periodRaters: Repository<CsiPeriodRater>,
        @InjectRepository(CsiResponse) private readonly responses: Repository<CsiResponse>,
        @InjectRepository(CsiDepartment) private readonly departments: Repository<CsiDepartment>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(CsiDimension) private readonly dimensions: Repository<CsiDimension>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    private get readers(): AssignmentReaders {
        return { periodRaters: this.periodRaters, ratees: this.ratees, rateeDimensions: this.rateeDimensions, departments: this.departments };
    }

    async listActive(user: CsiRespondentRef, now: Date = new Date()) {
        const respondent = await this.loadRespondent(user.id);
        if (!respondent) return [];
        // Narrow to periods covering today's WIB date; computeStatus stays the authoritative check.
        const today = localDateKey(now, DEFAULT_TIMEZONE);
        // Filtering on `sites` while also loading it would truncate the loaded relation to the respondent's site,
        // so match ids first and then load those periods with all their sites.
        const matching = await this.periods.find({
            where: {
                sites: { siteId: respondent.siteId }, publishStatus: CsiPeriodPublishStatus.PUBLISHED,
                startDate: LessThanOrEqual(today), endDate: MoreThanOrEqual(today),
            },
            select: { id: true },
        });
        const candidates = matching.length ? await this.periods.find({
            where: { id: In(matching.map((row) => row.id)) }, relations: { sites: true }, order: { startDate: 'DESC' },
        }) : [];
        const result: Array<{ id: string; scope: CsiPeriod['scope']; title: string; submitted: boolean }> = [];
        for (const period of candidates) {
            if (computeStatus(period, now) !== 'ACTIVE' || !(await this.audienceFor(this.readers, respondent, period))) continue;
            result.push({ id: period.id, scope: period.scope, title: period.title, submitted: (await this.submittedNames(period.id, respondent.id)).length > 0 });
        }
        return result;
    }

    async getForm(user: CsiRespondentRef, periodId: string, now: Date = new Date()) {
        const { period, audience } = await this.resolveEligible(user, periodId);
        if (computeStatus(period, now) !== 'ACTIVE') throw new NotFoundException(NOT_FOUND_MESSAGE);
        const [departments, avatars, submittedNames] = await Promise.all([
            this.departments.find({ where: { scope: period.scope, isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
            this.avatarsOf(audience.ratees),
            this.submittedNames(period.id, audience.respondent.id),
        ]);
        const descriptions = await this.descriptionsOf(audience.dimensions);
        return {
            id: period.id, scope: period.scope, title: period.title, intro: period.intro, endDate: period.endDate,
            teamLabel: period.teamLabel,
            respondent: { fullName: audience.respondent.fullName },
            submittedNames,
            departments: departments.map((department) => ({ id: department.id, name: department.name })),
            ratees: audience.ratees.map((ratee) => ({
                periodRateeId: ratee.id, kind: ratee.kind ?? CsiRateeKind.PERSON, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
                avatarUrl: ratee.userId ? avatars.get(ratee.userId) ?? null : null,
                dimensions: audience.dimensions.filter((row) => row.periodRateeId === ratee.id).map((row) => ({
                    periodRateeDimensionId: row.id, name: row.dimensionName, description: descriptions.get(row.dimensionId) ?? null,
                    type: row.type, required: row.required, options: row.options ?? [],
                })),
            })),
        };
    }

    async submit(user: CsiRespondentRef, periodId: string, dto: SubmitResponseDto, now: Date = new Date()) {
        const { period, audience } = await this.resolveEligible(user, periodId);
        assertSubmittable(period, now);
        const respondentId = audience.respondent.id;
        const respondentName = normalizeName(dto.respondentName);
        try {
            await this.dataSource.transaction(async (manager) => {
                // FOR SHARE: submits for one period don't queue behind each other, while admin edits
                // (FOR UPDATE on the same row) cannot change what we validate against until we commit.
                const locked = await lockPeriodRow(manager, period.id, 'pessimistic_read');
                if (!locked) throw new NotFoundException(NOT_FOUND_MESSAGE);
                assertSubmittable(locked, now);
                const existing = await manager.getRepository(CsiResponse).find({ where: { periodId: period.id, respondentId } });
                if (existing.some((row) => nameKey(row.respondentName) === nameKey(respondentName))) throw new ConflictException(NAME_TAKEN_MESSAGE);
                // All reads go through the transaction's connection: a submit holds exactly one pooled connection.
                const readers = readersOf(manager);
                // The locked row carries no relations and admins can edit the period sites: re-read them after the lock.
                const sites = await manager.getRepository(CsiPeriodSite).find({ where: { periodId: period.id } });
                const current = await this.audienceFor(readers, audience.respondent, { ...locked, sites });
                if (!current) throw new NotFoundException(NOT_FOUND_MESSAGE);
                const department = await readers.departments.findOne({ where: { id: dto.departmentId, scope: locked.scope, isActive: true } });
                if (!department) throw new BadRequestException('Departemen tidak ditemukan atau tidak aktif');
                const items = validateItems(dto.items ?? [], current.dimensions);
                const comments = validateComments(dto.comments ?? [], current.ratees);
                await this.writeResponse(manager, { periodId: period.id, respondentId, respondentName, department, items, comments, now });
            });
        } catch (error) {
            if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
                throw new ConflictException(NAME_TAKEN_MESSAGE);
            }
            throw error;
        }
        return { submitted: true as const, thankYou: period.thankYou };
    }

    /** 404 unless the period exists and the user is in its audience (status is checked by the caller). */
    private async resolveEligible(user: CsiRespondentRef, periodId: string): Promise<{ period: CsiPeriod; audience: Audience }> {
        const respondent = await this.loadRespondent(user.id);
        const period = respondent ? await this.periods.findOne({ where: { id: periodId }, relations: { sites: true } }) : null;
        const audience = period ? await this.audienceFor(this.readers, respondent!, period) : null;
        if (!period || !audience) throw new NotFoundException(NOT_FOUND_MESSAGE);
        return { period, audience };
    }

    /** Active user with a site (null site is never eligible: fail-closed). */
    private async loadRespondent(userId: string): Promise<Respondent | null> {
        const user = await this.users.findOne({ where: { id: userId }, select: { id: true, fullName: true, siteId: true, isActive: true } });
        return user && user.isActive && user.siteId ? { id: user.id, fullName: user.fullName, siteId: user.siteId } : null;
    }

    /**
     * Published, site match, rater membership for LISTED mode, and at least one visible ratee with questions.
     * Visible: the TEAM ratee only while the team section is enabled (never self-excluded), PERSON ratees only
     * while the individual section is enabled and never the respondent themself.
     * A draft period behaves exactly like a missing one; submit calls this with the locked row.
     */
    private async audienceFor(readers: AssignmentReaders, respondent: Respondent, period: CsiPeriod): Promise<Audience | null> {
        const coversSite = (period.sites ?? []).some((row) => row.siteId === respondent.siteId);
        if (period.publishStatus !== CsiPeriodPublishStatus.PUBLISHED || !coversSite) return null;
        if (period.respondentMode !== CsiRespondentMode.OPEN) {
            const rater = await readers.periodRaters.findOne({ where: { periodId: period.id, userId: respondent.id } });
            if (!rater) return null;
        }
        const rows = await readers.ratees.find({ where: { periodId: period.id }, order: { sortOrder: 'ASC' } });
        const visible = rows.filter((ratee) => isRateeVisible(ratee, period, respondent.id));
        if (!visible.length) return null;
        const dimensions = await this.dimensionsOf(readers, visible);
        const withQuestions = new Set(dimensions.map((row) => row.periodRateeId));
        const ratees = visible.filter((ratee) => withQuestions.has(ratee.id)).sort(teamFirst);
        return ratees.length ? { respondent, ratees, dimensions } : null;
    }

    private dimensionsOf(readers: AssignmentReaders, ratees: CsiPeriodRatee[]) {
        return readers.rateeDimensions.find({
            where: { periodRateeId: In(ratees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        });
    }

    /** Current avatar per ratee user (one query); ratee rows only snapshot name and job title. */
    private async avatarsOf(ratees: CsiPeriodRatee[]) {
        const userIds = ratees.map((ratee) => ratee.userId).filter((id): id is string => id !== null);
        const rows = await this.users.find({ where: { id: In([...new Set(userIds)]) }, select: { id: true, avatarUrl: true } });
        return new Map(rows.map((user) => [user.id, user.avatarUrl ?? null]));
    }

    /** Current master description per dimension id (one query); a deleted master yields no entry. */
    private async descriptionsOf(dimensions: CsiPeriodRateeDimension[]) {
        const ids = [...new Set(dimensions.map((row) => row.dimensionId))];
        if (!ids.length) return new Map<string, string | null>();
        const rows = await this.dimensions.find({ where: { id: In(ids) }, select: { id: true, description: true } });
        return new Map(rows.map((dimension) => [dimension.id, dimension.description ?? null]));
    }

    /** Display names this account already answered the period with, oldest first. */
    private async submittedNames(periodId: string, respondentId: string): Promise<string[]> {
        const rows = await this.responses.find({ where: { periodId, respondentId }, order: { submittedAt: 'ASC' } });
        return rows.map((row) => row.respondentName);
    }

    private async writeResponse(manager: EntityManager, input: {
        periodId: string; respondentId: string; respondentName: string; department: CsiDepartment;
        items: ResolvedItem[]; comments: CommentRow[]; now: Date;
    }) {
        const response = await manager.save(CsiResponse, {
            periodId: input.periodId, respondentId: input.respondentId, respondentName: input.respondentName,
            departmentId: input.department.id, departmentName: input.department.name, submittedAt: input.now,
        });
        await manager.save(CsiResponseItem, input.items.map(({ dimension, score, answerLabel, answerText }) => ({
            responseId: response.id, periodRateeId: dimension.periodRateeId, periodRateeDimensionId: dimension.id, score, answerLabel, answerText,
        })));
        if (input.comments.length) {
            await manager.save(CsiResponseComment, input.comments.map((row) => ({ responseId: response.id, ...row })));
        }
    }
}

function assertSubmittable(period: CsiPeriod, now: Date) {
    const status = computeStatus(period, now);
    if (status === 'ENDED') throw new GoneException(ENDED_MESSAGE);
    if (status !== 'ACTIVE') throw new NotFoundException(NOT_FOUND_MESSAGE);
}

const has = (value: unknown) => value !== undefined && value !== null;
const isTeam = (ratee: CsiPeriodRatee) => ratee.kind === CsiRateeKind.TEAM;
const teamFirst = (a: CsiPeriodRatee, b: CsiPeriodRatee) => Number(isTeam(b)) - Number(isTeam(a));

function isRateeVisible(ratee: CsiPeriodRatee, period: CsiPeriod, respondentId: string) {
    if (isTeam(ratee)) return period.teamEnabled === true;
    return period.individualEnabled !== false && ratee.userId !== respondentId;
}

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');
const nameKey = (name: string) => collapseSpaces(name).toLowerCase();

/** Trimmed, whitespace-collapsed display name; 2–150 characters. */
function normalizeName(raw: unknown): string {
    const name = typeof raw === 'string' ? collapseSpaces(raw) : '';
    if (name.length < CSI_RESPONDENT_NAME_MIN || name.length > CSI_RESPONDENT_NAME_MAX) throw new BadRequestException(NAME_LENGTH_MESSAGE);
    return name;
}

/** Resolves one answer against the question snapshot; null means "TEXT left empty" (treated as omitted). */
function resolveAnswer(dimension: CsiPeriodRateeDimension, item: SubmitResponseDto['items'][number]): ResolvedItem | null {
    const { score, optionIndex, text } = item;
    const base: ResolvedItem = { dimension, score: null, answerLabel: null, answerText: null };
    switch (dimension.type ?? CsiQuestionType.STAR) {
        case CsiQuestionType.STAR:
            if (has(optionIndex) || has(text) || !has(score)) throw new BadRequestException(WRONG_TYPE_MESSAGE);
            if (!Number.isInteger(score) || score! < CSI_SCORE_MIN || score! > CSI_SCORE_MAX) {
                throw new BadRequestException(`Nilai harus berupa bilangan bulat ${CSI_SCORE_MIN}–${CSI_SCORE_MAX}`);
            }
            return { ...base, score: score! };
        case CsiQuestionType.SCALE:
        case CsiQuestionType.CHOICE: {
            if (has(score) || has(text) || !has(optionIndex)) throw new BadRequestException(WRONG_TYPE_MESSAGE);
            const option = Number.isInteger(optionIndex) ? (dimension.options ?? [])[optionIndex!] : undefined;
            if (!option) throw new BadRequestException('Pilihan jawaban tidak valid');
            const answerLabel = option.label.slice(0, CSI_OPTION_LABEL_MAX);
            return dimension.type === CsiQuestionType.SCALE ? { ...base, score: option.points, answerLabel } : { ...base, answerLabel };
        }
        case CsiQuestionType.TEXT: {
            if (has(score) || has(optionIndex) || typeof text !== 'string') throw new BadRequestException(WRONG_TYPE_MESSAGE);
            const answerText = text.trim();
            if (answerText.length > CSI_ANSWER_TEXT_MAX) throw new BadRequestException(`Jawaban teks maksimal ${CSI_ANSWER_TEXT_MAX} karakter`);
            return answerText ? { ...base, answerText } : null;
        }
        default:
            throw new BadRequestException(WRONG_TYPE_MESSAGE);
    }
}

/** Items must reference known, distinct snapshot questions; every required question needs an answer. */
function validateItems(items: SubmitResponseDto['items'], dimensions: CsiPeriodRateeDimension[]): ResolvedItem[] {
    const expected = new Map(dimensions.map((dimension) => [dimension.id, dimension]));
    const seen = new Set<string>();
    const resolved = items.flatMap((item) => {
        const dimension = expected.get(item.periodRateeDimensionId);
        if (!dimension || seen.has(item.periodRateeDimensionId)) throw new BadRequestException('Nilai berisi dimensi yang tidak valid atau duplikat');
        seen.add(item.periodRateeDimensionId);
        const answer = resolveAnswer(dimension, item);
        return answer ? [answer] : [];
    });
    const answered = new Set(resolved.map(({ dimension }) => dimension.id));
    if (dimensions.some((dimension) => dimension.required !== false && !answered.has(dimension.id))) throw new BadRequestException(REQUIRED_MESSAGE);
    return resolved;
}

/** Trims comments, drops empty ones, and rejects unknown or duplicate ratees and over-long text. */
function validateComments(comments: NonNullable<SubmitResponseDto['comments']>, ratees: CsiPeriodRatee[]): CommentRow[] {
    const visible = new Set(ratees.map((ratee) => ratee.id));
    const seen = new Set<string>();
    return comments.flatMap(({ periodRateeId, comment }) => {
        if (!visible.has(periodRateeId) || seen.has(periodRateeId)) throw new BadRequestException('Komentar berisi orang yang tidak valid atau duplikat');
        seen.add(periodRateeId);
        const text = typeof comment === 'string' ? comment.trim() : '';
        if (text.length > CSI_COMMENT_MAX) throw new BadRequestException(`Komentar maksimal ${CSI_COMMENT_MAX} karakter`);
        return text ? [{ periodRateeId, comment: text }] : [];
    });
}
