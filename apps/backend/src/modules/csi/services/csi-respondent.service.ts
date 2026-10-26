import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { User } from '../../users/entities/user.entity';
import { CSI_COMMENT_MAX, CSI_SCORE_MAX, CSI_SCORE_MIN, CsiPeriodPublishStatus, CsiRespondentMode } from '../csi.constants';
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
const ALREADY_SUBMITTED_MESSAGE = 'Anda sudah mengisi survei ini';
const PG_UNIQUE_VIOLATION = '23505';

type Respondent = Pick<User, 'id' | 'fullName' | 'siteId'>;
type Audience = { respondent: Respondent; ratees: CsiPeriodRatee[] };
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
            result.push({ id: period.id, scope: period.scope, title: period.title, submitted: await this.hasSubmitted(period.id, respondent.id) });
        }
        return result;
    }

    async getForm(user: CsiRespondentRef, periodId: string, now: Date = new Date()) {
        const { period, audience } = await this.resolveEligible(user, periodId);
        if (computeStatus(period, now) !== 'ACTIVE') throw new NotFoundException(NOT_FOUND_MESSAGE);
        if (await this.hasSubmitted(period.id, audience.respondent.id)) {
            return { submitted: true as const, title: period.title, thankYou: period.thankYou };
        }
        const [departments, dimensions, avatars] = await Promise.all([
            this.departments.find({ where: { scope: period.scope, isActive: true }, order: { sortOrder: 'ASC', name: 'ASC' } }),
            this.dimensionsOf(this.readers, audience.ratees),
            this.avatarsOf(audience.ratees),
        ]);
        const descriptions = await this.descriptionsOf(dimensions);
        return {
            submitted: false as const, id: period.id, scope: period.scope, title: period.title, intro: period.intro, endDate: period.endDate,
            respondent: { fullName: audience.respondent.fullName },
            departments: departments.map((department) => ({ id: department.id, name: department.name })),
            ratees: audience.ratees.map((ratee) => ({
                periodRateeId: ratee.id, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
                avatarUrl: ratee.userId ? avatars.get(ratee.userId) ?? null : null,
                dimensions: dimensions.filter((row) => row.periodRateeId === ratee.id).map((row) => ({
                    periodRateeDimensionId: row.id, name: row.dimensionName, description: descriptions.get(row.dimensionId) ?? null,
                })),
            })),
        };
    }

    async submit(user: CsiRespondentRef, periodId: string, dto: SubmitResponseDto, now: Date = new Date()) {
        const { period, audience } = await this.resolveEligible(user, periodId);
        assertSubmittable(period, now);
        const respondentId = audience.respondent.id;
        try {
            await this.dataSource.transaction(async (manager) => {
                // FOR SHARE: submits for one period don't queue behind each other, while admin edits
                // (FOR UPDATE on the same row) cannot change what we validate against until we commit.
                const locked = await lockPeriodRow(manager, period.id, 'pessimistic_read');
                if (!locked) throw new NotFoundException(NOT_FOUND_MESSAGE);
                assertSubmittable(locked, now);
                const existing = await manager.getRepository(CsiResponse).count({ where: { periodId: period.id, respondentId } });
                if (existing > 0) throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
                // All reads go through the transaction's connection: a submit holds exactly one pooled connection.
                const readers = readersOf(manager);
                // The locked row carries no relations and admins can edit the period sites: re-read them after the lock.
                const sites = await manager.getRepository(CsiPeriodSite).find({ where: { periodId: period.id } });
                const current = await this.audienceFor(readers, audience.respondent, { ...locked, sites });
                if (!current) throw new NotFoundException(NOT_FOUND_MESSAGE);
                const department = await readers.departments.findOne({ where: { id: dto.departmentId, scope: locked.scope, isActive: true } });
                if (!department) throw new BadRequestException('Departemen tidak ditemukan atau tidak aktif');
                const items = validateItems(dto.items ?? [], await this.dimensionsOf(readers, current.ratees));
                const comments = validateComments(dto.comments ?? [], current.ratees);
                await this.writeResponse(manager, { periodId: period.id, respondentId, department, items, comments, now });
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
        const user = await this.users.findOne({ where: { id: userId }, select: { id: true, fullName: true, siteId: true, isActive: true } });
        return user && user.isActive && user.siteId ? { id: user.id, fullName: user.fullName, siteId: user.siteId } : null;
    }

    /**
     * Published, site match, rater membership for LISTED mode, and at least one ratee other than the respondent.
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
        const ratees = rows.filter((ratee) => ratee.userId !== respondent.id);
        return ratees.length ? { respondent, ratees } : null;
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

    private async hasSubmitted(periodId: string, respondentId: string) {
        return (await this.responses.count({ where: { periodId, respondentId } })) > 0;
    }

    private async writeResponse(manager: EntityManager, input: {
        periodId: string; respondentId: string; department: CsiDepartment;
        items: Array<{ dimension: CsiPeriodRateeDimension; score: number }>; comments: CommentRow[]; now: Date;
    }) {
        const response = await manager.save(CsiResponse, {
            periodId: input.periodId, respondentId: input.respondentId,
            departmentId: input.department.id, departmentName: input.department.name, submittedAt: input.now,
        });
        await manager.save(CsiResponseItem, input.items.map(({ dimension, score }) => ({
            responseId: response.id, periodRateeId: dimension.periodRateeId, periodRateeDimensionId: dimension.id, score,
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

/** Submitted set must equal the expected set exactly: no missing, extra, or duplicate dimensions. */
function validateItems(items: SubmitResponseDto['items'], dimensions: CsiPeriodRateeDimension[]) {
    const expected = new Map(dimensions.map((dimension) => [dimension.id, dimension]));
    const seen = new Set<string>();
    const resolved = items.map(({ periodRateeDimensionId, score }) => {
        const dimension = expected.get(periodRateeDimensionId);
        if (!dimension || seen.has(periodRateeDimensionId)) throw new BadRequestException('Nilai berisi dimensi yang tidak valid atau duplikat');
        if (!Number.isInteger(score) || score < CSI_SCORE_MIN || score > CSI_SCORE_MAX) {
            throw new BadRequestException(`Nilai harus berupa bilangan bulat ${CSI_SCORE_MIN}–${CSI_SCORE_MAX}`);
        }
        seen.add(periodRateeDimensionId);
        return { dimension, score };
    });
    if (seen.size !== expected.size) throw new BadRequestException('Semua dimensi untuk setiap orang wajib diberi nilai');
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
