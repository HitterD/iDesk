import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { Site } from '../../sites/entities/site.entity';
import { User } from '../../users/entities/user.entity';
import { CsiTeamKind } from '../csi.constants';
import { CsiAssignmentTemplatePic } from '../entities/csi-assignment-template-pic.entity';
import { CsiAssignmentTemplateRater } from '../entities/csi-assignment-template-rater.entity';
import { CsiAssignmentTemplate } from '../entities/csi-assignment-template.entity';
import { CsiOrgPerson } from '../entities/csi-org-person.entity';
import { CsiPic } from '../entities/csi-pic.entity';
import { CsiTeamMember } from '../entities/csi-team-member.entity';
import { CsiTeam } from '../entities/csi-team.entity';
import { buildNameIndex, normalizeName } from '../org/csi-name-match';
import { CSI_HC_SERVICES, normalizeBagian, normalizeNik } from '../org/csi-org.constants';
import { normalizeServiceFunction } from '../org/csi-org.service';
import { CsiTemplateDraft, parseTemplateWorkbook } from '../org/csi-template-excel';
import { ClassifiedPic, ClassifyContext, PicResolution } from '../org/csi-template-identity';
import { classifyDraft, CsiTemplateDiff, CsiTemplatePrune, diffOf, normalizeResolutions, prunePlan } from '../org/csi-template-import.plan';
import { lookupOf } from '../org/csi-template-view';
import { CSI_TEMPLATE_LOCATION_NAMES, csiTemplateLocation } from '../org/csi-template-locations';

const SUGGESTION_POOL_MAX = 5000;
const FALLBACK_NIK_PREFIX = 'TPL-';
const FALLBACK_NIK_BYTES = 4;
const PRUNE_WITH_PROBLEMS_MESSAGE = 'Perbaiki dulu baris bermasalah sebelum menghapus data yang tidak ada di Excel';

export type CsiTemplateImportOptions = {
    commit: boolean; resolutions: Readonly<Record<string, PicResolution>>; prune: boolean; pruneConfirmed: boolean;
};
export type CsiTemplateImportReport = CsiTemplateDiff & {
    format: CsiTemplateDraft['format']; committed: boolean;
    unresolved: Array<{ name: string; suggestions: string[] }>; problems: CsiTemplateDraft['problems'];
    /** PIC rows left without a PIC master link because several masters share the name (HC picks one in PIC HC). */
    ambiguousMasters: string[];
};
type Hit<T> = T | 'ambiguous' | null;
type IdentityIndex<T> = (name: string, nik: string | null) => Hit<T>;
type Accounts = ReturnType<typeof lookupOf>;
/** Everything read before classifying; a commit reuses it inside the same transaction. */
type ImportState = {
    scope: ServiceScope; code: string; site: Site | null; masters: CsiPic[]; directory: CsiOrgPerson[]; accounts: Accounts; teams: CsiTeam[];
    findPerson: IdentityIndex<CsiOrgPerson>;
    template: CsiAssignmentTemplate | null; rows: CsiAssignmentTemplatePic[]; raters: CsiAssignmentTemplateRater[];
};

/** Name of a template created by the first import into a location, e.g. "CSI HC – Karawang". */
export const csiTemplateName = (scope: ServiceScope, code: string) => `CSI ${scope} – ${CSI_TEMPLATE_LOCATION_NAMES[code] ?? code}`;

/**
 * Directory rows that can become HC PICs: HCBP AREA staff and the three HC departments. Names are compared in memory
 * with normalizeName, so the directory's own casing, dots or commas never hide a match.
 */
export function hcDirectoryCandidates(manager: EntityManager): Promise<CsiOrgPerson[]> {
    return manager.getRepository(CsiOrgPerson).createQueryBuilder('p')
        .where('p."department" ILIKE :hcbp OR UPPER(p."department") IN (:...hc)', {
            hcbp: 'HCBP AREA%', hc: CSI_HC_SERVICES.map((service) => service.department),
        })
        .getMany();
}

