import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiOrgRow, readOrgWorkbook } from './csi-org-import';
import {
    CSI_HC_SERVICES, CsiOrgLocation, locationOfSiteCode, locationOfWorkLocation, normalizeBagian, normalizeNik,
    serviceOfDepartment, siteCodeOfLocation,
} from './csi-org.constants';

const UPSERT_CHUNK = 500;
const PIC_NOT_FOUND_MESSAGE = 'PIC tidak ditemukan';

/** Organisation of a respondent at answer time. */
export type CsiRespondentOrg = {
    nik: string | null; division: string | null; department: string | null; bagian: string | null; location: CsiOrgLocation | null;
    /** True when the directory knows the NIK (division/department/bagian are then authoritative). */
    fromDirectory: boolean;
};

export type CsiPicView = {
    id: string; nik: string; fullName: string; jobTitle: string | null; serviceCode: string; serviceName: string | null;
    bagian: string | null; workLocation: string | null; siteId: string | null; userId: string | null; photoUrl: string | null; isActive: boolean;
};

export const picView = (pic: CsiPic): CsiPicView => ({
    id: pic.id, nik: pic.nik, fullName: pic.fullName, jobTitle: pic.jobTitle, serviceCode: pic.serviceCode,
    serviceName: CSI_HC_SERVICES.find((service) => service.code === pic.serviceCode)?.name ?? null,
    bagian: pic.bagian, workLocation: pic.workLocation, siteId: pic.siteId, userId: pic.userId,
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
    ) { }

    /**
     * Imports the approver hierarchy workbook: upserts every employee into the directory (nobody is deleted: people who
     * left stay for past answers) and then adds/updates the HC PICs from it. Returns the counts.
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
        const pics = scope === ServiceScope.HC ? await this.syncPicsFromDirectory(scope) : { added: 0, updated: 0 };
        return { people: parsed.rows.length, skipped: parsed.skipped, picsAdded: pics.added, picsUpdated: pics.updated };
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
        const accounts = staff.length ? await this.users.find({ where: { employeeId: In(staff.map((row) => row.nik)) }, select: { id: true, employeeId: true } }) : [];
        const userOf = new Map(accounts.map((user) => [user.employeeId, user.id]));
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
                siteId: siteIdOf.get(siteCodeOfLocation(location) ?? '') ?? null, userId: userOf.get(person.nik) ?? previous?.userId ?? null,
            };
        });
        if (rows.length) await this.pics.save(rows);
        const listed = new Set(staff.map((person) => person.nik));
        const gone = existing.filter((pic) => !listed.has(pic.nik) && pic.isActive).map((pic) => pic.id);
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

    async setPicActive(scope: ServiceScope, id: string, isActive: boolean): Promise<CsiPicView> {
        const pic = await this.pics.findOne({ where: { id, scope }, relations: { user: true } });
        if (!pic) throw new NotFoundException(PIC_NOT_FOUND_MESSAGE);
        return picView(await this.pics.save({ ...pic, isActive }));
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
