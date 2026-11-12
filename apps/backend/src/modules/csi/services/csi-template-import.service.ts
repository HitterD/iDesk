import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
import { classifyDraft, CsiPlannedRow, CsiReplaceContext, CsiReplaceSummary, fileFacts, normalizeResolutions, replacePlan } from '../org/csi-template-import.plan';
import { lookupOf } from '../org/csi-template-view';
import { CSI_TEMPLATE_LOCATION_NAMES, csiTemplateLocation } from '../org/csi-template-locations';

const SUGGESTION_POOL_MAX = 5000;
const FALLBACK_NIK_PREFIX = 'TPL-';
const FALLBACK_NIK_BYTES = 4;
const REPLACE_WITH_PROBLEMS_MESSAGE = 'Perbaiki dulu baris bermasalah sebelum mengganti template';
export const CONCURRENT_TEMPLATE_MESSAGE = 'Template sedang diperbarui, coba lagi';
export const PG_UNIQUE_VIOLATION = '23505';

/** Serialises writers of one location template (import, PIC rename); held until the transaction ends. */
export function lockTemplateLocation(manager: EntityManager, scope: ServiceScope, locationCode: string) {
    return manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`csi-template:${scope}:${locationCode}`]);
}

export type CsiTemplateImportOptions = {
    commit: boolean; resolutions: Readonly<Record<string, PicResolution>>;
};
/** Replace summary (before -> after, kept pins) plus what the file creates and what still needs a decision. */
export type CsiTemplateImportReport = CsiReplaceSummary & ReturnType<typeof fileFacts> & {
    format: CsiTemplateDraft['format']; committed: boolean;
    unresolved: Array<{ name: string; suggestions: string[] }>; problems: CsiTemplateDraft['problems'];
    /** PIC rows left without a PIC master link because several masters share the name (HC picks one in PIC HC). */
    ambiguousMasters: string[];
};
type Hit<T> = T | 'ambiguous' | null;
export type IdentityIndex<T> = (name: string, nik: string | null) => Hit<T>;
type Accounts = ReturnType<typeof lookupOf>;
/** What creating a PIC master needs: the location site, the HC directory (by NIK/name) and active accounts by NIK. */
export type CsiMasterContext = { scope: ServiceScope; site: Site | null; findPerson: IdentityIndex<CsiOrgPerson>; accounts: Accounts };
/** The template PIC row fields a new master is built from. */
export type CsiMasterSeed = Pick<ClassifiedPic, 'picName' | 'nik' | 'jobTitle' | 'serviceCode' | 'serviceFunction'>;
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

/** Master-creation context of a location: its site, the HC directory and the active accounts (for the NIK link). */
export async function loadMasterContext(manager: EntityManager, scope: ServiceScope, locationCode: string): Promise<CsiMasterContext> {
    const site = await manager.getRepository(Site).findOne({ where: { code: locationCode } });
    const accounts = await manager.getRepository(User).find({ where: { isActive: true }, select: { id: true, fullName: true, employeeId: true } });
    const directory = await hcDirectoryCandidates(manager);
    return { scope, site, accounts: lookupOf(accounts), findPerson: identityIndex(directory, (row) => row.nik, (row) => row.fullName) };
}

/**
 * NIK first (normalised), then the unique normalised name, then (when given) the unique previous name: a current name
 * always wins over another row's alias.
 */
export function identityIndex<T>(rows: readonly T[], nikOf: (row: T) => string | null, nameOf: (row: T) => string,
    aliasesOf?: (row: T) => readonly string[]): IdentityIndex<T> {
    const byNik = new Map<string, T | 'ambiguous'>();
    rows.forEach((row) => {
        const nik = normalizeNik(nikOf(row));
        if (nik) byNik.set(nik, byNik.has(nik) ? 'ambiguous' : row);
    });
    const byName = buildNameIndex(rows, nameOf);
    const byAlias = aliasesOf ? aliasIndex(rows, aliasesOf) : () => null;
    return (name, nik) => {
        const key = normalizeNik(nik);
        return (key ? byNik.get(key) : undefined) ?? byName(name) ?? byAlias(name);
    };
}

