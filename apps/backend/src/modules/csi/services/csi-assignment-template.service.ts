import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { buildNameIndex, normalizeName } from '../org/csi-name-match';
import { CSI_HC_SERVICES, normalizeBagian } from '../org/csi-org.constants';
import { normalizeServiceFunction } from '../org/csi-org.service';
import { CsiTemplateSeed, CsiTemplateSeedPic, parseTemplateWorkbook } from '../org/csi-template-excel';
import { buildTemplateView, CsiTemplateView } from '../org/csi-template-view';
import { CSI_TEMPLATE_HC_SMG_2026 } from '../org/templates/hc-smg-2026.data';

/** Templates shipped with the app, loaded on request (idempotent). */
const BUNDLED: Readonly<Record<string, CsiTemplateSeed>> = { SMG: CSI_TEMPLATE_HC_SMG_2026 };
const LOCATION_NAMES: Readonly<Record<string, string>> = { SMG: 'Semarang', SPJ: 'Sepanjang', KRW: 'Karawang', JTB: 'Jakarta' };
const NOT_FOUND_MESSAGE = 'Template tidak ditemukan';
const PIC_NOT_FOUND_MESSAGE = 'PIC template tidak ditemukan';
const SERVICE_CODES = new Set(['HCC', 'HCD', 'HCS']);
const AREA_OF_SERVICE: Readonly<Record<string, string>> = { HCD: 'HC Development', HCC: 'HC Comben', HCS: 'HC Services' };

export type CsiTemplateImportReport = {
    pics: number; picsAdded: number; picsUpdated: number; ratersAdded: number;
    problems: Array<{ row: number; message: string }>; committed: boolean;
};
type PicIndex = (name: string) => CsiPic | 'ambiguous' | null;
const idOf = (hit: CsiPic | 'ambiguous' | null) => (hit && hit !== 'ambiguous' ? hit.id : null);
type Repos = { templates: Repository<CsiAssignmentTemplate>; pics: Repository<CsiAssignmentTemplatePic>; raters: Repository<CsiAssignmentTemplateRater> };

/**
 * Assignment templates per location ("siapa menilai siapa" by name, with each PIC's service function). Loading or
 * importing merges: new PICs and raters are added, titles/service functions refreshed, nothing is removed except by
 * an explicit delete in the editor.
 */
@Injectable()
export class CsiAssignmentTemplateService {
    constructor(
        @InjectRepository(CsiAssignmentTemplate) private readonly templates: Repository<CsiAssignmentTemplate>,
        @InjectRepository(CsiAssignmentTemplatePic) private readonly pics: Repository<CsiAssignmentTemplatePic>,
        @InjectRepository(CsiAssignmentTemplateRater) private readonly raters: Repository<CsiAssignmentTemplateRater>,
        @InjectRepository(CsiPic) private readonly csiPics: Repository<CsiPic>,
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(CsiOrgPerson) private readonly people: Repository<CsiOrgPerson>,
        @InjectRepository(Site) private readonly sites: Repository<Site>,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) { }

    async list(scope: ServiceScope) {
        const rows = await this.templates.find({ where: { scope } });
        const bundled = Object.keys(BUNDLED).filter((code) => !rows.some((row) => row.locationCode === code));
        return { templates: await Promise.all(rows.map((row) => this.get(scope, row.id))), bundledAvailable: bundled };
    }

    async get(scope: ServiceScope, id: string): Promise<CsiTemplateView> {
        const template = await this.templates.findOne({ where: { id, scope } });
        if (!template) throw new NotFoundException(NOT_FOUND_MESSAGE);
        const pics = await this.pics.find({ where: { templateId: id } });
        const raters = pics.length ? await this.raters.find({ where: { templatePicId: In(pics.map((pic) => pic.id)) } }) : [];
        return buildTemplateView(template, pics, raters, await this.activeAccounts());
    }

    /** Creates (or merges into) the template of a location from the copy bundled with the app. */
    async loadBundled(scope: ServiceScope, locationCode: string): Promise<CsiTemplateView> {
        const seed = BUNDLED[locationCode.toUpperCase()];
        if (!seed || seed.scope !== scope) throw new NotFoundException('Template bawaan untuk lokasi ini tidak ada');
        const id = await this.dataSource.transaction((manager) => this.loadInto(manager, scope, seed.locationCode, seed.name, seed.pics));
        return this.get(scope, id);
    }

