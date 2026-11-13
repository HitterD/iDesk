import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiPeriod } from '../entities/csi-period.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiResponse } from '../entities/csi-response.entity';
import { lockPeriodRow } from '../services/csi-period-lock.util';
import { surveyStage } from '../services/csi-survey-stage.util';
import { suggestAccounts } from './csi-account-suggest';
import { CsiOrgRow, readOrgWorkbook } from './csi-org-import';
import {
    CSI_HC_SERVICES, CsiOrgLocation, locationOfSiteCode, locationOfWorkLocation, normalizeBagian, normalizeNik,
    serviceOfDepartment, siteCodeOfLocation,
} from './csi-org.constants';

const UPSERT_CHUNK = 500;
const PIC_NOT_FOUND_MESSAGE = 'PIC tidak ditemukan';
const SUGGESTION_QUERY_MIN = 2;
const SUGGESTION_QUERY_MAX = 150;
const SUGGESTION_LIMIT = 8;
const DIRECT_MATCH_SCORE = 1.5;
export const CSI_SERVICE_FUNCTION_MAX = 150;

/** Trimmed service function; blank clears it. */
export function normalizeServiceFunction(value: string | null | undefined): string | null {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > CSI_SERVICE_FUNCTION_MAX) throw new BadRequestException(`Fungsi pelayanan maksimal ${CSI_SERVICE_FUNCTION_MAX} karakter`);
    return text || null;
}

/** Organisation of a respondent at answer time. */
export type CsiRespondentOrg = {
    nik: string | null; division: string | null; department: string | null; bagian: string | null; location: CsiOrgLocation | null;
    /** True when the directory knows the NIK (division/department/bagian are then authoritative). */
    fromDirectory: boolean;
};

export type CsiPicUserSummary = { id: string; fullName: string; email: string };
export type CsiPicView = {
    id: string; nik: string; fullName: string; jobTitle: string | null; serviceCode: string; serviceName: string | null; serviceFunction: string | null;
    bagian: string | null; workLocation: string | null; siteId: string | null; userId: string | null; user: CsiPicUserSummary | null;
    photoUrl: string | null; isActive: boolean;
};

export const picView = (pic: CsiPic): CsiPicView => ({
    id: pic.id, nik: pic.nik, fullName: pic.fullName, jobTitle: pic.jobTitle, serviceCode: pic.serviceCode,
    serviceName: CSI_HC_SERVICES.find((service) => service.code === pic.serviceCode)?.name ?? null, serviceFunction: pic.serviceFunction ?? null,
    bagian: pic.bagian, workLocation: pic.workLocation, siteId: pic.siteId, userId: pic.userId,
    user: pic.user ? { id: pic.user.id, fullName: pic.user.fullName, email: pic.user.email } : null,
    photoUrl: pic.photoUrl ?? pic.user?.avatarUrl ?? null, isActive: pic.isActive,
});

/** Directory (csi_org_people) and HC PIC master (csi_pics). */
@Injectable()
export class CsiOrgService {
    constructor(
        @InjectRepository(CsiOrgPerson) private readonly people: Repository<CsiOrgPerson>,
        @InjectRepository(CsiPic) private readonly pics: Repository<CsiPic>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(Site) private readonly sites: Repository<Site>,
        @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
    ) { }

    /**
     * Imports the approver hierarchy workbook: upserts every employee into the directory (nobody is deleted: people who
     * left stay for past answers), syncs active users' siteId from Work Location, and adds/updates HC PICs.
     */
    async importWorkbook(scope: ServiceScope, buffer: Buffer) {
        let parsed: { rows: CsiOrgRow[]; skipped: number };
        try {
            parsed = await readOrgWorkbook(buffer);
        } catch (error) {
            throw new BadRequestException(`File tidak bisa dibaca: ${(error as Error).message}`);
        }
        if (!parsed.rows.length) throw new BadRequestException('Tidak ada data karyawan di file');
        await this.upsertPeople(parsed.rows);
        const usersSitesUpdated = await this.syncUsersSiteFromDirectory(parsed.rows);
        const pics = scope === ServiceScope.HC ? await this.syncPicsFromDirectory(scope) : { added: 0, updated: 0 };
        return { people: parsed.rows.length, skipped: parsed.skipped, picsAdded: pics.added, picsUpdated: pics.updated, usersSitesUpdated };
    }

