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
import { normalizeBagian } from '../org/csi-org.constants';
import { normalizeServiceFunction } from '../org/csi-org.service';
import { CsiTemplateSeed, CsiTemplateSeedPic } from '../org/csi-template-excel';
import { buildTemplateView, CsiTemplateView, lookupOf, resolveRater } from '../org/csi-template-view';
import { suggestAccounts } from '../org/csi-account-suggest';
import { CSI_TEMPLATE_HC_SMG_2026 } from '../org/templates/hc-smg-2026.data';
import { hcDirectoryCandidates } from './csi-template-import.service';
import { buildBlankTemplate } from '../org/csi-template-blank';
import { csiTemplateLocation } from '../org/csi-template-locations';

/** Templates shipped with the app, loaded on request (idempotent). */
const BUNDLED: Readonly<Record<string, CsiTemplateSeed>> = { SMG: CSI_TEMPLATE_HC_SMG_2026 };
const NOT_FOUND_MESSAGE = 'Template tidak ditemukan';
/** Same as the DB text limit of a template name. */
const SUGGESTION_NAME_MAX = 150;
const PIC_NOT_FOUND_MESSAGE = 'PIC template tidak ditemukan';
const SERVICE_CODES = new Set(['HCC', 'HCD', 'HCS']);
const AREA_OF_SERVICE: Readonly<Record<string, string>> = { HCD: 'HC Development', HCC: 'HC Comben', HCS: 'HC Services' };

type PicIndex = (name: string) => CsiPic | 'ambiguous' | null;
const idOf = (hit: CsiPic | 'ambiguous' | null) => (hit && hit !== 'ambiguous' ? hit.id : null);
type Repos = { templates: Repository<CsiAssignmentTemplate>; pics: Repository<CsiAssignmentTemplatePic>; raters: Repository<CsiAssignmentTemplateRater> };

