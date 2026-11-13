import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { User } from '../../users/entities/user.entity';
import {
    CSI_ANSWER_TEXT_MAX, CSI_COMMENT_MAX, CSI_OPTION_LABEL_MAX, CSI_RESPONDENT_NAME_MAX, CSI_SCORE_MAX, CSI_SCORE_MIN,
    CsiPeriodPublishStatus, CsiQuestionType, CsiRateeKind, CsiRespondentMode,
} from '../csi.constants';
import { CSI_DEPARTMENT_SEPARATOR } from '../csi-departments.data';
import { SubmitResponseDto } from '../dto/submit.dto';
import { CsiDepartment } from '../entities/csi-department.entity';
import { CsiDimension } from '../entities/csi-dimension.entity';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriodSite } from '../entities/csi-period-site.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseComment } from '../entities/csi-response-comment.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { CsiAssignmentService } from './csi-assignment.service';
import { lockPeriodRow } from './csi-period-lock.util';
import { computeStatus } from './csi-period.service';
import { CsiRateeView, CsiSubjectService } from './csi-subject.service';
import { CsiOrgService, CsiRespondentOrg } from '../org/csi-org.service';
import { normalizeBagian, serviceName } from '../org/csi-org.constants';

/** Only the user id is taken from the token; site and active flag are always re-read from the database. */
export type CsiRespondentRef = { id: string };

const NOT_FOUND_MESSAGE = 'Survei tidak ditemukan';
const ENDED_MESSAGE = 'Periode penilaian sudah berakhir';
const ALREADY_SUBMITTED_MESSAGE = 'Anda sudah mengisi survei ini';
const DEPARTMENT_LOCKED_MESSAGE = 'Departemen Anda sudah terkunci dan tidak dapat diubah';
const WRONG_TYPE_MESSAGE = 'Jawaban tidak sesuai jenis pertanyaan ini';
const OPTION_POINTS_MESSAGE = 'Pilihan tidak memiliki nilai yang valid';
const REQUIRED_MESSAGE = 'Semua pertanyaan wajib harus dijawab';
const PICK_ONE_MESSAGE = 'Pilih dan nilai minimal satu PIC';
const PG_UNIQUE_VIOLATION = '23505';

type Respondent = Pick<User, 'id' | 'fullName' | 'siteId'> & { profileDepartment: string | null; org?: CsiRespondentOrg };
type DepartmentRow = Pick<CsiDepartment, 'id' | 'name'>;
type Audience = { respondent: Respondent; ratees: CsiPeriodRatee[]; dimensions: CsiPeriodRateeDimension[] };
type ResolvedItem = { dimension: CsiPeriodRateeDimension; score: number | null; answerLabel: string | null; answerText: string | null };
type CommentRow = { periodRateeId: string; comment: string };
/** Repositories for assignment reads; inside the submit transaction they come from its EntityManager. */
type AssignmentReaders = {
    periodRaters: Repository<CsiPeriodRater>;
    ratees: Repository<CsiPeriodRatee>;
    rateeDimensions: Repository<CsiPeriodRateeDimension>;
    departments: Repository<CsiDepartment>;
    /** Only set inside the submit transaction (outside it, CsiAssignmentService reads the pairs). */
    pairs?: Repository<CsiPeriodRaterRatee>;
};

