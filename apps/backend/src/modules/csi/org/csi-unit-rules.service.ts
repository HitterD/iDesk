import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiPairMode, CsiRespondentMode } from '../csi.constants';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriodRaterRatee } from '../entities/csi-period-rater-ratee.entity';
import { CsiPeriodRater } from '../entities/csi-period-rater.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { lockUnlockedPeriod } from '../services/csi-period-lock.util';
import { assertPeriodInScope } from '../services/csi-scope.util';
import { CsiUnitRule, expandRules } from './csi-unit-rules';

const RULES_MAX = 200;
const NO_RULES_MESSAGE = 'Tambahkan minimal satu aturan penilai';

export type CsiUnitRulesResult = { rules: CsiUnitRule[]; raters: number; pairs: number; unmatched: number };

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
    ) { }

    /** Units known to the directory (division → department → bagian), with active iDesk accounts counted. */
    async unitOptions() {
        // Static SQL (no user input): units of the directory joined to active accounts by NIK.
        const rows: Array<{ division: string; department: string | null; bagian: string | null; count: string }> = await this.dataSource.query(`
            SELECT person."division" AS "division", person."department" AS "department", person."bagian" AS "bagian", COUNT(*) AS "count"
            FROM "csi_org_people" person
            JOIN "users" account ON account."employeeId" = person."nik" AND account."isActive" = true
            WHERE person."division" IS NOT NULL
            GROUP BY person."division", person."department", person."bagian"`);
        return rows.map((row) => ({ division: row.division, department: row.department, bagian: row.bagian, accounts: Number(row.count) }));
    }

    async preview(scope: ServiceScope, periodId: string, rules: CsiUnitRule[]) {
        const period = await this.find(scope, periodId);
        const { raters, pairs } = await this.expand(period.id, rules);
        return { raters: raters.length, pairs: pairs.length };
    }

    /** Saves the rules and rewrites the period's raters and pairs from them (only before the first answer). */
    async apply(scope: ServiceScope, periodId: string, rules: CsiUnitRule[]): Promise<CsiUnitRulesResult> {
        const period = await this.find(scope, periodId);
        if (!rules.length) throw new BadRequestException(NO_RULES_MESSAGE);
        if (rules.length > RULES_MAX) throw new BadRequestException(`Maksimal ${RULES_MAX} aturan`);
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
        return { rules, raters: raters.length, pairs: pairs.length, unmatched };
    }

    /**
     * Current raters of the period with the PICs each rates (for the "cari nama" editor), plus directory unit info.
     */
    async raterList(scope: ServiceScope, periodId: string) {
        const period = await this.find(scope, periodId);
        const raters = await this.dataSource.getRepository(CsiPeriodRater).find({ where: { periodId: period.id }, relations: { user: { site: true } } });
        const pairs = await this.dataSource.getRepository(CsiPeriodRaterRatee).find({ where: { periodId: period.id } });
        const niks = raters.map((rater) => rater.user?.employeeId).filter((nik): nik is string => !!nik);
        const org = new Map((niks.length ? await this.people.find({ where: { nik: In(niks) } }) : []).map((person) => [person.nik, person]));
        return raters.map((rater) => {
            const person = org.get(rater.user?.employeeId ?? '');
            return {
                userId: rater.userId, nik: rater.user?.employeeId ?? null, fullName: rater.user?.fullName ?? '', siteCode: rater.user?.site?.code ?? null,
                division: person?.division ?? null, department: person?.department ?? null, bagian: person?.bagian ?? null,
                periodRateeIds: pairs.filter((pair) => pair.periodRaterId === rater.id).map((pair) => pair.periodRateeId),
            };
        }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));
    }

    /** Sets the PICs one rater rates (empty list removes the rater); other raters are untouched. */
    async setRater(scope: ServiceScope, periodId: string, userId: string, periodRateeIds: string[]) {
        const period = await this.find(scope, periodId);
        const user = await this.users.findOne({ where: { id: userId, isActive: true }, select: { id: true } });
        if (!user) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const ids = [...new Set(periodRateeIds)];
        const valid = ids.length ? await this.ratees.find({ where: { periodId: period.id, id: In(ids), picId: Not(IsNull()) } }) : [];
        if (valid.length !== ids.length) throw new BadRequestException('PIC tidak termasuk survei ini');
        if (valid.some((ratee) => ratee.userId === userId)) throw new BadRequestException('PIC tidak boleh menilai dirinya sendiri');
        await this.dataSource.transaction(async (manager) => {
            await lockUnlockedPeriod(manager, period.id);
            const existing = await manager.getRepository(CsiPeriodRater).findOne({ where: { periodId: period.id, userId } });
            if (existing) await manager.delete(CsiPeriodRaterRatee, { periodRaterId: existing.id });
            if (!ids.length) {
                if (existing) await manager.delete(CsiPeriodRater, { id: existing.id });
                return;
            }
            const rater = existing ?? await manager.save(CsiPeriodRater, { periodId: period.id, userId });
            await manager.save(CsiPeriodRaterRatee, ids.map((periodRateeId) => ({ periodId: period.id, periodRaterId: rater.id, periodRateeId })));
            await manager.update(CsiPeriod, { id: period.id }, { respondentMode: CsiRespondentMode.LISTED, pairMode: CsiPairMode.CUSTOM, respondentPicks: false });
        });
        return this.raterList(scope, periodId);
    }

    private async expand(periodId: string, rules: CsiUnitRule[]) {
        const pics = (await this.ratees.find({ where: { periodId, picId: Not(IsNull()) } })).map((ratee) => ({
            periodRateeId: ratee.id, picId: ratee.picId!, serviceCode: ratee.serviceCode, bagian: ratee.bagian, userId: ratee.userId,
        }));
        const divisions = [...new Set(rules.map((rule) => rule.division))];
        const people = divisions.length ? await this.people.find({ where: { division: In(divisions) } }) : [];
        const byNik = expandRules(rules, people, pics);
        const accounts = byNik.size ? await this.users.find({
            where: { employeeId: In([...byNik.keys()]), isActive: true }, select: { id: true, employeeId: true },
        }) : [];
        const picUser = new Map(pics.map((pic) => [pic.periodRateeId, pic.userId]));
        const pairs = accounts.flatMap((user) => [...(byNik.get(user.employeeId) ?? [])]
            // A PIC never rates themself.
            .filter((rateeId) => picUser.get(rateeId) !== user.id)
            .map((periodRateeId) => ({ userId: user.id, periodRateeId })));
        const raters = [...new Set(pairs.map((pair) => pair.userId))];
        return { raters, pairs, unmatched: byNik.size - accounts.length };
    }

    private async find(scope: ServiceScope, periodId: string) {
        return assertPeriodInScope(await this.periods.findOne({ where: { id: periodId } }), scope);
    }
}