/** NIK first (normalised), then the unique normalised name. */
function identityIndex<T>(rows: readonly T[], nikOf: (row: T) => string | null, nameOf: (row: T) => string): IdentityIndex<T> {
    const byNik = new Map<string, T | 'ambiguous'>();
    rows.forEach((row) => {
        const nik = normalizeNik(nikOf(row));
        if (nik) byNik.set(nik, byNik.has(nik) ? 'ambiguous' : row);
    });
    const byName = buildNameIndex(rows, nameOf);
    return (name, nik) => {
        const key = normalizeNik(nik);
        return (key ? byNik.get(key) : undefined) ?? byName(name);
    };
}
const statusOf = (hit: Hit<unknown>) => (hit === 'ambiguous' ? 'ambiguous' : hit ? 'found' : null);
const rowOf = <T>(hit: Hit<T>): T | null => (hit && hit !== 'ambiguous' ? hit : null);
const mastersIndex = (masters: readonly CsiPic[]) => identityIndex(masters, (row) => row.nik, (row) => row.fullName);
/** Latest saved master per PIC name of the file: rows and service functions link through it, never via a stale copy. */
type MasterLinks = Map<string, CsiPic>;

/**
 * The master a PIC row already has: by NIK/name, or (same NIK = same person) the master owning the NIK of the row's
 * directory person, even when the master's name is spelled differently.
 */
function existingMaster(state: ImportState, findMaster: IdentityIndex<CsiPic>, pic: ClassifiedPic): Hit<CsiPic> {
    const hit = findMaster(pic.picName, pic.nik);
    if (hit) return hit;
    const person = rowOf(state.findPerson(pic.picName, pic.nik));
    return person ? findMaster('', person.nik) : null;
}