    /** Updates active user accounts whose normalized employeeId matches a directory row with a mapped Work Location. */
    async syncUsersSiteFromDirectory(rows: ReadonlyArray<Pick<CsiOrgRow, 'nik' | 'workLocation'>>): Promise<number> {
        if (!rows.length) return 0;
        const siteIdOf = await this.siteIdsByCode();
        const targetByNik = new Map<string, string>();
        for (const row of rows) {
            const nik = normalizeNik(row.nik);
            const code = siteCodeOfLocation(locationOfWorkLocation(row.workLocation));
            const siteId = code ? siteIdOf.get(code) : undefined;
            if (nik && siteId) targetByNik.set(nik, siteId);
        }
        if (!targetByNik.size) return 0;
        const users = await this.users.find({ where: { isActive: true }, select: { id: true, employeeId: true, siteId: true } });
        const bySite = new Map<string, string[]>();
        let updated = 0;
        for (const user of users) {
            const nik = normalizeNik(user.employeeId);
            const target = nik ? targetByNik.get(nik) : undefined;
            if (!target || user.siteId === target) continue;
            bySite.set(target, [...(bySite.get(target) ?? []), user.id]);
            updated += 1;
        }
        for (const [siteId, ids] of bySite) {
            for (let start = 0; start < ids.length; start += UPSERT_CHUNK) {
                await this.users.update({ id: In(ids.slice(start, start + UPSERT_CHUNK)) }, { siteId });
            }
        }
        return updated;
    }

