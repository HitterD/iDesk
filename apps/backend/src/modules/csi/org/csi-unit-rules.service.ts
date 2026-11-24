import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiPairMode, CsiRespondentMode } from '../csi.constants';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodForRaterAdditions, lockUnlockedPeriod } from '../services/csi-period-lock.util';
import { emitCsiUpdated } from '../csi.events';
import { assertPeriodInScope } from '../services/csi-scope.util';
import { normalizeNik } from './csi-org.constants';
import { serviceCodesOf } from './csi-services';
import { CsiUnitRule, expandRules } from './csi-unit-rules';

const RULES_MAX = 200;
const CHUNK_SIZE = 1000;
const NO_RULES_MESSAGE = 'Tambahkan minimal satu aturan penilai';
const RATER_ALREADY_ANSWERED_MESSAGE = 'PIC yang sudah dinilai oleh penilai ini tidak dapat dihapus';
const CANNOT_REMOVE_RATER_MESSAGE = 'Penilai yang sudah terdaftar tidak dapat dihapus setelah ada jawaban';

export type CsiUnitRulesResult = { rules: CsiUnitRule[]; raters: number; pairs: number; unmatched: number };
export type AssignRatersToPicsInput = {
    targetRateeIds: string[];
    sourceRateeId?: string;
    raterUserIds?: string[];
    includeAnswered?: boolean;
};
export type AssignRatersToPicsResult = {
    addedPairs: number;
    addedRaters: number;
    reopenedRaters: number;
    skippedAnswered: number;
    skippedSelf: number;
};

/**
 * HC default "siapa menilai siapa": rules per respondent unit are saved on the period and expanded into the period's
 * raters (LISTED) and rater → PIC pairs. Raters picked by hand stay; their pairs come from the matrix as before.
 */
@Injectable()
export class CsiUnitRulesService {
    constructor(
        @InjectRepository(CsiPeriod) private readonly periods: Repository<CsiPeriod>,
        @InjectRepository(CsiOrgPerson) private readonly people: Repository<CsiOrgPerson>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(CsiPeriodRatee) private readonly ratees: Repository<CsiPeriodRatee>,
        @InjectDataSource() private readonly dataSource: DataSource,
        @Optional() private readonly eventEmitter?: EventEmitter2,
    ) { }

    /** Units known to the directory (division → department → bagian), with active iDesk accounts counted. */
    async unitOptions() {
        // Static SQL (no user input): units of the directory joined to active accounts by NIK.
        const rows: Array<{ division: string; department: string | null; bagian: string | null; count: string }> = await this.dataSource.query(`
            SELECT person."division" AS "division", person."department" AS "department", person."bagian" AS "bagian", COUNT(*) AS "count"
            FROM "csi_org_people" person
            JOIN "users" account ON (CASE
                WHEN btrim(account."employeeId") ~ '^[0-9]+$' AND char_length(btrim(account."employeeId")) < 8 THEN lpad(btrim(account."employeeId"), 8, '0')
                ELSE btrim(account."employeeId")
            END) = person."nik" AND account."isActive" = true
            WHERE person."division" IS NOT NULL
            GROUP BY person."division", person."department", person."bagian"`);
        return rows.map((row) => ({ division: row.division, department: row.department, bagian: row.bagian, accounts: Number(row.count) }));
    }

    async preview(scope: ServiceScope, periodId: string, rules: CsiUnitRule[]) {
        const period = await this.find(scope, periodId);
        this.assertServicesInScope(scope, rules);
        const { raters, pairs } = await this.expand(period.id, rules);
        return { raters: raters.length, pairs: pairs.length };
    }

