import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { wibEndOfDate, wibStartOfDate } from '../../../shared/core/utils/wib-date.util';
import { HandlingTeam, Ticket, TicketType } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CsiRater } from '../entities/csi-rater.entity';
import { CsiMasterService } from './csi-master.service';

/** Upper bounds keep one click from registering a whole company by accident. */
export const CSI_RATER_GROUP_MAX = 2000;
export const CSI_RATER_IMPORT_MAX = 2000;
export const CSI_RATER_TICKET_MAX = 5000;
const SAMPLE_SIZE = 8;
const KEY_MAX = 200;
const DEV_TICKET_TYPES = [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST];

export type CsiRaterGroupFilter = { siteId?: string; departmentId?: string };
export type CsiTicketRaterFilter = { siteId?: string; startDate?: string; endDate?: string; includeAllRoles?: boolean };
export type CsiTicketRaterSiteSummary = { code: string; name: string; total: number; toAdd: number };
type Candidate = Pick<User, 'id' | 'fullName'>;
type TicketCandidate = Candidate & { siteCode: string | null; siteName: string | null };

/** Bulk ways to register raters: a whole group (site / HR department), pasted/imported list, or IT Support ticket requesters. */
@Injectable()
export class CsiRaterBulkService {
    constructor(
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(CsiRater) private readonly raters: Repository<CsiRater>,
        @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
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

    /** Previews active, logged-in users who have ever filed an IT Support (OPS_SUPPORT, non-dev) ticket. */
    async previewTicketRaters(scope: ServiceScope, filter: CsiTicketRaterFilter) {
        const { candidates, fresh, already, registered } = await this.ticketCandidates(scope, filter);
        const bySite = summarizeBySite(candidates, registered);
        return {
            total: candidates.length,
            alreadyRegistered: already,
            toAdd: fresh.length,
            sample: fresh.slice(0, SAMPLE_SIZE).map((user) => user.fullName),
            bySite,
        };
    }

    /** Registers eligible IT Support ticket requesters not yet in the scope's rater list (additive). */
    async addTicketRaters(scope: ServiceScope, filter: CsiTicketRaterFilter) {
        const { fresh } = await this.ticketCandidates(scope, filter);
        if (fresh.length > CSI_RATER_TICKET_MAX) {
            throw new BadRequestException(`Kelompok terlalu besar (maks. ${CSI_RATER_TICKET_MAX} orang). Persempit dengan filter site atau tanggal.`);
        }
        const raters = await this.master.addRaters(scope, fresh.map((user) => user.id));
        return { added: fresh.length, raters };
    }

    private async ticketCandidates(scope: ServiceScope, filter: CsiTicketRaterFilter) {
        if (scope !== ServiceScope.ICT) {
            throw new BadRequestException('Template penilai tiket IT Support hanya tersedia untuk CSI ICT');
        }
        if (filter.startDate && filter.endDate && filter.endDate < filter.startDate) {
            throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai');
        }
        const qb = this.tickets.createQueryBuilder('ticket')
            .innerJoin('ticket.user', 'user')
            .leftJoin('user.site', 'site')
            .select('user.id', 'id')
            .addSelect('user.fullName', 'fullName')
            .addSelect('site.code', 'siteCode')
            .addSelect('site.name', 'siteName')
            .where('user.isActive = true')
            .andWhere('user.siteId IS NOT NULL')
            .andWhere('user.lastActiveAt IS NOT NULL')
            .andWhere('(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)', { opsTeam: HandlingTeam.OPS_SUPPORT })
            .andWhere('(ticket.ticketType NOT IN (:...devTypes) OR ticket.ticketType IS NULL)', { devTypes: DEV_TICKET_TYPES });

        if (!filter.includeAllRoles) {
            qb.andWhere('user.role = :requesterRole', { requesterRole: UserRole.USER });
        }
        if (filter.siteId) {
            qb.andWhere('user.siteId = :siteId', { siteId: filter.siteId });
        }
        if (filter.startDate) {
            qb.andWhere('ticket.createdAt >= :startAt', { startAt: wibStartOfDate(filter.startDate) });
        }
        if (filter.endDate) {
            qb.andWhere('ticket.createdAt <= :endAt', { endAt: wibEndOfDate(filter.endDate) });
        }

        const rows: Array<{ id: string; fullName: string; siteCode: string | null; siteName: string | null }> = await qb
            .groupBy('user.id')
            .addGroupBy('user.fullName')
            .addGroupBy('site.code')
            .addGroupBy('site.name')
            .orderBy('user.fullName', 'ASC')
            .getRawMany();

        const candidates: TicketCandidate[] = rows.map((row) => ({
            id: row.id,
            fullName: row.fullName,
            siteCode: row.siteCode ?? null,
            siteName: row.siteName ?? null,
        }));
        const registered = await this.registeredIds(scope, candidates.map((user) => user.id));
        const fresh = candidates.filter((user) => !registered.has(user.id));
        return { candidates, fresh, already: registered.size, registered };
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

function summarizeBySite(candidates: TicketCandidate[], registered: ReadonlySet<string>): CsiTicketRaterSiteSummary[] {
    const groups = new Map<string, CsiTicketRaterSiteSummary>();
    for (const candidate of candidates) {
        const code = candidate.siteCode ?? '-';
        const entry = groups.get(code) ?? { code, name: candidate.siteName ?? code, total: 0, toAdd: 0 };
        entry.total += 1;
        if (!registered.has(candidate.id)) entry.toAdd += 1;
        groups.set(code, entry);
    }
    return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}