    /** Excel in the Semarang layout; without `commit` only the report is returned. */
    async importExcel(scope: ServiceScope, locationCode: string, buffer: Buffer, commit: boolean): Promise<CsiTemplateImportReport> {
        const code = locationCode.toUpperCase();
        if (!LOCATION_NAMES[code]) throw new BadRequestException('Lokasi tidak dikenal');
        const draft = await parseTemplateWorkbook(buffer);
        const existing = await this.templates.findOne({ where: { scope, locationCode: code } });
        const report = await this.diff(existing?.id ?? null, draft.pics);
        if (!commit) return { ...report, problems: draft.problems, committed: false };
        if (!draft.pics.length) throw new BadRequestException('Tidak ada PIC di file');
        const name = existing?.name ?? `CSI ${scope} – ${LOCATION_NAMES[code]}`;
        await this.dataSource.transaction((manager) => this.loadInto(manager, scope, code, name, draft.pics));
        return { ...report, problems: draft.problems, committed: true };
    }

    async addPic(scope: ServiceScope, templateId: string, input: { serviceCode: string; picName: string; jobTitle?: string | null; serviceFunction?: string | null }) {
        await this.get(scope, templateId);
        const serviceCode = input.serviceCode.toUpperCase();
        if (!SERVICE_CODES.has(serviceCode)) throw new BadRequestException('Layanan tidak dikenal');
        const picName = normalizeName(input.picName);
        if (!picName) throw new BadRequestException('Nama PIC wajib diisi');
        if (await this.pics.findOne({ where: { templateId, picName } })) throw new BadRequestException('PIC sudah ada di template');
        const order = await this.pics.count({ where: { templateId } });
        await this.pics.save({
            templateId, area: AREA_OF_SERVICE[serviceCode], serviceCode, picName, jobTitle: input.jobTitle?.trim() || null,
            serviceFunction: normalizeServiceFunction(input.serviceFunction), picId: await this.matchPic(scope, picName), sortOrder: order,
        });
        return this.get(scope, templateId);
    }

    async updatePic(scope: ServiceScope, templatePicId: string, input: { jobTitle?: string | null; serviceFunction?: string | null }) {
        const pic = await this.findPic(scope, templatePicId);
        await this.pics.save({
            ...pic,
            ...(input.jobTitle === undefined ? {} : { jobTitle: input.jobTitle?.trim() || null }),
            ...(input.serviceFunction === undefined ? {} : { serviceFunction: normalizeServiceFunction(input.serviceFunction) }),
        });
        return this.get(scope, pic.templateId);
    }

    async removePic(scope: ServiceScope, templatePicId: string) {
        const pic = await this.findPic(scope, templatePicId);
        await this.raters.delete({ templatePicId: pic.id });
        await this.pics.delete({ id: pic.id });
        return this.get(scope, pic.templateId);
    }

    /** Adds a rater by name, or by account (`userId`, which then also gives the name). */
    async addRater(scope: ServiceScope, templatePicId: string, input: { name?: string; userId?: string; jobTitle?: string | null }) {
        const pic = await this.findPic(scope, templatePicId);
        const account = input.userId ? await this.users.findOne({ where: { id: input.userId, isActive: true } }) : null;
        if (input.userId && !account) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const raterName = normalizeName(account?.fullName ?? input.name);
        if (!raterName) throw new BadRequestException('Nama penilai wajib diisi');
        if (await this.raters.findOne({ where: { templatePicId: pic.id, raterName } })) throw new BadRequestException('Penilai sudah ada untuk PIC ini');
        await this.raters.save({ templatePicId: pic.id, raterName, raterJobTitle: input.jobTitle?.trim() || account?.jobTitle || null, userId: account?.id ?? null });
        return this.get(scope, pic.templateId);
    }

    /** Pins an ambiguous or unmatched rater to one account (null clears the pin). */
    async setRaterAccount(scope: ServiceScope, raterId: string, userId: string | null) {
        const rater = await this.raters.findOne({ where: { id: raterId } });
        if (!rater) throw new NotFoundException('Penilai tidak ditemukan');
        const pic = await this.findPic(scope, rater.templatePicId);
        if (userId && !(await this.users.findOne({ where: { id: userId, isActive: true } }))) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        await this.raters.save({ ...rater, userId });
        return this.get(scope, pic.templateId);
    }