    /** Saves the rules and rewrites the period's raters and pairs from them (only before the first answer). */
    async apply(scope: ServiceScope, periodId: string, rules: CsiUnitRule[]): Promise<CsiUnitRulesResult> {
        const period = await this.find(scope, periodId);
        if (!rules.length) throw new BadRequestException(NO_RULES_MESSAGE);
        if (rules.length > RULES_MAX) throw new BadRequestException(`Maksimal ${RULES_MAX} aturan`);
        this.assertServicesInScope(scope, rules);
        const { raters, pairs, unmatched } = await this.expand(period.id, rules);
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, period.id);
            await manager.delete(CsiPeriodRaterRatee, { periodId: period.id });
            await manager.delete(CsiPeriodRater, { periodId: period.id });
            const saved = raters.length ? await manager.save(CsiPeriodRater, raters.map((userId) => ({ periodId: period.id, userId }))) : [];
            const raterOf = new Map(saved.map((row) => [row.userId, row.id]));
            const rows = pairs.map((pair) => ({ periodId: period.id, periodRaterId: raterOf.get(pair.userId)!, periodRateeId: pair.periodRateeId }));
            for (let start = 0; start < rows.length; start += 1000) await manager.save(CsiPeriodRaterRatee, rows.slice(start, start + 1000));
            await manager.update(CsiPeriod, { id: period.id }, {
                unitRules: rules, respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false,
            });
        });
        emitCsiUpdated(this.eventEmitter, scope, period.id);
        return { rules, raters: raters.length, pairs: pairs.length, unmatched };
    }

    /**
     * Current raters of the period with the PICs each rates (for the "cari nama" editor), plus directory unit info
     * and which ratee IDs the rater has already scored in a submitted response.
     */
    async raterList(scope: ServiceScope, periodId: string) {
        const period = await this.find(scope, periodId);
        const raters = await this.dataSource.getRepository(CsiPeriodRater).find({ where: { periodId: period.id }, relations: { user: { site: true } } });
        const pairs = await this.dataSource.getRepository(CsiPeriodRaterRatee).find({ where: { periodId: period.id } });
        const responses = (await this.dataSource.getRepository(CsiResponse)?.find({ where: { periodId: period.id }, select: { id: true, respondentId: true } })) ?? [];
        const answered = new Set(responses.map((row) => row.respondentId));
        const ratedByUser = await this.ratedRateeMap(responses);
        const niks = raters.map((rater) => normalizeNik(rater.user?.employeeId)).filter((nik): nik is string => !!nik);
        const org = new Map((niks.length ? await this.people.find({ where: { nik: In(niks) } }) : []).map((person) => [person.nik, person]));
        return raters.map((rater) => {
            const nik = normalizeNik(rater.user?.employeeId);
            const person = nik ? org.get(nik) : undefined;
            return {
                userId: rater.userId, nik: rater.user?.employeeId ?? null, fullName: rater.user?.fullName ?? '', siteCode: rater.user?.site?.code ?? null,
                division: person?.division ?? null, department: person?.department ?? null, bagian: person?.bagian ?? null,
                periodRateeIds: pairs.filter((pair) => pair.periodRaterId === rater.id).map((pair) => pair.periodRateeId),
                ratedRateeIds: [...(ratedByUser.get(rater.userId) ?? [])],
                answered: answered.has(rater.userId),
            };
        }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
    }

    /**
     * Sets the PICs one rater rates. Once answers exist on an open survey: unanswered raters cannot be removed outright
     * (must keep >=1 PIC), and raters with an earlier submission can still receive additional unrated PICs while their
     * already-scored PICs remain locked.
     */
    async setRater(scope: ServiceScope, periodId: string, userId: string, periodRateeIds: string[], now: Date = new Date()) {
        const period = await this.find(scope, periodId);
        const user = await this.users.findOne({ where: { id: userId, isActive: true }, select: { id: true } });
        if (!user) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const ids = [...new Set(periodRateeIds)];
        const valid = ids.length ? await this.ratees.find({ where: { periodId: period.id, id: In(ids) } }) : [];
        if (valid.length !== ids.length) throw new BadRequestException('Subjek tidak termasuk survei ini');
        if (valid.some((ratee) => ratee.userId === userId)) throw new BadRequestException('Penilai tidak boleh menilai dirinya sendiri');
        await this.dataSource.transaction(async (manager) => {
            const { responseCount } = await lockPeriodForRaterAdditions(manager, period.id, now);
            const existing = await manager.getRepository(CsiPeriodRater).findOne({ where: { periodId: period.id, userId } });
            const requestedSet = new Set(ids);
            if (responseCount > 0) {
                if (existing && !ids.length) throw new ConflictException(CANNOT_REMOVE_RATER_MESSAGE);
                if (!existing && !ids.length) return;
                const existingResponse = await manager.getRepository(CsiResponse).findOne({
                    where: { periodId: period.id, respondentId: userId },
                    select: { id: true },
                });
                if (existingResponse) {
                    const lockedRateeIds = await this.lockedRateeIdsForResponse(manager, existingResponse.id, existing?.id);
                    if ([...lockedRateeIds].some((rateeId) => !requestedSet.has(rateeId))) {
                        throw new ConflictException(RATER_ALREADY_ANSWERED_MESSAGE);
                    }
                    const rater = existing ?? await manager.save(CsiPeriodRater, { periodId: period.id, userId });
                    await this.diffRaterPairs(manager, period.id, rater.id, ids, lockedRateeIds);
                    await this.ensureListedCustomMode(manager, period);
                    return;
                }
            }
            if (existing) await manager.delete(CsiPeriodRaterRatee, { periodRaterId: existing.id });
            if (!ids.length) {
                if (existing) await manager.delete(CsiPeriodRater, { id: existing.id });
                return;
            }
            const rater = existing ?? await manager.save(CsiPeriodRater, { periodId: period.id, userId });
            await manager.save(CsiPeriodRaterRatee, ids.map((periodRateeId) => ({ periodId: period.id, periodRaterId: rater.id, periodRateeId })));
            await this.ensureListedCustomMode(manager, period);
        });
        emitCsiUpdated(this.eventEmitter, scope, periodId);
        return this.raterList(scope, periodId);
    }

    /**
     * Bulk-adds pairs from an existing PIC (`sourceRateeId`) and/or explicit rater user IDs (`raterUserIds`) to one or more
     * target PICs (`targetRateeIds`). When `includeAnswered` is false (default), already-submitted raters are skipped; when
     * true, new unrated target PICs are opened for them without altering previous ratings.
     */
    async assignRatersToPics(
        scope: ServiceScope,
        periodId: string,
        input: AssignRatersToPicsInput,
        now: Date = new Date(),
    ): Promise<AssignRatersToPicsResult> {
        const period = await this.find(scope, periodId);
        const targetIds = [...new Set(input.targetRateeIds)];
        if (!targetIds.length) throw new BadRequestException('Pilih minimal satu PIC tujuan');
        const targetRatees = await this.ratees.find({ where: { periodId: period.id, id: In(targetIds) } });
        if (targetRatees.length !== targetIds.length) throw new BadRequestException('PIC tujuan tidak termasuk survei ini');
        const explicitRaterIds = [...new Set(input.raterUserIds ?? [])];
        if (!input.sourceRateeId && !explicitRaterIds.length) {
            throw new BadRequestException('Pilih PIC sumber penilai atau daftar penilai yang akan ditambahkan');
        }
        if (explicitRaterIds.length) {
            const active = await this.users.find({ where: { id: In(explicitRaterIds), isActive: true }, select: { id: true } });
            if (active.length !== explicitRaterIds.length) throw new BadRequestException('Sebagian penilai tidak ditemukan atau tidak aktif');
        }
        const includeAnswered = Boolean(input.includeAnswered);
        const result = await this.dataSource.transaction(async (manager) => {
            await lockPeriodForRaterAdditions(manager, period.id, now);
            const candidateIds = await this.collectCandidateUserIds(manager, period.id, input.sourceRateeId, explicitRaterIds);
            if (!candidateIds.length) return { addedPairs: 0, addedRaters: 0, reopenedRaters: 0, skippedAnswered: 0, skippedSelf: 0 };

            const responses = (await manager.getRepository(CsiResponse)?.find({
                where: { periodId: period.id },
                select: { id: true, respondentId: true },
            })) ?? [];
            const answeredUsers = new Set(responses.map((row) => row.respondentId));
            const ratedByUser = await this.ratedRateeMap(responses, manager);

            const skippedAnswered = includeAnswered ? 0 : candidateIds.filter((userId) => answeredUsers.has(userId)).length;
            const eligibleIds = includeAnswered ? candidateIds : candidateIds.filter((userId) => !answeredUsers.has(userId));
            if (!eligibleIds.length) return { addedPairs: 0, addedRaters: 0, reopenedRaters: 0, skippedAnswered, skippedSelf: 0 };

            const raterRepo = manager.getRepository(CsiPeriodRater);
            const existingRaters = await raterRepo.find({ where: { periodId: period.id } });
            const raterByUser = new Map(existingRaters.map((row) => [row.userId, row]));
            const missingUsers = eligibleIds.filter((userId) => !raterByUser.has(userId));
            const createdRaters = missingUsers.length
                ? await manager.save(CsiPeriodRater, missingUsers.map((userId) => ({ periodId: period.id, userId })))
                : [];
            createdRaters.forEach((row) => raterByUser.set(row.userId, row));

            const existingPairs = await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodId: period.id } });
            const seen = new Set(existingPairs.map((pair) => `${pair.periodRaterId}:${pair.periodRateeId}`));

            let skippedSelf = 0;
            const reopenedSet = new Set<string>();
            const toInsert: Array<{ periodId: string; periodRaterId: string; periodRateeId: string }> = [];

            for (const userId of eligibleIds) {
                const rater = raterByUser.get(userId)!;
                const ratedSet = ratedByUser.get(userId);
                for (const target of targetRatees) {
                    if (target.userId === userId) {
                        skippedSelf += 1;
                        continue;
                    }
                    const key = `${rater.id}:${target.id}`;
                    if (seen.has(key) || ratedSet?.has(target.id)) continue;
                    seen.add(key);
                    toInsert.push({ periodId: period.id, periodRaterId: rater.id, periodRateeId: target.id });
                    if (answeredUsers.has(userId)) reopenedSet.add(userId);
                }
            }

            for (let start = 0; start < toInsert.length; start += CHUNK_SIZE) {
                await manager.save(CsiPeriodRaterRatee, toInsert.slice(start, start + CHUNK_SIZE));
            }
            if (toInsert.length > 0) await this.ensureListedCustomMode(manager, period);
            return {
                addedPairs: toInsert.length,
                addedRaters: createdRaters.length,
                reopenedRaters: reopenedSet.size,
                skippedAnswered,
                skippedSelf,
            };
        });
        if (result.addedPairs > 0 || result.addedRaters > 0) {
            emitCsiUpdated(this.eventEmitter, scope, periodId);
        }
        return result;
    }

    private async ratedRateeMap(responses: Array<Pick<CsiResponse, 'id' | 'respondentId'>>, manager?: { getRepository: DataSource['getRepository'] }) {
        const result = new Map<string, Set<string>>();
        if (!responses.length) return result;
        const itemRepo = (manager ?? this.dataSource).getRepository?.(CsiResponseItem);
        if (!itemRepo) return result;
        const responseToUser = new Map(responses.map((row) => [row.id, row.respondentId]));
        const items = await itemRepo.find({
            where: { responseId: In(responses.map((row) => row.id)) },
            select: { responseId: true, periodRateeId: true },
        });
        items.forEach((item) => {
            const userId = responseToUser.get(item.responseId);
            if (!userId) return;
            const set = result.get(userId) ?? new Set<string>();
            set.add(item.periodRateeId);
            result.set(userId, set);
        });
        return result;
    }

    private async lockedRateeIdsForResponse(manager: EntityManager, responseId: string, periodRaterId?: string) {
        const itemRepo = manager.getRepository(CsiResponseItem);
        const items = itemRepo ? await itemRepo.find({ where: { responseId }, select: { periodRateeId: true } }) : [];
        if (items.length) return new Set(items.map((item) => item.periodRateeId));
        if (!periodRaterId) return new Set<string>();
        const existingPairs = await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodRaterId }, select: { periodRateeId: true } });
        return new Set(existingPairs.map((pair) => pair.periodRateeId));
    }

    private async diffRaterPairs(
        manager: EntityManager,
        periodId: string,
        periodRaterId: string,
        ids: string[],
        lockedRateeIds: ReadonlySet<string>,
    ) {
        const currentPairs = await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodId, periodRaterId } });
        const currentSet = new Set(currentPairs.map((pair) => pair.periodRateeId));
        const requestedSet = new Set(ids);
        const toRemove = [...currentSet].filter((id) => !requestedSet.has(id) && !lockedRateeIds.has(id));
        const toAdd = ids.filter((id) => !currentSet.has(id));
        if (toRemove.length) {
            await manager.delete(CsiPeriodRaterRatee, { periodId, periodRaterId, periodRateeId: In(toRemove) });
        }
        if (toAdd.length) {
            await manager.save(CsiPeriodRaterRatee, toAdd.map((periodRateeId) => ({ periodId, periodRaterId, periodRateeId })));
        }
    }

    private async ensureListedCustomMode(manager: EntityManager, period: CsiPeriod) {
        if (period.respondentMode !== CsiRespondentMode.LISTED || period.pairMode !== CsiPairMode.CUSTOM || period.respondentPicks !== false) {
            await manager.update(CsiPeriod, { id: period.id }, { respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false });
        }
    }

    private async collectCandidateUserIds(
        manager: EntityManager,
        periodId: string,
        sourceRateeId?: string,
        explicitRaterIds: string[] = [],
    ): Promise<string[]> {
        const result = new Set<string>(explicitRaterIds);
        if (sourceRateeId) {
            const sourceRatee = await manager.getRepository(CsiPeriodRatee).findOne({ where: { id: sourceRateeId, periodId }, select: { id: true } });
            if (!sourceRatee) throw new BadRequestException('PIC sumber tidak termasuk survei ini');
            const sourcePairs = await manager.getRepository(CsiPeriodRaterRatee).find({ where: { periodId, periodRateeId: sourceRateeId }, select: { periodRaterId: true } });
            const raterIds = [...new Set(sourcePairs.map((pair) => pair.periodRaterId))];
            if (raterIds.length) {
                const raters = await manager.getRepository(CsiPeriodRater).find({ where: { periodId, id: In(raterIds) }, select: { userId: true } });
                raters.forEach((row) => result.add(row.userId));
            }
        }
        return [...result];
    }

    private async expand(periodId: string, rules: CsiUnitRule[]) {
        const pics = (await this.ratees.find({ where: { periodId, picId: Not(IsNull()) } })).map((ratee) => ({
            periodRateeId: ratee.id, picId: ratee.picId!, serviceCode: ratee.serviceCode, bagian: ratee.bagian, userId: ratee.userId,
        }));
        const divisions = [...new Set(rules.map((rule) => rule.division))];
        const people = divisions.length ? await this.people.find({ where: { division: In(divisions) } }) : [];
        const byNik = expandRules(rules, people, pics);
        const accounts = byNik.size ? await this.users.find({
            where: { isActive: true, employeeId: Not(IsNull()) }, select: { id: true, employeeId: true },
        }) : [];
        const picUser = new Map(pics.map((pic) => [pic.periodRateeId, pic.userId]));
        const matchedNiks = new Set<string>();
        const pairs = accounts.flatMap((user) => {
            const nik = normalizeNik(user.employeeId);
            const targetRatees = nik ? byNik.get(nik) : undefined;
            if (!nik || !targetRatees) return [];
            matchedNiks.add(nik);
            return [...targetRatees]
                // A PIC never rates themself.
                .filter((rateeId) => picUser.get(rateeId) !== user.id)
                .map((periodRateeId) => ({ userId: user.id, periodRateeId }));
        });
        const raters = [...new Set(pairs.map((pair) => pair.userId))];
        return { raters, pairs, unmatched: Math.max(0, byNik.size - matchedNiks.size) };
    }

    private assertServicesInScope(scope: ServiceScope, rules: CsiUnitRule[]) {
        const allowed = new Set(serviceCodesOf(scope));
        if (rules.some((rule) => !allowed.has(rule.serviceCode))) {
            throw new BadRequestException('Layanan pada aturan unit tidak sesuai unit CSI');
        }
    }

    private async find(scope: ServiceScope, periodId: string) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
    }
}