/** Alias → the single row that had it, or 'ambiguous'. */
function aliasIndex<T>(rows: readonly T[], aliasesOf: (row: T) => readonly string[]): (name: string) => Hit<T> {
    const index = new Map<string, T | 'ambiguous'>();
    rows.forEach((row) => new Set((aliasesOf(row) ?? []).map(normalizeName).filter(Boolean)).forEach((key) => {
        index.set(key, index.has(key) && index.get(key) !== row ? 'ambiguous' : row);
    }));
    return (name) => index.get(normalizeName(name)) ?? null;
}
const statusOf = (hit: Hit<unknown>) => (hit === 'ambiguous' ? 'ambiguous' : hit ? 'found' : null);
const rowOf = <T>(hit: Hit<T>): T | null => (hit && hit !== 'ambiguous' ? hit : null);
/** PIC masters by current name, then by a previous name kept by a rename (no NIK). */
export const masterNameIndex = (masters: readonly CsiPic[]) => {
    const find = mastersIndex(masters);
    return (name: string) => find(name, null);
};
/** PIC masters by NIK, current name, then a previous name kept by a rename. */
export const mastersIndex = (masters: readonly CsiPic[]) => identityIndex(masters, (row) => row.nik, (row) => row.fullName, (row) => row.aliases ?? []);
/** Latest saved master per PIC name of the file: rows and service functions link through it, never via a stale copy. */
type MasterLinks = Map<string, CsiPic>;

/** The PIC master an old row of the same name was linked to (by hand or by an earlier import) wins over re-matching. */
function linkedByName(state: ImportState): ReadonlyMap<string, string> {
    return new Map(state.rows.filter((row) => row.picId).map((row) => [row.picName, row.picId as string]));
}

/**
 * Links a commit will write, predicted from what exists now: an existing master (a new one has no old rows to
 * continue), an existing team or the deactivated team of that name that would be revived.
 */
function predictedLinks(state: ImportState): Pick<CsiReplaceContext, 'picIdOf' | 'teamIdOf'> {
    const findMaster = mastersIndex(state.masters);
    const byName = linkedByName(state);
    return {
        picIdOf: (pic) => byName.get(pic.picName) ?? rowOf(existingMaster(state, findMaster, pic))?.id ?? null,
        teamIdOf: (pic) => pic.existingTeamId ?? state.teams.find((team) => !team.isActive && normalizeName(team.name) === pic.picName)?.id ?? null,
    };
}

const accountsOf = (state: ImportState): Pick<CsiReplaceContext, 'activeIds' | 'accountIdOfNik'> => ({
    activeIds: state.accounts.activeIds, accountIdOfNik: (nik) => state.accounts.byNik.get(nik)?.id ?? null,
});

/**
 * The master a PIC row already has: by NIK/name, or (same NIK = same person) the master owning the NIK of the row's
 * directory person, even when the master's name is spelled differently.
 */
export function existingMaster(state: Pick<CsiMasterContext, 'findPerson'>, findMaster: IdentityIndex<CsiPic>, pic: Pick<CsiMasterSeed, 'picName' | 'nik'>): Hit<CsiPic> {
    const hit = findMaster(pic.picName, pic.nik);
    if (hit) return hit;
    const person = rowOf(state.findPerson(pic.picName, pic.nik));
    return person ? findMaster('', person.nik) : null;
}