/**
 * Assignment templates per location ("siapa menilai siapa" by name, with each PIC's service function). Loading the
 * bundled copy merges: new PICs and raters are added, titles/service functions refreshed, nothing is removed except by
 * an explicit delete in the editor. Excel import (replace, resolutions, teams) lives in CsiTemplateImportService.
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

    async accountSuggestions(scope: ServiceScope, templateId: string, name: string) {
        if (typeof name !== 'string' || name.trim().length < 2) throw new BadRequestException('Nama minimal 2 karakter');
        // A query param has no DTO limit; an unbounded name would be fuzzy-matched against every active user.
        if (name.trim().length > SUGGESTION_NAME_MAX) throw new BadRequestException('Nama terlalu panjang');
        const template = await this.templates.findOne({ where: { id: templateId, scope } });
        if (!template) throw new NotFoundException(NOT_FOUND_MESSAGE);
        const site = await this.sites.findOne({ where: { code: template.locationCode } });
        // Joined relations keep suggestions to one active-user query, without per-candidate lookups.
        const accounts = await this.users.find({
            where: { isActive: true }, relations: { site: true, department: true }, relationLoadStrategy: 'join',
            select: { id: true, fullName: true, email: true, employeeId: true, siteId: true, site: { code: true }, department: { name: true } },
        });
        return suggestAccounts(name.trim(), accounts.map((account) => ({
            id: account.id, fullName: account.fullName, email: account.email, employeeId: account.employeeId ?? null,
            siteId: account.siteId ?? null, siteCode: account.site?.code ?? null, department: account.department?.name ?? null,
        })), { siteId: site?.id ?? null });
    }

    /** Creates (or merges into) the template of a location from the copy bundled with the app. */
    async loadBundled(scope: ServiceScope, locationCode: string): Promise<CsiTemplateView> {
        const seed = BUNDLED[locationCode.toUpperCase()];
        if (!seed || seed.scope !== scope) throw new NotFoundException('Template bawaan untuk lokasi ini tidak ada');
        const pics = seed.pics.map((pic) => ({ ...pic, nik: pic.nik ?? null, raters: pic.raters.map((rater) => ({ ...rater, nik: rater.nik ?? null })) }));
        const id = await this.dataSource.transaction((manager) => this.loadInto(manager, scope, seed.locationCode, seed.name, pics));
        return this.get(scope, id);
    }

    /** Blank workbook to fill in for a location, listing its active employees (one query, by name) to copy from. */
    async blankWorkbook(scope: ServiceScope, locationCode: string): Promise<{ filename: string; buffer: Buffer }> {
        const location = csiTemplateLocation(locationCode);
        const employees = await this.users.find({
            where: { isActive: true, site: { code: location.code } }, select: { fullName: true, jobTitle: true, employeeId: true }, order: { fullName: 'ASC' },
        });
        const buffer = await buildBlankTemplate(location, employees.map((user) => ({
            fullName: user.fullName, jobTitle: user.jobTitle ?? null, employeeId: user.employeeId ?? null,
        })));
        return { filename: `CSI ${scope} ${location.name} - template.xlsx`, buffer };
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
    async addRater(scope: ServiceScope, templatePicId: string, input: { name?: string; userId?: string; jobTitle?: string | null }, actorId: string) {
        const pic = await this.findPic(scope, templatePicId);
        const account = input.userId ? await this.users.findOne({ where: { id: input.userId, isActive: true } }) : null;
        if (input.userId && !account) throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
        const raterName = normalizeName(account?.fullName ?? input.name);
        if (!raterName) throw new BadRequestException('Nama penilai wajib diisi');
        if (await this.raters.findOne({ where: { templatePicId: pic.id, raterName } })) throw new BadRequestException('Penilai sudah ada untuk PIC ini');
        await this.raters.save({
            templatePicId: pic.id, raterName, raterJobTitle: input.jobTitle?.trim() || account?.jobTitle || null, userId: account?.id ?? null,
            confirmedAt: account ? new Date() : null, confirmedById: account ? actorId ?? null : null,
        });
        return this.get(scope, pic.templateId);
    }

    /** Legacy single-row API shares the bulk transaction and audit trail. */
    async setRaterAccount(scope: ServiceScope, raterId: string, userId: string | null, actorId: string) {
        return this.setRaterAccounts(scope, [raterId], userId, actorId);
    }

    async setRaterAccounts(scope: ServiceScope, raterIds: string[], userId: string | null, actorId: string) {
        const templateId = await this.dataSource.transaction(async (manager) => {
            const selection = await this.scopedRaters(manager, scope, raterIds);
            if (userId != null && !(await manager.getRepository(User).findOne({ where: { id: userId, isActive: true } }))) {
                throw new BadRequestException('Pengguna tidak ditemukan atau tidak aktif');
            }
            const confirmedAt = userId == null ? null : new Date();
            await manager.getRepository(CsiAssignmentTemplateRater).save(selection.raters.map((rater) => ({
                ...rater, userId, confirmedAt, confirmedById: userId == null ? null : actorId,
            })));
            return selection.templateId;
        });
        return this.get(scope, templateId);
    }

    async confirmRaters(scope: ServiceScope, raterIds: string[], confirmed: boolean, actorId: string) {
        const templateId = await this.dataSource.transaction(async (manager) => {
            const selection = await this.scopedRaters(manager, scope, raterIds);
            const accounts = confirmed ? await this.activeAccounts(manager.getRepository(User)) : [];
            const lookup = lookupOf(accounts);
            const resolved = selection.raters.map((rater) => ({ rater, match: resolveRater(rater, lookup) }));
            const rejected = resolved.filter(({ match }) => match.status === 'ambiguous' || match.status === 'no-account');
            if (confirmed && rejected.length) {
                throw new BadRequestException('Pilih akun dulu untuk: ' + [...new Set(rejected.map(({ rater }) => rater.raterName))].join(', '));
            }
            const confirmedAt = confirmed ? new Date() : null;
            await manager.getRepository(CsiAssignmentTemplateRater).save(resolved.map(({ rater, match }) => ({
                ...rater, userId: confirmed ? match.userId : rater.userId, confirmedAt, confirmedById: confirmed ? actorId : null,
            })));
            return selection.templateId;
        });
        return this.get(scope, templateId);
    }

    /** Validate the complete selection before writing; return the first requested rater's template across locations. */
    private async scopedRaters(manager: EntityManager, scope: ServiceScope, raterIds: string[]) {
        const ids = [...new Set(raterIds)];
        if (!ids.length) throw new NotFoundException('Penilai tidak ditemukan');
        const repos = this.repos(manager);
        const raters = await repos.raters.find({ where: { id: In(ids) } });
        const pics = await repos.pics.find({ where: { id: In(raters.map((rater) => rater.templatePicId)) } });
        const templates = await repos.templates.find({ where: { id: In(pics.map((pic) => pic.templateId)), scope } });
        const templateIds = new Set(templates.map((template) => template.id));
        const picTemplates = new Map(pics.filter((pic) => templateIds.has(pic.templateId)).map((pic) => [pic.id, pic.templateId]));
        const byId = new Map(raters.map((rater) => [rater.id, rater]));
        if (raters.length !== ids.length || raters.some((rater) => !picTemplates.has(rater.templatePicId))) {
            throw new NotFoundException('Penilai tidak ditemukan');
        }
        return { raters: ids.map((id) => byId.get(id)!), templateId: picTemplates.get(byId.get(ids[0])!.templatePicId)! };
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
                area: seed.area, serviceCode: seed.serviceCode, picName: seed.picName, picNik: seed.nik ?? known?.picNik ?? null,
                jobTitle: seed.jobTitle ?? known?.jobTitle ?? null, serviceFunction: normalizeServiceFunction(seed.serviceFunction) ?? known?.serviceFunction ?? null,
            });
            await this.mergeRaters(repos, saved.id, seed.raters);
        }
        return template.id;
    }

    private async mergeRaters(repos: Repos, templatePicId: string, seedRaters: CsiTemplateSeedPic['raters']) {
        const known = new Set((await repos.raters.find({ where: { templatePicId } })).map((rater) => rater.raterName));
        const fresh = seedRaters.filter((rater) => !known.has(rater.name));
        if (fresh.length) await repos.raters.save(fresh.map((rater) => ({ templatePicId, raterName: rater.name, raterJobTitle: rater.jobTitle, raterNik: rater.nik, userId: null })));
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

    private async createPicsFromDirectory(manager: EntityManager, scope: ServiceScope, locationCode: string, seeds: CsiTemplateSeedPic[], existing: CsiPic[]) {
        const findPerson = buildNameIndex(await hcDirectoryCandidates(manager), (row) => row.fullName);
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

    private async activeAccounts(users: Repository<User> = this.users) {
        return users.find({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true, siteId: true } });
    }

    private repos(manager: EntityManager): Repos {
        return {
            templates: manager.getRepository(CsiAssignmentTemplate), pics: manager.getRepository(CsiAssignmentTemplatePic),
            raters: manager.getRepository(CsiAssignmentTemplateRater),
        };
    }
}
