import { normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';
import { normalizeServiceFunction } from './csi-org.service';
import type { CsiTemplateDraft } from './csi-template-excel';
import { ClassifiedPic, classifyPics, ClassifyContext, PicResolution } from './csi-template-identity';

type TemplateRow = { id: string; picName: string; serviceCode: string; jobTitle: string | null; serviceFunction: string | null; picNik: string | null; teamId: string | null };
type RaterRow = { id: string; templatePicId: string; raterName: string; confirmedAt: Date | null };
export type CsiTemplatePrune = { picIds: string[]; raterIds: string[]; removedNames: string[] };
export type CsiTemplateDiff = {
    services: string[]; pics: { added: string[]; changed: string[]; removed: string[] }; raters: { added: number; removed: number };
    teams: { added: string[] }; newMasterPics: string[];
};

/** Resolution keys arrive as typed by the admin; the classifier looks them up by normalised PIC name. */
export function normalizeResolutions(resolutions: Readonly<Record<string, PicResolution>>): Record<string, PicResolution> {
    return Object.fromEntries(Object.entries(resolutions).map(([name, resolution]) => [normalizeName(name), resolution]));
}

/**
 * Classifies the draft and folds rows that end with the same PIC name (a rename onto a PIC already in the file) into
 * one row. A renamed row ignores its own NIK: the admin said the name was wrong, so its NIK must not pick the master.
 */
export function classifyDraft(draft: CsiTemplateDraft, ctx: ClassifyContext) {
    const renamed = (name: string) => ctx.resolutions[normalizeName(name)]?.as === 'rename';
    const rows = draft.pics.map((row) => (renamed(row.picName) ? { ...row, nik: null } : row));
    const { pics, unresolved } = classifyPics({ ...draft, pics: rows }, ctx);
    const byName = new Map<string, ClassifiedPic>();
    for (const pic of pics) {
        const first = byName.get(pic.picName);
        const known = new Set(first?.raters.map((rater) => rater.name));
        byName.set(pic.picName, first ? { ...first, raters: [...first.raters, ...pic.raters.filter((rater) => !known.has(rater.name))] } : pic);
    }
    return { pics: [...byName.values()], unresolved };
}

function isChanged(pic: ClassifiedPic, known: TemplateRow): boolean {
    const serviceFunction = normalizeServiceFunction(pic.serviceFunction);
    const nik = normalizeNik(pic.nik);
    return pic.serviceCode !== known.serviceCode || (pic.jobTitle != null && pic.jobTitle !== known.jobTitle)
        || (serviceFunction != null && serviceFunction !== known.serviceFunction) || (nik != null && nik !== known.picNik);
}

/**
 * Prune is limited to the services present in the file. A PIC that is gone is removed with its raters, unless it is
 * a team row or has a confirmed rater: then only its unconfirmed raters go (both are kept safe unless pruneConfirmed).
 */
export function prunePlan(pics: readonly ClassifiedPic[], rows: readonly TemplateRow[], raters: readonly RaterRow[], pruneConfirmed: boolean): CsiTemplatePrune {
    const services = new Set(pics.map((pic) => pic.serviceCode));
    const inFile = new Map(pics.map((pic) => [pic.picName, new Set(pic.raters.map((rater) => rater.name))]));
    const removable = (rater: RaterRow) => pruneConfirmed || rater.confirmedAt == null;
    const prune: CsiTemplatePrune = { picIds: [], raterIds: [], removedNames: [] };
    for (const row of rows) {
        const fileRaters = inFile.get(row.picName);
        if (!fileRaters && !services.has(row.serviceCode)) continue;
        const own = raters.filter((rater) => rater.templatePicId === row.id);
        const keepRow = !!fileRaters || (!pruneConfirmed && (row.teamId != null || own.some((rater) => rater.confirmedAt != null)));
        const gone = keepRow ? own.filter((rater) => !fileRaters?.has(rater.raterName) && removable(rater)) : own;
        prune.raterIds.push(...gone.map((rater) => rater.id));
        if (!keepRow) { prune.picIds.push(row.id); prune.removedNames.push(row.picName); }
    }
    return prune;
}

/** What a commit would do; the prune part is only reported when the admin asked for it. */
export function diffOf(pics: readonly ClassifiedPic[], rows: readonly TemplateRow[], raters: readonly RaterRow[], prune: CsiTemplatePrune | null): CsiTemplateDiff {
    const byName = new Map(rows.map((row) => [row.picName, row]));
    const ratersOf = (id: string) => new Set(raters.filter((rater) => rater.templatePicId === id).map((rater) => rater.raterName));
    let added = 0;
    for (const pic of pics) {
        const known = byName.get(pic.picName);
        const names = known ? ratersOf(known.id) : new Set<string>();
        added += pic.raters.filter((rater) => !names.has(rater.name)).length;
    }
    return {
        services: [...new Set(pics.map((pic) => pic.serviceCode))].sort(),
        pics: {
            added: pics.filter((pic) => !byName.has(pic.picName)).map((pic) => pic.picName),
            changed: pics.filter((pic) => byName.has(pic.picName) && isChanged(pic, byName.get(pic.picName)!)).map((pic) => pic.picName),
            removed: prune?.removedNames ?? [],
        },
        raters: { added, removed: prune?.raterIds.length ?? 0 },
        teams: { added: [...new Set(pics.filter((pic) => pic.kind === 'team' && !pic.existingTeamId).map((pic) => pic.picName))] },
        newMasterPics: pics.filter((pic) => pic.kind === 'pic' && pic.newMasterPic).map((pic) => pic.picName),
    };
}