    async removeRater(scope: ServiceScope, raterId: string) {
        const rater = await this.raters.findOne({ where: { id: raterId } });
        if (!rater) throw new NotFoundException('Penilai tidak ditemukan');
        const pic = await this.findPic(scope, rater.templatePicId);
        await this.raters.delete({ id: rater.id });
        return this.get(scope, pic.templateId);
    }

    /** Template, its PIC rows and raters (used by the apply step). */
    async rowsOf(scope: ServiceScope, templateId: string) {
        return { view: await this.get(scope, templateId), template: (await this.templates.findOne({ where: { id: templateId, scope } }))! };
    }

    /**
     * One transaction: PIC master first (so new PICs can be linked), then the template rows, then empty service
     * functions on the master. Any failure leaves nothing half-written.
     */
    private async loadInto(manager: EntityManager, scope: ServiceScope, locationCode: string, name: string, seedPics: CsiTemplateSeedPic[]) {
        const picRepo = manager.getRepository(CsiPic);
        await this.ensurePicMaster(manager, scope, locationCode, seedPics);
        const picIndex = buildNameIndex(await picRepo.find({ where: { scope } }), (row) => row.fullName);
        const id = await this.merge(manager, scope, locationCode, name, seedPics, picIndex);
        await this.fillPicServiceFunctions(picRepo, seedPics, picIndex);
        return id;
    }

    private async merge(manager: EntityManager, scope: ServiceScope, locationCode: string, name: string, seedPics: CsiTemplateSeedPic[],
        picIndex: PicIndex): Promise<string> {
        const repos = this.repos(manager);
        const template = (await repos.templates.findOne({ where: { scope, locationCode } })) ?? await repos.templates.save({ scope, locationCode, name });
        const existing = await repos.pics.find({ where: { templateId: template.id } });
        const byName = new Map(existing.map((pic) => [pic.picName, pic]));
        let order = existing.length;
        for (const seed of seedPics) {
            const known = byName.get(seed.picName);
            const saved = await repos.pics.save({
                ...(known ?? { templateId: template.id, sortOrder: order++ }),
                // Re-matched on every load: a PIC imported into the master later gets linked then.
                picId: known?.picId ?? idOf(picIndex(seed.picName)),
                area: seed.area, serviceCode: seed.serviceCode, picName: seed.picName,
                jobTitle: seed.jobTitle ?? known?.jobTitle ?? null, serviceFunction: normalizeServiceFunction(seed.serviceFunction) ?? known?.serviceFunction ?? null,
            });
            await this.mergeRaters(repos, saved.id, seed.raters);
        }
        return template.id;
    }

    private async mergeRaters(repos: Repos, templatePicId: string, seedRaters: CsiTemplateSeedPic['raters']) {
        const known = new Set((await repos.raters.find({ where: { templatePicId } })).map((rater) => rater.raterName));
        const fresh = seedRaters.filter((rater) => !known.has(rater.name));
        if (fresh.length) await repos.raters.save(fresh.map((rater) => ({ templatePicId, raterName: rater.name, raterJobTitle: rater.jobTitle, userId: null })));
    }

    /** What a merge would add / change (dry run of an import). */
    private async diff(templateId: string | null, seedPics: CsiTemplateSeedPic[]) {
        const existing = templateId ? await this.pics.find({ where: { templateId } }) : [];
        const byName = new Map(existing.map((pic) => [pic.picName, pic]));
        const raters = existing.length ? await this.raters.find({ where: { templatePicId: In(existing.map((pic) => pic.id)) } }) : [];
        const ratersOf = (picId: string) => new Set(raters.filter((rater) => rater.templatePicId === picId).map((rater) => rater.raterName));
        let ratersAdded = 0;
        seedPics.forEach((seed) => {
            const known = byName.get(seed.picName);
            const names = known ? ratersOf(known.id) : new Set<string>();
            ratersAdded += seed.raters.filter((rater) => !names.has(rater.name)).length;
        });
        const picsAdded = seedPics.filter((seed) => !byName.has(seed.picName)).length;
        return { pics: seedPics.length, picsAdded, picsUpdated: seedPics.length - picsAdded, ratersAdded };
    }

