import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { User } from '../../users/entities/user.entity';
import { CsiRater } from '../entities/csi-rater.entity';
import { CsiMasterService } from './csi-master.service';

/** Upper bounds keep one click from registering a whole company by accident. */
export const CSI_RATER_GROUP_MAX = 2000;
export const CSI_RATER_IMPORT_MAX = 2000;
const SAMPLE_SIZE = 8;
const KEY_MAX = 200;

export type CsiRaterGroupFilter = { siteId?: string; departmentId?: string };
type Candidate = Pick<User, 'id' | 'fullName'>;

/** Bulk ways to register raters: a whole group (site and/or HR department) or a pasted/imported list of emails or NIKs. */
@Injectable()
export class CsiRaterBulkService {
    constructor(
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(CsiRater) private readonly raters: Repository<CsiRater>,
        private readonly master: CsiMasterService,
    ) { }

    /** HR departments that have active users (optionally of one site), for the group picker. */
    async departmentOptions(siteId?: string) {
        const rows: Array<{ id: string; name: string; count: string }> = await this.users.createQueryBuilder('user')
            .innerJoin('user.department', 'department')
            .select('department.id', 'id').addSelect('department.name', 'name').addSelect('COUNT(user.id)', 'count')
            .where('user.isActive = true')
            .andWhere(siteId ? 'user.siteId = :siteId' : '1 = 1', siteId ? { siteId } : {})
            .groupBy('department.id').addGroupBy('department.name').orderBy('department.name', 'ASC')
            .getRawMany();
        return rows.map((row) => ({ id: row.id, name: row.name, userCount: Number(row.count) }));
    }

    /** Who "Tambahkan" would add for the group: counts plus a short sample of names (nothing is written). */
    async previewGroup(scope: ServiceScope, filter: CsiRaterGroupFilter) {
        const { fresh, already } = await this.groupCandidates(scope, filter);
        return { total: fresh.length + already, alreadyRegistered: already, toAdd: fresh.length, sample: fresh.slice(0, SAMPLE_SIZE).map((user) => user.fullName) };
    }

    async addGroup(scope: ServiceScope, filter: CsiRaterGroupFilter) {
        const { fresh } = await this.groupCandidates(scope, filter);
        if (fresh.length > CSI_RATER_GROUP_MAX) throw new BadRequestException(`Kelompok terlalu besar (maks. ${CSI_RATER_GROUP_MAX} orang). Persempit dengan departemen.`);
        const raters = await this.master.addRaters(scope, fresh.map((user) => user.id));
        return { added: fresh.length, raters };
    }

    /**
     * Matches pasted/imported keys (email or NIK, case-insensitive) to active users. With `commit` the matched users are
     * registered; otherwise it is a dry run for the confirmation screen.
     */
    async importKeys(scope: ServiceScope, keys: string[], commit: boolean) {
        const wanted = [...new Set(keys.map((key) => key.trim()).filter(Boolean).map((key) => key.slice(0, KEY_MAX)))];
        if (wanted.length > CSI_RATER_IMPORT_MAX) throw new BadRequestException(`Maksimal ${CSI_RATER_IMPORT_MAX} baris per impor`);
        const lowered = wanted.map((key) => key.toLowerCase());
        const users = wanted.length ? await this.users.find({
            where: [
                { isActive: true, email: Raw((column) => `LOWER(${column}) IN (:...keys)`, { keys: lowered }) },
                { isActive: true, employeeId: In(wanted) },
            ],
            select: { id: true, fullName: true, email: true, employeeId: true },
        }) : [];
        const byKey = new Map<string, Candidate>();
        users.forEach((user) => {
            if (user.email) byKey.set(user.email.toLowerCase(), user);
            if (user.employeeId) byKey.set(user.employeeId.toLowerCase(), user);
        });
        const matched = new Map<string, Candidate>();
        const notFound: string[] = [];
        wanted.forEach((key) => {
            const user = byKey.get(key.toLowerCase());
            if (user) matched.set(user.id, user); else notFound.push(key);
        });
        const registered = await this.registeredIds(scope, [...matched.keys()]);
        const fresh = [...matched.values()].filter((user) => !registered.has(user.id));
        if (commit && fresh.length) await this.master.addRaters(scope, fresh.map((user) => user.id));
        return {
            matched: matched.size, alreadyRegistered: matched.size - fresh.length, toAdd: fresh.length, added: commit ? fresh.length : 0,
            notFound, sample: fresh.slice(0, SAMPLE_SIZE).map((user) => user.fullName),
        };
    }

    /** Removes several registered raters of the scope at once (unknown ids are ignored). */
    async removeMany(scope: ServiceScope, ids: string[]) {
        const unique = [...new Set(ids)];
        if (unique.length) await this.raters.delete({ scope, id: In(unique) });
        return this.master.listRaters(scope);
    }

    private async groupCandidates(scope: ServiceScope, filter: CsiRaterGroupFilter) {
        if (!filter.siteId && !filter.departmentId) throw new BadRequestException('Pilih site atau departemen');
        const users = await this.users.find({
            where: { isActive: true, ...(filter.siteId ? { siteId: filter.siteId } : {}), ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
            select: { id: true, fullName: true }, order: { fullName: 'ASC' },
        });
        const registered = await this.registeredIds(scope, users.map((user) => user.id));
        return { fresh: users.filter((user) => !registered.has(user.id)), already: registered.size };
    }

    private async registeredIds(scope: ServiceScope, userIds: string[]): Promise<Set<string>> {
        if (!userIds.length) return new Set();
        const rows = await this.raters.find({ where: { scope, userId: In(userIds) }, select: { userId: true } });
        return new Set(rows.map((row) => row.userId));
    }
}