const readersOf = (manager: EntityManager): AssignmentReaders => ({
    periodRaters: manager.getRepository(CsiPeriodRater),
    ratees: manager.getRepository(CsiPeriodRatee),
    rateeDimensions: manager.getRepository(CsiPeriodRateeDimension),
    departments: manager.getRepository(CsiDepartment),
    pairs: manager.getRepository(CsiPeriodRaterRatee),
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
        private readonly assignments: CsiAssignmentService,
        private readonly subjects: CsiSubjectService,
        private readonly org: CsiOrgService,
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
        const result: Array<{ id: string; scope: CsiPeriod['scope']; title: string; intro: string; endDate: string; submitted: boolean; submittedAt: Date | null }> = [];
        for (const period of candidates) {
            if (computeStatus(period, now) !== 'ACTIVE' || !(await this.audienceFor(this.readers, respondent, period))) continue;
            const submittedAt = await this.submittedAt(period.id, respondent.id);
            result.push({ id: period.id, scope: period.scope, title: period.title, intro: period.intro, endDate: period.endDate, submitted: submittedAt !== null, submittedAt });
        }
        return result;
    }

    async getForm(user: CsiRespondentRef, periodId: string, now: Date = new Date()) {
        const { period, audience } = await this.resolveEligible(user, periodId);
        if (computeStatus(period, now) !== 'ACTIVE') throw new NotFoundException(NOT_FOUND_MESSAGE);
        const [departments, views, submittedAt] = await Promise.all([
            this.departments.find({ where: { scope: period.scope, isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
            this.subjects.viewsFor(period.scope, audience.ratees),
            this.submittedAt(period.id, audience.respondent.id),
        ]);
        const [descriptions, lockedDepartment] = await Promise.all([
            this.descriptionsOf(audience.dimensions),
            this.lockedDepartmentIn(departments, audience.respondent),
        ]);
        return {
            id: period.id, scope: period.scope, title: period.title, intro: period.intro, endDate: period.endDate,
            teamLabel: period.teamLabel,
            ...(period.respondentPicks ? { respondentPicks: true } : {}),
            respondent: { fullName: audience.respondent.fullName, departmentId: lockedDepartment?.id ?? null },
            submittedAt,
            /** Kept for older clients: the account name once it has answered. */
            submittedNames: submittedAt ? [audience.respondent.fullName] : [],
            departments: departments.map((department) => ({ id: department.id, name: department.name })),
            ratees: audience.ratees.map((ratee) => ({
                ...formProfile(ratee, views.get(ratee.id)),
                // HC PIC fields only on PIC ratees, so other forms keep their exact shape.
                ...(ratee.picId ? { picId: ratee.picId, serviceCode: ratee.serviceCode, serviceName: serviceName(ratee.serviceCode), bagian: ratee.bagian } : {}),
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
        // Identity is locked to the account: a typed name (still accepted from older clients) is ignored.
        const respondentName = accountName(audience.respondent.fullName);
        try {
            await this.dataSource.transaction(async (manager) => {
                // FOR SHARE: submits for one period don't queue behind each other, while admin edits
                // (FOR UPDATE on the same row) cannot change what we validate against until we commit.
                const locked = await lockPeriodRow(manager, period.id, 'pessimistic_read');
                if (!locked) throw new NotFoundException(NOT_FOUND_MESSAGE);
                assertSubmittable(locked, now);
                // One response per account and period; older periods may still hold several (left untouched).
                if (await manager.getRepository(CsiResponse).count({ where: { periodId: period.id, respondentId } })) {
                    throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
                }
                // All reads go through the transaction's connection: a submit holds exactly one pooled connection.
                const readers = readersOf(manager);
                // The locked row carries no relations and admins can edit the period sites: re-read them after the lock.
                const sites = await manager.getRepository(CsiPeriodSite).find({ where: { periodId: period.id } });
                const current = await this.audienceFor(readers, audience.respondent, { ...locked, sites });
                if (!current) throw new NotFoundException(NOT_FOUND_MESSAGE);
                const department = await readers.departments.findOne({ where: { id: dto.departmentId, scope: locked.scope, isActive: true } });
                if (!department) throw new BadRequestException('Departemen tidak ditemukan atau tidak aktif');
                const active = await readers.departments.find({ where: { scope: locked.scope, isActive: true } });
                const lockedDepartment = await this.lockedDepartmentIn(active, audience.respondent, manager);
                if (lockedDepartment && lockedDepartment.id !== department.id) throw new BadRequestException(DEPARTMENT_LOCKED_MESSAGE);
                // "Respondent picks": only the PICs answered are rated (all their required questions), at least one.
                const rated = locked.respondentPicks ? pickedRatees(dto.items ?? [], current.dimensions) : null;
                if (rated && !rated.size) throw new BadRequestException(PICK_ONE_MESSAGE);
                const dimensions = rated ? current.dimensions.filter((row) => rated.has(row.periodRateeId)) : current.dimensions;
                const ratees = rated ? current.ratees.filter((ratee) => rated.has(ratee.id)) : current.ratees;
                const items = validateItems(dto.items ?? [], dimensions);
                const comments = validateComments(dto.comments ?? [], ratees);
                const org = orgSnapshot(await this.org.respondentOrg(respondentId), department.name, audience.respondent.profileDepartment);
                await this.writeResponse(manager, { periodId: period.id, respondentId, respondentName, department, items, comments, now, org });
            });
        } catch (error) {
            if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
                throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
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
        const user = await this.users.findOne({
            where: { id: userId }, relations: { department: true },
            select: { id: true, fullName: true, siteId: true, isActive: true, department: { id: true, name: true } },
        });
        if (!user || !user.isActive || !user.siteId) return null;
        return { id: user.id, fullName: user.fullName, siteId: user.siteId, profileDepartment: user.department?.name ?? null };
    }

    /**
     * The department the respondent is locked to within this scope's active list, or null (free choice, made once).
     * Source: the department of the account's latest CSI answer (any scope), else the HR profile department.
     * Matched by name so the lock carries across the ICT and HC lists; a name missing from this list leaves the choice open.
     */
    private async lockedDepartmentIn(departments: DepartmentRow[], respondent: Respondent, manager?: EntityManager): Promise<DepartmentRow | null> {
        const responses = manager ? manager.getRepository(CsiResponse) : this.responses;
        const latest = await responses.findOne({ where: { respondentId: respondent.id }, order: { submittedAt: 'DESC' } });
        const org = respondent.org ?? await this.org.respondentOrg(respondent.id);
        const directory = org.fromDirectory && org.division && org.department ? `${org.division}${CSI_DEPARTMENT_SEPARATOR}${org.department}` : null;
        const sources = [directory, latest?.departmentName, respondent.profileDepartment].filter((name): name is string => Boolean(name?.trim()));
        for (const source of sources) {
            const match = matchDepartment(departments, source);
            if (match) return match;
        }
        return null;
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
        // The rater mapping applies to LISTED periods only; OPEN keeps the old "every visible ratee" behaviour.
        const pairs = period.respondentMode === CsiRespondentMode.LISTED ? await this.pairsWithin(readers, period.id, respondent.id) : null;
        const visible = rows.filter((ratee) => isRateeVisible(ratee, period, respondent.id) && (!pairs || pairs.has(ratee.id)));
        if (!visible.length) return null;
        const dimensions = await this.dimensionsOf(readers, visible);
        const withQuestions = new Set(dimensions.map((row) => row.periodRateeId));
        const ratees = visible.filter((ratee) => withQuestions.has(ratee.id)).sort(rateeOrder(respondent.siteId));
        return ratees.length ? { respondent, ratees, dimensions } : null;
    }

    private dimensionsOf(readers: AssignmentReaders, ratees: CsiPeriodRatee[]) {
        return readers.rateeDimensions.find({
            where: { periodRateeId: In(ratees.map((ratee) => ratee.id)) }, order: { sortOrder: 'ASC' },
        });
    }

    /**
     * Mapping of the rater (null = the period has no mapping at all). Inside the submit transaction the read goes through
     * the transaction's connection; otherwise CsiAssignmentService.pairsFor is the single implementation.
     */
    private async pairsWithin(readers: AssignmentReaders, periodId: string, raterUserId: string): Promise<Set<string> | null> {
        if (!readers.pairs) return this.assignments.pairsFor(periodId, raterUserId);
        if (!(await readers.pairs.count({ where: { periodId } }))) return null;
        const rater = await readers.periodRaters.findOne({ where: { periodId, userId: raterUserId } });
        if (!rater) return new Set();
        const rows = await readers.pairs.find({ where: { periodId, periodRaterId: rater.id } });
        return new Set(rows.map((row) => row.periodRateeId));
    }

    /** Current master description per dimension id (one query); a deleted master yields no entry. */
    private async descriptionsOf(dimensions: CsiPeriodRateeDimension[]) {
        const ids = [...new Set(dimensions.map((row) => row.dimensionId))];
        if (!ids.length) return new Map<string, string | null>();
        const rows = await this.dimensions.find({ where: { id: In(ids) }, select: { id: true, description: true } });
        return new Map(rows.map((dimension) => [dimension.id, dimension.description ?? null]));
    }

    /** When the account first answered the period, or null when it has not. */
    private async submittedAt(periodId: string, respondentId: string): Promise<Date | null> {
        const first = await this.responses.findOne({ where: { periodId, respondentId }, order: { submittedAt: 'ASC' } });
        return first?.submittedAt ?? null;
    }

    private async writeResponse(manager: EntityManager, input: {
        periodId: string; respondentId: string; respondentName: string; department: CsiDepartment;
        items: ResolvedItem[]; comments: CommentRow[]; now: Date; org: OrgSnapshot;
    }) {
        const response = await manager.save(CsiResponse, {
            periodId: input.periodId, respondentId: input.respondentId, respondentName: input.respondentName,
            departmentId: input.department.id, departmentName: input.department.name, submittedAt: input.now, ...input.org,
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
/** Teams first (the respondent's own site team before other sites), then by sortOrder. */
const rateeOrder = (siteId: string) => (a: CsiPeriodRatee, b: CsiPeriodRatee) =>
    Number(isTeam(b)) - Number(isTeam(a))
    || Number(isTeam(b) && b.siteId === siteId) - Number(isTeam(a) && a.siteId === siteId)
    || a.sortOrder - b.sortOrder;

/** Form fields of a ratee; `avatarUrl` is kept for older clients and equals the resolved `photoUrl`. */
function formProfile(ratee: CsiPeriodRatee, view: CsiRateeView | undefined) {
    const photoUrl = view?.photoUrl ?? null;
    return {
        periodRateeId: ratee.id, kind: ratee.kind ?? CsiRateeKind.PERSON, displayName: ratee.displayName,
        jobTitle: view?.jobTitle ?? ratee.jobTitle, serviceFunction: ratee.serviceFunction ?? null, avatarUrl: photoUrl,
        siteId: view?.siteId ?? null, siteCode: view?.siteCode ?? null, tagline: view?.tagline ?? null, photoUrl,
    };
}

function isRateeVisible(ratee: CsiPeriodRatee, period: CsiPeriod, respondentId: string) {
    if (isTeam(ratee)) return period.teamEnabled === true;
    return period.individualEnabled !== false && ratee.userId !== respondentId;
}

const collapseSpaces = (value: string) => value.trim().replace(/\s+/g, ' ');
/** Case- and space-insensitive department name ("HC  Services" = "hc services"). */
const departmentKey = (name: string) => collapseSpaces(name).toLowerCase();

/**
 * Exact (case/space-insensitive) name, else the one "DIVISION / DEPARTMENT" entry whose department part matches
 * (an HR profile only knows "QUALITY CONTROL"; ambiguous names such as that one under several divisions stay open).
 */
function matchDepartment(departments: DepartmentRow[], source: string): DepartmentRow | null {
    const key = departmentKey(source);
    const exact = departments.find((department) => departmentKey(department.name) === key);
    if (exact) return exact;
    const byPart = departments.filter((department) => {
        const at = department.name.lastIndexOf(CSI_DEPARTMENT_SEPARATOR);
        return at >= 0 && departmentKey(department.name.slice(at + CSI_DEPARTMENT_SEPARATOR.length)) === key;
    });
    return byPart.length === 1 ? byPart[0] : null;
}

/** The account's full name as stored on the response (spaces collapsed, column-safe length). */
const accountName = (fullName: string) => collapseSpaces(fullName ?? '').slice(0, CSI_RESPONDENT_NAME_MAX) || '-';

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
            if (dimension.type === CsiQuestionType.CHOICE) return { ...base, answerLabel };
            const points = option.points;
            if (!Number.isInteger(points) || points! < CSI_SCORE_MIN || points! > CSI_SCORE_MAX) throw new BadRequestException(OPTION_POINTS_MESSAGE);
            return { ...base, score: points, answerLabel };
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

type OrgSnapshot = {
    respondentNik: string | null; orgDivision: string | null; orgDepartment: string | null; orgBagian: string | null; orgLocation: string | null;
};

/**
 * Organisation stored with the answer: the directory row of the NIK when known; otherwise division / department from
 * the department the respondent chose ("DIVISION / DEPARTMENT") and bagian from the account's HR department.
 */
function orgSnapshot(org: CsiRespondentOrg, chosenDepartment: string, profileDepartment: string | null): OrgSnapshot {
    if (org.fromDirectory) {
        return { respondentNik: org.nik, orgDivision: org.division, orgDepartment: org.department, orgBagian: org.bagian, orgLocation: org.location };
    }
    const at = chosenDepartment.indexOf(CSI_DEPARTMENT_SEPARATOR);
    const division = at >= 0 ? chosenDepartment.slice(0, at) : null;
    const department = at >= 0 ? chosenDepartment.slice(at + CSI_DEPARTMENT_SEPARATOR.length) : chosenDepartment;
    return {
        respondentNik: org.nik, orgDivision: division, orgDepartment: department,
        orgBagian: normalizeBagian(profileDepartment), orgLocation: org.location,
    };
}

/** Ratees that received at least one answer (the PICs a respondent picked). Unknown ids are rejected later. */
function pickedRatees(items: SubmitResponseDto['items'], dimensions: CsiPeriodRateeDimension[]): Set<string> {
    const rateeOf = new Map(dimensions.map((dimension) => [dimension.id, dimension.periodRateeId]));
    return new Set(items.flatMap((item) => {
        const rateeId = rateeOf.get(item.periodRateeDimensionId);
        return rateeId ? [rateeId] : [];
    }));
}