/** PIC rows whose master is ambiguous and whose old row of that name is not linked yet (the replace keeps that link). */
function ambiguousMastersOf(state: ImportState, pics: ClassifiedPic[]): string[] {
    const findMaster = mastersIndex(state.masters);
    const linked = linkedByName(state);
    const names = pics.filter((pic) => pic.kind === 'pic' && !linked.has(pic.picName) && existingMaster(state, findMaster, pic) === 'ambiguous')
        .map((pic) => pic.picName);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * A new PIC master for a template row: from its HC directory person (NIK, name, title, bagian) when there is one, else
 * from the row itself (file NIK, else a generated TPL- NIK). Call only when no master owns the row's NIK
 * (existingMaster checked it), so the unique scope+NIK key holds.
 */
export function newMasterOf(ctx: CsiMasterContext, pic: CsiMasterSeed): Partial<CsiPic> {
    const usable = rowOf(ctx.findPerson(pic.picName, pic.nik));
    const nik = normalizeNik(usable?.nik ?? pic.nik) ?? FALLBACK_NIK_PREFIX + randomBytes(FALLBACK_NIK_BYTES).toString('hex').toUpperCase();
    const account = ctx.accounts.byNik.get(nik) ?? null;
    return {
        scope: ctx.scope, nik, fullName: usable?.fullName ?? pic.picName, jobTitle: usable?.jobTitle ?? pic.jobTitle,
        serviceCode: pic.serviceCode, serviceFunction: normalizeServiceFunction(pic.serviceFunction),
        bagian: usable ? normalizeBagian(usable.bagian) : null, workLocation: usable?.workLocation ?? null,
        siteId: ctx.site?.id ?? null, userId: account?.id ?? null, photoUrl: null, isActive: true,
    };
}

/**
 * A file PIC named the way a master was called before a rename (an alias, and no master's current name) is read as
 * that master's current name, so the template keeps one row per person under the edited name.
 */
export function withCurrentNames(draft: CsiTemplateDraft, masters: readonly CsiPic[]): CsiTemplateDraft {
    const current = new Set(masters.map((row) => normalizeName(row.fullName)));
    const byAlias = aliasIndex(masters, (row) => row.aliases ?? []);
    const pics = draft.pics.map((pic) => {
        const key = normalizeName(pic.picName);
        const hit = current.has(key) ? null : rowOf(byAlias(key));
        return hit ? { ...pic, picName: normalizeName(hit.fullName) } : pic;
    });
    return { ...draft, pics };
}

/** Only rows that will really create a master keep newMasterPic, so the report lists exactly what a commit creates. */
function withoutLinkedMasters(state: ImportState, pics: ClassifiedPic[]): ClassifiedPic[] {
    const findMaster = mastersIndex(state.masters);
    return pics.map((pic) => (pic.newMasterPic && existingMaster(state, findMaster, pic) ? { ...pic, newMasterPic: false } : pic));
}

/**
 * Excel import into a location's assignment template: classify the PIC column (PIC / team / unresolved), report what
 * the replace does, and on commit write everything in one transaction. The file replaces the location's template
 * rows and raters; PIC masters and teams are created or revived but never deleted, and raters of the same PIC/team
 * keep their account pin and confirmation. Surveys copied the template earlier and are not touched. A dry run only
 * reads.
 */
@Injectable()
export class CsiTemplateImportService {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    async importExcel(scope: ServiceScope, locationCode: string, buffer: Buffer, options: CsiTemplateImportOptions): Promise<CsiTemplateImportReport> {
        const { code } = csiTemplateLocation(locationCode);
        const draft = await parseTemplateWorkbook(buffer);
        if (!options.commit) return this.run(this.dataSource.manager, scope, code, draft, options);
        try {
            return await this.dataSource.transaction(async (manager) => {
                // One import per location at a time; the second waits and then replaces on top of the first.
                await lockTemplateLocation(manager, scope, code);
                return this.run(manager, scope, code, draft, options);
            });
        } catch (error) {
            // e.g. two first imports racing to create the template or a master/team (template edits are not locked).
            if ((error as { code?: string })?.code === PG_UNIQUE_VIOLATION) throw new ConflictException(CONCURRENT_TEMPLATE_MESSAGE);
            throw error;
        }
    }

    private async run(manager: EntityManager, scope: ServiceScope, code: string, file: CsiTemplateDraft, options: CsiTemplateImportOptions) {
        const state = await this.load(manager, scope, code);
        const draft = withCurrentNames(file, state.masters);
        const classified = classifyDraft(draft, this.classifyContext(state, normalizeResolutions(options.resolutions)));
        const { unresolved } = classified;
        const pics = withoutLinkedMasters(state, classified.pics);
        const pending = new Set(unresolved.map((row) => row.name));
        const { summary } = replacePlan(pics, state.rows, state.raters, { ...predictedLinks(state), ...accountsOf(state), pending });
        const report: CsiTemplateImportReport = {
            format: draft.format, committed: options.commit, ...fileFacts(pics), ...summary,
            ambiguousMasters: ambiguousMastersOf(state, pics), unresolved, problems: draft.problems,
        };
        if (!options.commit) return report;
        if (unresolved.length) throw new BadRequestException('Tentukan dulu: ' + unresolved.map((row) => row.name).join(', '));
        if (!pics.length) throw new BadRequestException('Tidak ada PIC di file');
        // A row that failed to parse looks "absent": replacing would silently drop those people.
        if (draft.problems.length) throw new BadRequestException(REPLACE_WITH_PROBLEMS_MESSAGE);
        return { ...report, ...(await this.write(manager, state, pics, draft.teams)) };
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

    /**
     * Order matters: masters and teams first so the new rows can link to them; then the old rows and raters go
     * and the file's rows are written. The summary is recomputed from the real links of this commit.
     */
    private async write(manager: EntityManager, state: ImportState, pics: ClassifiedPic[], sheetTeams: CsiTemplateDraft['teams']): Promise<CsiReplaceSummary> {
        const links = await this.ensureMasters(manager, state, pics.filter((pic) => pic.kind === 'pic'));
        const teamIds = await this.ensureTeams(manager, state, pics.filter((pic) => pic.kind === 'team'), sheetTeams);
        const template = state.template ?? await manager.getRepository(CsiAssignmentTemplate)
            .save({ scope: state.scope, locationCode: state.code, name: csiTemplateName(state.scope, state.code) });
        const byName = linkedByName(state);
        const plan = replacePlan(pics, state.rows, state.raters, {
            picIdOf: (pic) => byName.get(pic.picName) ?? links.get(pic.picName)?.id ?? null,
            teamIdOf: (pic) => teamIds.get(pic.picName) ?? null,
            ...accountsOf(state),
        });
        if (state.rows.length) {
            // The FK cascades raters too; deleting them explicitly keeps the replace independent of that.
            await manager.getRepository(CsiAssignmentTemplateRater).delete({ templatePicId: In(state.rows.map((row) => row.id)) });
            await manager.getRepository(CsiAssignmentTemplatePic).delete({ templateId: template.id });
        }
        await this.writeRows(manager, template.id, plan.rows);
        await this.fillMasterServiceFunctions(manager, pics, links);
        return plan.summary;
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
            else if (pic.newMasterPic) links.set(pic.picName, keep(null, await repo.save(newMasterOf(state, pic))));
        }
        return links;
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

    /** File order is the new sort order; old row fields fill only what the file leaves empty. */
    private async writeRows(manager: EntityManager, templateId: string, rows: CsiPlannedRow[]) {
        const raterRepo = manager.getRepository(CsiAssignmentTemplateRater);
        for (const [sortOrder, { pic, picId, teamId, previous, raters }] of rows.entries()) {
            const saved = await manager.getRepository(CsiAssignmentTemplatePic).save({
                templateId, sortOrder, picId, teamId, area: pic.area, serviceCode: pic.serviceCode, picName: pic.picName,
                picNik: normalizeNik(pic.nik) ?? previous?.picNik ?? null,
                jobTitle: pic.jobTitle ?? previous?.jobTitle ?? null,
                serviceFunction: normalizeServiceFunction(pic.serviceFunction) ?? previous?.serviceFunction ?? null,
            });
            if (!raters.length) continue;
            await raterRepo.save(raters.map(({ rater, pin }) => ({
                templatePicId: saved.id, raterName: rater.name, raterJobTitle: rater.jobTitle, raterNik: normalizeNik(rater.nik),
                userId: pin?.userId ?? null, confirmedAt: pin?.confirmedAt ?? null, confirmedById: pin?.confirmedById ?? null,
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