    /** csi_pics.serviceFunction is filled from the template only while it is still empty (manual edits win). */
    private async fillPicServiceFunctions(picRepo: Repository<CsiPic>, seedPics: CsiTemplateSeedPic[], picIndex: PicIndex) {
        for (const seed of seedPics) {
            const value = normalizeServiceFunction(seed.serviceFunction);
            const pic = picIndex(seed.picName);
            if (value && pic && pic !== 'ambiguous' && !pic.serviceFunction) await picRepo.save({ ...pic, serviceFunction: value });
        }
    }

    private async matchPic(scope: ServiceScope, picName: string): Promise<string | null> {
        return idOf(buildNameIndex(await this.csiPics.find({ where: { scope } }), (row) => row.fullName)(picName));
    }

    /**
     * Every template PIC must exist in the PIC master: a deactivated one is switched back on, a missing one is created
     * from the employee directory (HC staff of a location are filed under "HCBP AREA <lokasi>", which the directory
     * sync does not treat as HC). Names not in the directory (new staff) stay unmatched.
     */
    private async ensurePicMaster(manager: EntityManager, scope: ServiceScope, locationCode: string, seedPics: CsiTemplateSeedPic[]) {
        const picRepo = manager.getRepository(CsiPic);
        const all = await picRepo.find({ where: { scope } });
        const index = buildNameIndex(all, (row) => row.fullName);
        const missing: CsiTemplateSeedPic[] = [];
        for (const seed of seedPics) {
            const hit = index(seed.picName);
            if (hit === 'ambiguous') continue;
            if (!hit) missing.push(seed);
            else if (!hit.isActive) await picRepo.save({ ...hit, isActive: true });
        }
        if (missing.length) await this.createPicsFromDirectory(manager, scope, locationCode, missing, all);
    }

    /**
     * Directory rows that can become HC PICs: HCBP AREA staff and the three HC departments. Names are compared in memory
     * with normalizeName, so the directory's own casing, dots or commas never hide a match.
     */
    private directoryCandidates(manager: EntityManager, seeds: CsiTemplateSeedPic[]): Promise<CsiOrgPerson[]> {
        if (!seeds.length) return Promise.resolve([]);
        return manager.getRepository(CsiOrgPerson).createQueryBuilder('p')
            .where('p."department" ILIKE :hcbp OR UPPER(p."department") IN (:...hc)', {
                hcbp: 'HCBP AREA%', hc: CSI_HC_SERVICES.map((service) => service.department),
            })
            .getMany();
    }

    private async createPicsFromDirectory(manager: EntityManager, scope: ServiceScope, locationCode: string, seeds: CsiTemplateSeedPic[], existing: CsiPic[]) {
        const findPerson = buildNameIndex(await this.directoryCandidates(manager, seeds), (row) => row.fullName);
        const site = await manager.getRepository(Site).findOne({ where: { code: locationCode } });
        for (const seed of seeds) {
            const person = findPerson(seed.picName);
            if (!person || person === 'ambiguous' || existing.some((pic) => pic.nik === person.nik)) continue;
            const account = await manager.getRepository(User).findOne({ where: { employeeId: person.nik } });
            await manager.getRepository(CsiPic).save({
                scope, nik: person.nik, fullName: person.fullName, jobTitle: person.jobTitle ?? seed.jobTitle, serviceCode: seed.serviceCode,
                serviceFunction: normalizeServiceFunction(seed.serviceFunction), bagian: normalizeBagian(person.bagian), workLocation: person.workLocation,
                siteId: site?.id ?? null, userId: account?.id ?? null, photoUrl: null, isActive: true,
            });
        }
    }

    private async findPic(scope: ServiceScope, templatePicId: string) {
        const pic = await this.pics.findOne({ where: { id: templatePicId } });
        if (!pic || !(await this.templates.findOne({ where: { id: pic.templateId, scope } }))) throw new NotFoundException(PIC_NOT_FOUND_MESSAGE);
        return pic;
    }

    private async activeAccounts() {
        return this.users.find({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true, siteId: true } });
    }

    private repos(manager: EntityManager): Repos {
        return {
            templates: manager.getRepository(CsiAssignmentTemplate), pics: manager.getRepository(CsiAssignmentTemplatePic),
            raters: manager.getRepository(CsiAssignmentTemplateRater),
        };
    }
}