/** PIC rows whose master is ambiguous and whose template row is not linked yet (mergeRows keeps an existing link). */
function ambiguousMastersOf(state: ImportState, pics: ClassifiedPic[]): string[] {
    const findMaster = mastersIndex(state.masters);
    const linked = new Set(state.rows.filter((row) => row.picId).map((row) => row.picName));
    const names = pics.filter((pic) => pic.kind === 'pic' && !linked.has(pic.picName) && existingMaster(state, findMaster, pic) === 'ambiguous')
        .map((pic) => pic.picName);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** Only rows that will really create a master keep newMasterPic, so the report lists exactly what a commit creates. */
function withoutLinkedMasters(state: ImportState, pics: ClassifiedPic[]): ClassifiedPic[] {
    const findMaster = mastersIndex(state.masters);
    return pics.map((pic) => (pic.newMasterPic && existingMaster(state, findMaster, pic) ? { ...pic, newMasterPic: false } : pic));
}

/**
 * Excel import into a location's assignment template: classify the PIC column (PIC / team / unresolved), report the
 * diff, and on commit write everything in one transaction (PIC masters, custom teams + members, rows, raters, prune).
 * A dry run only reads.
 */
@Injectable()
export class CsiTemplateImportService {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    async importExcel(scope: ServiceScope, locationCode: string, buffer: Buffer, options: CsiTemplateImportOptions): Promise<CsiTemplateImportReport> {
        const { code } = csiTemplateLocation(locationCode);
        const draft = await parseTemplateWorkbook(buffer);
        if (!options.commit) return this.run(this.dataSource.manager, scope, code, draft, options);
        return this.dataSource.transaction((manager) => this.run(manager, scope, code, draft, options));
    }

    private async run(manager: EntityManager, scope: ServiceScope, code: string, draft: CsiTemplateDraft, options: CsiTemplateImportOptions) {
        const state = await this.load(manager, scope, code);
        const classified = classifyDraft(draft, this.classifyContext(state, normalizeResolutions(options.resolutions)));
        const { unresolved } = classified;
        const pics = withoutLinkedMasters(state, classified.pics);
        const prune = options.prune ? prunePlan(pics, state.rows, state.raters, options.pruneConfirmed) : null;
        const report: CsiTemplateImportReport = {
            format: draft.format, committed: options.commit, ...diffOf(pics, state.rows, state.raters, prune),
            ambiguousMasters: ambiguousMastersOf(state, pics), unresolved, problems: draft.problems,
        };
        if (!options.commit) return report;
        if (unresolved.length) throw new BadRequestException('Tentukan dulu: ' + unresolved.map((row) => row.name).join(', '));
        if (!pics.length) throw new BadRequestException('Tidak ada PIC di file');
        // A row that failed to parse looks "absent" and would be pruned; the file must be clean first.
        if (prune && draft.problems.length) throw new BadRequestException(PRUNE_WITH_PROBLEMS_MESSAGE);
        await this.write(manager, state, pics, draft.teams, prune);
        return report;
    }

    private async load(manager: EntityManager, scope: ServiceScope, code: string): Promise<ImportState> {
        const template = await manager.getRepository(CsiAssignmentTemplate).findOne({ where: { scope, locationCode: code } });
        const rows = template ? await manager.getRepository(CsiAssignmentTemplatePic).find({ where: { templateId: template.id } }) : [];
        const raters = rows.length
            ? await manager.getRepository(CsiAssignmentTemplateRater).find({ where: { templatePicId: In(rows.map((row) => row.id)) } }) : [];
        const accounts = await manager.getRepository(User).find({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true } });
        const site = await manager.getRepository(Site).findOne({ where: { code } });
        const teams = site ? await manager.getRepository(CsiTeam).find({ where: { scope, siteId: site.id, kind: CsiTeamKind.CUSTOM } }) : [];
        const directory = await hcDirectoryCandidates(manager);
        return {
            scope, code, site, template, rows, raters, teams, accounts: lookupOf(accounts), directory,
            masters: await manager.getRepository(CsiPic).find({ where: { scope } }),
            findPerson: identityIndex(directory, (row) => row.nik, (row) => row.fullName),
        };
    }

    /** Suggestions come from the location's PIC master and the HC directory, capped so similarity stays cheap. */
    private classifyContext(state: ImportState, resolutions: Record<string, PicResolution>): ClassifyContext {
        const findPic = mastersIndex(state.masters);
        const siteMasters = state.masters.filter((row) => !!state.site && row.siteId === state.site.id).map((row) => row.fullName);
        const pool = [...new Set([...siteMasters, ...state.directory.map((row) => row.fullName)].map(normalizeName).filter(Boolean))];
        return {
            findPic: (name, nik) => statusOf(findPic(name, nik)),
            findPerson: (name, nik) => statusOf(state.findPerson(name, nik)),
            // Deactivated teams are hidden from the subjects list: rows never link to them (ensureTeams revives one instead).
            teamsOfSite: state.teams.filter((team) => team.isActive).map((team) => ({ id: team.id, name: team.name })),
            resolutions, suggestionPool: pool.slice(0, SUGGESTION_POOL_MAX),
        };
    }

    /** Order matters: masters and teams first so the template rows can link to them; prune last. */
    private async write(manager: EntityManager, state: ImportState, pics: ClassifiedPic[], sheetTeams: CsiTemplateDraft['teams'],
        prune: CsiTemplatePrune | null) {
        const links = await this.ensureMasters(manager, state, pics.filter((pic) => pic.kind === 'pic'));
        const teamIds = await this.ensureTeams(manager, state, pics.filter((pic) => pic.kind === 'team'), sheetTeams);
        const template = state.template ?? await manager.getRepository(CsiAssignmentTemplate)
            .save({ scope: state.scope, locationCode: state.code, name: csiTemplateName(state.scope, state.code) });
        await this.mergeRows(manager, state, template.id, pics, links, teamIds);
        await this.fillMasterServiceFunctions(manager, pics, links);
        if (prune?.raterIds.length) await manager.getRepository(CsiAssignmentTemplateRater).delete({ id: In(prune.raterIds) });
        if (prune?.picIds.length) await manager.getRepository(CsiAssignmentTemplatePic).delete({ id: In(prune.picIds) });
    }

    /**
     * Every PIC row must exist in the PIC master: a deactivated one is switched back on, a missing one is created from
     * the HC directory, or (new staff not in the directory) from the file itself. Saved entities replace the loaded
     * copies, so later writes never resurrect stale fields (e.g. isActive false).
     */
    private async ensureMasters(manager: EntityManager, state: ImportState, pics: ClassifiedPic[]): Promise<MasterLinks> {
        const repo = manager.getRepository(CsiPic);
        const masters = [...state.masters];
        const links: MasterLinks = new Map();
        const keep = (stale: CsiPic | null, saved: CsiPic) => {
            const index = stale ? masters.indexOf(stale) : -1;
            if (index >= 0) masters[index] = saved; else masters.push(saved);
            for (const [name, master] of links) if (master === stale) links.set(name, saved);
            return saved;
        };
        for (const pic of pics) {
            const hit = existingMaster(state, mastersIndex(masters), pic);
            if (hit === 'ambiguous') continue;
            if (hit) links.set(pic.picName, hit.isActive ? hit : keep(hit, await repo.save({ ...hit, isActive: true })));
            else if (pic.newMasterPic) links.set(pic.picName, keep(null, await repo.save(this.newMaster(state, pic))));
        }
        return links;
    }

    /** Called only when no master owns the row's NIK (existingMaster checked it), so the unique scope+NIK key holds. */
    private newMaster(state: ImportState, pic: ClassifiedPic): Partial<CsiPic> {
        const usable = rowOf(state.findPerson(pic.picName, pic.nik));
        const nik = normalizeNik(usable?.nik ?? pic.nik) ?? FALLBACK_NIK_PREFIX + randomBytes(FALLBACK_NIK_BYTES).toString('hex').toUpperCase();
        const account = state.accounts.byNik.get(nik) ?? null;
        return {
            scope: state.scope, nik, fullName: usable?.fullName ?? pic.picName, jobTitle: usable?.jobTitle ?? pic.jobTitle,
            serviceCode: pic.serviceCode, serviceFunction: normalizeServiceFunction(pic.serviceFunction),
            bagian: usable ? normalizeBagian(usable.bagian) : null, workLocation: usable?.workLocation ?? null,
            siteId: state.site?.id ?? null, userId: account?.id ?? null, photoUrl: null, isActive: true,
        };
    }

    /** Team rows link to an existing custom team of the site or a new one; sheet members are added, never removed. */
    private async ensureTeams(manager: EntityManager, state: ImportState, pics: ClassifiedPic[], sheetTeams: CsiTemplateDraft['teams']) {
        const ids = new Map<string, string>();
        if (!pics.length) return ids;
        if (!state.site) throw new BadRequestException('Site lokasi tidak ditemukan');
        for (const pic of pics) {
            if (ids.has(pic.picName)) continue;
            const team = pic.existingTeamId ? { id: pic.existingTeamId } : await this.reviveOrCreateTeam(manager, state, state.site, pic);
            ids.set(pic.picName, team.id);
            const members = sheetTeams.filter((sheet) => normalizeName(sheet.name) === pic.picName).flatMap((sheet) => sheet.members);
            await this.addMembers(manager, state.accounts, team.id, members);
        }
        return ids;
    }

    /** A deactivated custom team with the same normalised name is reactivated (same id) rather than duplicated. */
    private reviveOrCreateTeam(manager: EntityManager, state: ImportState, site: Site, pic: ClassifiedPic): Promise<{ id: string }> {
        const repo = manager.getRepository(CsiTeam);
        const inactive = state.teams.find((team) => !team.isActive && normalizeName(team.name) === pic.picName);
        if (inactive) return repo.save({ ...inactive, isActive: true, serviceCode: pic.serviceCode });
        return repo.save({
            scope: state.scope, kind: CsiTeamKind.CUSTOM, siteId: site.id, serviceCode: pic.serviceCode, name: pic.picName,
            photoUrl: null, tagline: null, jobTitle: null, isActive: true,
        });
    }

    /** Account match: unique active NIK first, then the unique active name; otherwise a named member without account. */
    private async addMembers(manager: EntityManager, accounts: Accounts, teamId: string, members: CsiTemplateDraft['teams'][number]['members']) {
        const repo = manager.getRepository(CsiTeamMember);
        const existing = await repo.find({ where: { teamId } });
        const known = new Set(existing.map((member) => member.name));
        let order = existing.length;
        for (const member of members) {
            if (known.has(member.name)) continue;
            known.add(member.name);
            const nik = normalizeNik(member.nik);
            const account = (nik ? accounts.byNik.get(nik) : null) ?? rowOf(accounts.byName(member.name));
            await repo.save({ teamId, name: member.name, nik, userId: account?.id ?? null, sortOrder: order++ });
        }
    }

    private async mergeRows(manager: EntityManager, state: ImportState, templateId: string, pics: ClassifiedPic[],
        links: MasterLinks, teamIds: ReadonlyMap<string, string>) {
        const repo = manager.getRepository(CsiAssignmentTemplatePic);
        const byName = new Map(state.rows.filter((row) => row.templateId === templateId).map((row) => [row.picName, row]));
        let order = byName.size;
        for (const pic of pics) {
            const known = byName.get(pic.picName);
            const isTeam = pic.kind === 'team';
            const saved = await repo.save({
                ...(known ?? { templateId, sortOrder: order++ }),
                // Re-matched on every import: a PIC added to the master later gets linked then.
                picId: isTeam ? null : known?.picId ?? links.get(pic.picName)?.id ?? null,
                teamId: isTeam ? teamIds.get(pic.picName) ?? null : null,
                area: pic.area, serviceCode: pic.serviceCode, picName: pic.picName, picNik: normalizeNik(pic.nik) ?? known?.picNik ?? null,
                jobTitle: pic.jobTitle ?? known?.jobTitle ?? null,
                serviceFunction: normalizeServiceFunction(pic.serviceFunction) ?? known?.serviceFunction ?? null,
            });
            await this.mergeRaters(manager, state, saved.id, pic.raters);
        }
    }

    /** New raters are added; a known rater only gets its NIK refreshed (confirmation is never touched here). */
    private async mergeRaters(manager: EntityManager, state: ImportState, templatePicId: string, raters: ClassifiedPic['raters']) {
        const repo = manager.getRepository(CsiAssignmentTemplateRater);
        const known = new Map(state.raters.filter((row) => row.templatePicId === templatePicId).map((row) => [row.raterName, row]));
        const fresh = raters.filter((rater) => !known.has(rater.name));
        const refreshed = raters.flatMap((rater) => {
            const row = known.get(rater.name);
            const nik = normalizeNik(rater.nik);
            return row && nik && normalizeNik(row.raterNik) !== nik ? [{ ...row, raterNik: nik }] : [];
        });
        if (refreshed.length) await repo.save(refreshed);
        if (fresh.length) {
            await repo.save(fresh.map((rater) => ({
                templatePicId, raterName: rater.name, raterJobTitle: rater.jobTitle, raterNik: normalizeNik(rater.nik), userId: null,
            })));
        }
    }

    /** csi_pics.serviceFunction is filled from the template only while it is still empty (manual edits win). */
    private async fillMasterServiceFunctions(manager: EntityManager, pics: ClassifiedPic[], links: MasterLinks) {
        const latest = new Map<string, CsiPic>();
        for (const pic of pics.filter((row) => row.kind === 'pic')) {
            const value = normalizeServiceFunction(pic.serviceFunction);
            const linked = links.get(pic.picName);
            const master = linked ? latest.get(linked.id) ?? linked : null;
            if (value && master && !master.serviceFunction) {
                latest.set(master.id, await manager.getRepository(CsiPic).save({ ...master, serviceFunction: value }));
            }
        }
    }
}
