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

export const CSI_TEMPLATE_LOCATION_NAMES: Readonly<Record<string, string>> = { SMG: 'Semarang', SPJ: 'Sepanjang', KRW: 'Karawang', JTB: 'Jakarta' };
const SUGGESTION_POOL_MAX = 5000;
const FALLBACK_NIK_PREFIX = 'TPL-';
const FALLBACK_NIK_BYTES = 4;

export type CsiTemplateImportOptions = {
    commit: boolean; resolutions: Readonly<Record<string, PicResolution>>; prune: boolean; pruneConfirmed: boolean;
};
export type CsiTemplateImportReport = CsiTemplateDiff & {
    format: CsiTemplateDraft['format']; committed: boolean;
    unresolved: Array<{ name: string; suggestions: string[] }>; problems: CsiTemplateDraft['problems'];
};
type Hit<T> = T | 'ambiguous' | null;
type IdentityIndex<T> = (name: string, nik: string | null) => Hit<T>;
type Accounts = ReturnType<typeof lookupOf>;
/** Everything read before classifying; a commit reuses it inside the same transaction. */
type ImportState = {
    scope: ServiceScope; code: string; site: Site | null; masters: CsiPic[]; directory: CsiOrgPerson[]; accounts: Accounts; teams: CsiTeam[];
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

/**
 * Excel import into a location's assignment template: classify the PIC column (PIC / team / unresolved), report the
 * diff, and on commit write everything in one transaction (PIC masters, custom teams + members, rows, raters, prune).
 * A dry run only reads.
 */
@Injectable()
export class CsiTemplateImportService {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    async importExcel(scope: ServiceScope, locationCode: string, buffer: Buffer, options: CsiTemplateImportOptions): Promise<CsiTemplateImportReport> {
        const code = locationCode.toUpperCase();
        if (!CSI_TEMPLATE_LOCATION_NAMES[code]) throw new BadRequestException('Lokasi tidak dikenal');
        const draft = await parseTemplateWorkbook(buffer);
        if (!options.commit) return this.run(this.dataSource.manager, scope, code, draft, options);
        return this.dataSource.transaction((manager) => this.run(manager, scope, code, draft, options));
    }

    private async run(manager: EntityManager, scope: ServiceScope, code: string, draft: CsiTemplateDraft, options: CsiTemplateImportOptions) {
        const state = await this.load(manager, scope, code);
        const { pics, unresolved } = classifyDraft(draft, this.classifyContext(state, normalizeResolutions(options.resolutions)));
        const prune = options.prune ? prunePlan(pics, state.rows, state.raters, options.pruneConfirmed) : null;
        const report: CsiTemplateImportReport = {
            format: draft.format, committed: options.commit, ...diffOf(pics, state.rows, state.raters, prune), unresolved, problems: draft.problems,
        };
        if (!options.commit) return report;
        if (unresolved.length) throw new BadRequestException('Tentukan dulu: ' + unresolved.map((row) => row.name).join(', '));
        if (!pics.length) throw new BadRequestException('Tidak ada PIC di file');
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
        return {
            scope, code, site, template, rows, raters, teams, accounts: lookupOf(accounts),
            masters: await manager.getRepository(CsiPic).find({ where: { scope } }), directory: await hcDirectoryCandidates(manager),
        };
    }

    /** Suggestions come from the location's PIC master and the HC directory, capped so similarity stays cheap. */
    private classifyContext(state: ImportState, resolutions: Record<string, PicResolution>): ClassifyContext {
        const findPic = mastersIndex(state.masters);
        const findPerson = identityIndex(state.directory, (row) => row.nik, (row) => row.fullName);
        const siteMasters = state.masters.filter((row) => !!state.site && row.siteId === state.site.id).map((row) => row.fullName);
        const pool = [...new Set([...siteMasters, ...state.directory.map((row) => row.fullName)].map(normalizeName).filter(Boolean))];
        return {
            findPic: (name, nik) => statusOf(findPic(name, nik)),
            findPerson: (name, nik) => statusOf(findPerson(name, nik)),
            teamsOfSite: state.teams.map((team) => ({ id: team.id, name: team.name })),
            resolutions, suggestionPool: pool.slice(0, SUGGESTION_POOL_MAX),
        };
    }

    /** Order matters: masters and teams first so the template rows can link to them; prune last. */
    private async write(manager: EntityManager, state: ImportState, pics: ClassifiedPic[], sheetTeams: CsiTemplateDraft['teams'],
        prune: CsiTemplatePrune | null) {
        const masters = await this.ensureMasters(manager, state, pics.filter((pic) => pic.kind === 'pic'));
        const teamIds = await this.ensureTeams(manager, state, pics.filter((pic) => pic.kind === 'team'), sheetTeams);
        const template = state.template ?? await manager.getRepository(CsiAssignmentTemplate)
            .save({ scope: state.scope, locationCode: state.code, name: csiTemplateName(state.scope, state.code) });
        await this.mergeRows(manager, state, template.id, pics, mastersIndex(masters), teamIds);
        await this.fillMasterServiceFunctions(manager, pics, mastersIndex(masters));
        if (prune?.raterIds.length) await manager.getRepository(CsiAssignmentTemplateRater).delete({ id: In(prune.raterIds) });
        if (prune?.picIds.length) await manager.getRepository(CsiAssignmentTemplatePic).delete({ id: In(prune.picIds) });
    }

    /**
     * Every PIC row must exist in the PIC master: a deactivated one is switched back on, a missing one is created from
     * the HC directory, or (new staff not in the directory) from the file itself. Returns the master list after writes.
     */
    private async ensureMasters(manager: EntityManager, state: ImportState, pics: ClassifiedPic[]): Promise<CsiPic[]> {
        const repo = manager.getRepository(CsiPic);
        const masters = [...state.masters];
        for (const pic of pics) {
            const hit = mastersIndex(masters)(pic.picName, pic.nik);
            if (hit === 'ambiguous') continue;
            if (hit) {
                if (!hit.isActive) await repo.save({ ...hit, isActive: true });
                continue;
            }
            const fresh = pic.newMasterPic ? this.newMaster(state, pic, masters) : null;
            if (fresh) masters.push(await repo.save(fresh));
        }
        return masters;
    }

    /** Null when the NIK already belongs to another master (the unique scope+NIK key; that master is kept as is). */
    private newMaster(state: ImportState, pic: ClassifiedPic, masters: readonly CsiPic[]): Partial<CsiPic> | null {
        const usable = rowOf(identityIndex(state.directory, (row) => row.nik, (row) => row.fullName)(pic.picName, pic.nik));
        const nik = normalizeNik(usable?.nik ?? pic.nik) ?? FALLBACK_NIK_PREFIX + randomBytes(FALLBACK_NIK_BYTES).toString('hex').toUpperCase();
        if (masters.some((row) => normalizeNik(row.nik) === nik)) return null;
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
            const team = pic.existingTeamId ? { id: pic.existingTeamId } : await manager.getRepository(CsiTeam).save({
                scope: state.scope, kind: CsiTeamKind.CUSTOM, siteId: state.site.id, serviceCode: pic.serviceCode, name: pic.picName,
                photoUrl: null, tagline: null, jobTitle: null, isActive: true,
            });
            ids.set(pic.picName, team.id);
            const members = sheetTeams.filter((sheet) => normalizeName(sheet.name) === pic.picName).flatMap((sheet) => sheet.members);
            await this.addMembers(manager, state.accounts, team.id, members);
        }
        return ids;
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
        findMaster: IdentityIndex<CsiPic>, teamIds: ReadonlyMap<string, string>) {
        const repo = manager.getRepository(CsiAssignmentTemplatePic);
        const byName = new Map(state.rows.filter((row) => row.templateId === templateId).map((row) => [row.picName, row]));
        let order = byName.size;
        for (const pic of pics) {
            const known = byName.get(pic.picName);
            const isTeam = pic.kind === 'team';
            const saved = await repo.save({
                ...(known ?? { templateId, sortOrder: order++ }),
                // Re-matched on every import: a PIC added to the master later gets linked then.
                picId: isTeam ? null : known?.picId ?? rowOf(findMaster(pic.picName, pic.nik))?.id ?? null,
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
    private async fillMasterServiceFunctions(manager: EntityManager, pics: ClassifiedPic[], findMaster: IdentityIndex<CsiPic>) {
        for (const pic of pics.filter((row) => row.kind === 'pic')) {
            const value = normalizeServiceFunction(pic.serviceFunction);
            const master = rowOf(findMaster(pic.picName, pic.nik));
            if (value && master && !master.serviceFunction) await manager.getRepository(CsiPic).save({ ...master, serviceFunction: value });
        }
    }
}