    async upsertPeople(rows: CsiOrgRow[]) {
        for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
            await this.people.upsert(rows.slice(start, start + UPSERT_CHUNK), ['nik']);
        }
    }

    directoryCount() {
        return this.people.count();
    }

    /**
     * Every directory person of HCC / HCD / HCS becomes an active PIC (new ones added, existing ones refreshed: name,
     * title, service, bagian, location). PICs no longer in those departments are kept but deactivated; photos and a
     * manual deactivation of someone still listed are kept.
     */
    async syncPicsFromDirectory(scope: ServiceScope) {
        const departments = CSI_HC_SERVICES.map((service) => service.department);
        const staff = await this.people.find({ where: { department: In(departments) } });
        const existing = await this.pics.find({ where: { scope } });
        const byNik = new Map(existing.map((pic) => [pic.nik, pic]));
        const accounts = staff.length ? await this.users.find({ select: { id: true, employeeId: true } }) : [];
        const userOf = new Map<string, string>();
        for (const user of accounts) {
            const nik = normalizeNik(user.employeeId);
            if (nik && !userOf.has(nik)) userOf.set(nik, user.id);
        }
        const siteIdOf = await this.siteIdsByCode();
        let added = 0;
        let updated = 0;
        const rows = staff.map((person) => {
            const location = locationOfWorkLocation(person.workLocation);
            const previous = byNik.get(person.nik);
            if (previous) updated += 1; else added += 1;
            return {
                ...(previous ?? { scope, nik: person.nik, photoUrl: null, isActive: true }),
                fullName: person.fullName, jobTitle: person.jobTitle, serviceCode: serviceOfDepartment(person.department)!,
                bagian: normalizeBagian(person.bagian), workLocation: person.workLocation,
                siteId: siteIdOf.get(siteCodeOfLocation(location) ?? '') ?? null, userId: previous?.userId ?? userOf.get(person.nik) ?? null,
            };
        });
        if (rows.length) await this.pics.save(rows);
        const listed = new Set(staff.map((person) => person.nik));
        // PICs named in an assignment template stay active (e.g. HC staff filed under "HCBP AREA <lokasi>").
        const templated = new Set((await this.pics.query('SELECT DISTINCT "picId" FROM "csi_assignment_template_pics" WHERE "picId" IS NOT NULL') as Array<{ picId: string }>)
            .map((row) => row.picId));
        const gone = existing.filter((pic) => !listed.has(pic.nik) && pic.isActive && !templated.has(pic.id)).map((pic) => pic.id);
        if (gone.length) await this.pics.update({ id: In(gone) }, { isActive: false });
        return { added, updated, deactivated: gone.length };
    }

    async listPics(scope: ServiceScope, includeInactive = false): Promise<CsiPicView[]> {
        const rows = await this.pics.find({
            where: { scope, ...(includeInactive ? {} : { isActive: true }) }, relations: { user: true },
            order: { serviceCode: 'ASC', bagian: 'ASC', fullName: 'ASC' },
        });
        return rows.map(picView);
    }

    /** Searches active iDesk accounts by name similarity, email, or NIK for manual PIC linking. */
    async accountSuggestions(search: string, siteId?: string | null) {
        const trimmed = typeof search === 'string' ? search.trim() : '';
        if (trimmed.length < SUGGESTION_QUERY_MIN) throw new BadRequestException(`Kata kunci minimal ${SUGGESTION_QUERY_MIN} karakter`);
        if (trimmed.length > SUGGESTION_QUERY_MAX) throw new BadRequestException('Kata kunci terlalu panjang');
        const accounts = await this.users.find({
            where: { isActive: true }, relations: { site: true, department: true }, relationLoadStrategy: 'join',
            select: { id: true, fullName: true, email: true, employeeId: true, siteId: true, site: { code: true }, department: { name: true } },
        });
        const candidates = accounts.map((account) => ({
            id: account.id, fullName: account.fullName, email: account.email, employeeId: account.employeeId ?? null,
            siteId: account.siteId ?? null, siteCode: account.site?.code ?? null, department: account.department?.name ?? null,
        }));
        const byName = suggestAccounts(trimmed, candidates, { siteId: siteId ?? null, limit: candidates.length });
        const scored = new Map(byName.map((row) => [row.id, row]));
        const needle = trimmed.toLowerCase();
        for (const candidate of candidates) {
            const direct = candidate.email.toLowerCase().includes(needle) || (candidate.employeeId ?? '').toLowerCase().includes(needle);
            if (direct && !scored.has(candidate.id)) scored.set(candidate.id, { ...candidate, score: DIRECT_MATCH_SCORE });
        }
        return [...scored.values()].sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName)).slice(0, SUGGESTION_LIMIT);
    }

    /** Updates active flag, service function, and/or linked iDesk account (syncing draft surveys on account change). */
    async updatePic(scope: ServiceScope, id: string, input: { isActive?: boolean; serviceFunction?: string | null; userId?: string | null }): Promise<CsiPicView> {
        const pic = await this.pics.findOne({ where: { id, scope }, relations: { user: true } });
        if (!pic) throw new NotFoundException(PIC_NOT_FOUND_MESSAGE);
        let nextUser = pic.user;
        if (input.userId !== undefined) {
            if (input.userId === null) {
                nextUser = null;
            } else {
                const account = await this.users.findOne({ where: { id: input.userId } });
                if (!account || !account.isActive) throw new BadRequestException('Akun iDesk tidak ditemukan atau tidak aktif');
                const clash = await this.pics.findOne({ where: { scope, userId: input.userId } });
                if (clash && clash.id !== pic.id) throw new BadRequestException(`Akun iDesk sudah tertaut ke PIC lain (${clash.fullName})`);
                nextUser = account;
            }
        }
        const patch = {
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
            ...(input.serviceFunction === undefined ? {} : { serviceFunction: normalizeServiceFunction(input.serviceFunction) }),
            ...(input.userId === undefined ? {} : { userId: input.userId, user: nextUser }),
        };
        const userChanged = input.userId !== undefined && input.userId !== pic.userId;
        if (userChanged && this.dataSource) {
            const saved = await this.dataSource.transaction(async (manager) => {
                const updated = await manager.getRepository(CsiPic).save({ ...pic, ...patch });
                await this.syncDraftRateeUser(manager, pic.id, input.userId ?? null);
                return updated;
            });
            return picView({ ...saved, user: nextUser });
        }
        const saved = await this.pics.save({ ...pic, ...patch });
        return picView({ ...saved, user: nextUser });
    }

    /** Keeps draft survey ratee snapshots aligned when a PIC is manually linked or unlinked from an iDesk account. */
    private async syncDraftRateeUser(manager: EntityManager, picId: string, userId: string | null) {
        const repo = manager.getRepository(CsiPeriodRatee);
        const candidates = await repo.find({ where: { picId }, select: { id: true, periodId: true } });
        const periodIds = [...new Set(candidates.map((ratee) => ratee.periodId))].sort();
        if (!periodIds.length) return;
        for (const id of periodIds) await lockPeriodRow(manager, id);
        const ratees = await repo.find({ where: { picId, periodId: In(periodIds) }, select: { id: true, periodId: true } });
        const periods = await manager.getRepository(CsiPeriod).find({ where: { id: In(periodIds) } });
        const answered = new Set((await manager.getRepository(CsiResponse)
            .find({ where: { periodId: In(periodIds) }, select: { id: true, periodId: true } })).map((row) => row.periodId));
        const now = new Date();
        const drafts = new Set(periods.filter((period) => surveyStage(period, answered.has(period.id), now) === 'draft').map((period) => period.id));
        const ids = ratees.filter((ratee) => drafts.has(ratee.periodId)).map((ratee) => ratee.id);
        if (ids.length) await repo.update({ id: In(ids) }, { userId });
    }

    async setPicPhoto(scope: ServiceScope, id: string, photoUrl: string): Promise<{ view: CsiPicView; previous: string | null }> {
        const pic = await this.pics.findOne({ where: { id, scope }, relations: { user: true } });
        if (!pic) throw new NotFoundException(PIC_NOT_FOUND_MESSAGE);
        const saved = await this.pics.save({ ...pic, photoUrl });
        return { view: picView(saved), previous: pic.photoUrl };
    }

    findPics(scope: ServiceScope, ids: string[]) {
        return ids.length ? this.pics.find({ where: { scope, id: In(ids) }, relations: { user: true } }) : Promise.resolve([]);
    }

    /**
     * Organisation of an account: the directory row of its NIK when there is one; otherwise the location of its site
     * (division/department/bagian then come from the department the respondent picked, see the respondent service).
     */
    async respondentOrg(userId: string): Promise<CsiRespondentOrg> {
        const user = await this.users.findOne({ where: { id: userId }, relations: { site: true }, select: { id: true, employeeId: true, site: { id: true, code: true } } });
        const nik = normalizeNik(user?.employeeId);
        const person = nik ? await this.people.findOne({ where: { nik } }) : null;
        if (!person) {
            return { nik, division: null, department: null, bagian: null, location: locationOfSiteCode(user?.site?.code), fromDirectory: false };
        }
        return {
            nik, division: person.division, department: person.department, bagian: normalizeBagian(person.bagian),
            location: locationOfWorkLocation(person.workLocation) ?? locationOfSiteCode(user?.site?.code), fromDirectory: true,
        };
    }

    private async siteIdsByCode() {
        const rows = await this.sites.find({ select: { id: true, code: true } });
        return new Map(rows.map((site) => [site.code, site.id]));
    }
}
