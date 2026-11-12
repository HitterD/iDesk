import { normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';
import type { CsiTemplateDraft } from './csi-template-excel';
import { ClassifiedPic, classifyPics, ClassifyContext, PicResolution } from './csi-template-identity';

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

/** Template PIC row as loaded: its owner is the linked PIC master, else the linked team, else the PIC name. */
type TemplateRow = { id: string; picName: string; picId: string | null; teamId: string | null; picNik: string | null; jobTitle: string | null; serviceFunction: string | null };
type RaterRow = { templatePicId: string; raterName: string; userId: string | null; confirmedAt: Date | null; confirmedById: string | null };
/** Account pin of a template rater, with the confirmation that came with it. */
export type CsiRaterPin = { userId: string; confirmedAt: Date | null; confirmedById: string | null };
/** Where a file row lands: PIC master / team links, the old row it continues (if any) and each rater's carried pin. */
export type CsiPlannedRow = {
    pic: ClassifiedPic; picId: string | null; teamId: string | null; previous: TemplateRow | null;
    raters: Array<{ rater: ClassifiedPic['raters'][number]; pin: CsiRaterPin | null }>;
};
export type CsiReplaceSummary = {
    before: { pics: number; raters: number }; after: { pics: number; raters: number };
    pics: { added: string[]; removed: string[] }; keptPins: number; keptConfirmations: number;
};
/** Links of a file row (known once masters/teams exist; a dry run predicts them) and the active accounts. */
export type CsiReplaceContext = {
    picIdOf: (pic: ClassifiedPic) => string | null; teamIdOf: (pic: ClassifiedPic) => string | null;
    activeIds: ReadonlySet<string>; accountIdOfNik: (nik: string) => string | null;
};

const NAME_KEY = 'name:';
const nameKey = (picName: string) => NAME_KEY + normalizeName(picName);
function ownerKey(picId: string | null, teamId: string | null, picName: string): string {
    if (picId) return `pic:${picId}`;
    return teamId ? `team:${teamId}` : nameKey(picName);
}

/**
 * A pin survives only while its account is active, and only when the file's rater NIK does not name another account
 * (the NIK wins for linking).
 */
function carriedPin(pin: CsiRaterPin | undefined, nik: string | null, ctx: CsiReplaceContext): CsiRaterPin | null {
    if (!pin || !ctx.activeIds.has(pin.userId)) return null;
    const key = normalizeNik(nik);
    const byNik = key ? ctx.accountIdOfNik(key) : null;
    return byNik && byNik !== pin.userId ? null : pin;
}

/**
 * Import = replace: the file becomes the location's whole template. A file row continues the old row with the same
 * owner (same PIC master, same team, or, for an old unlinked row, the same name); raters of that row keep their
 * account pin and confirmation when the normalised name matches.
 */
export function replacePlan(pics: readonly ClassifiedPic[], rows: readonly TemplateRow[], raters: readonly RaterRow[], ctx: CsiReplaceContext) {
    const byKey = new Map<string, TemplateRow>();
    for (const row of rows) {
        const key = ownerKey(row.picId, row.teamId, row.picName);
        if (!byKey.has(key)) byKey.set(key, row);
    }
    // An old row is continued once: a second file row with the same owner starts fresh.
    const claimed = new Set<string>();
    const claim = (row: TemplateRow | undefined) => (row && !claimed.has(row.id) ? (claimed.add(row.id), row) : null);
    const pinsOf = (row: TemplateRow | null) => new Map(raters.filter((rater) => row && rater.templatePicId === row.id && rater.userId)
        .map((rater) => [normalizeName(rater.raterName), { userId: rater.userId!, confirmedAt: rater.confirmedAt, confirmedById: rater.confirmedById }]));
    const planned: CsiPlannedRow[] = pics.map((pic) => {
        const isTeam = pic.kind === 'team';
        const picId = isTeam ? null : ctx.picIdOf(pic);
        const teamId = isTeam ? ctx.teamIdOf(pic) : null;
        const key = ownerKey(picId, teamId, pic.picName);
        const previous = claim(byKey.get(key)) ?? (key.startsWith(NAME_KEY) ? null : claim(byKey.get(nameKey(pic.picName))));
        const pins = pinsOf(previous);
        const unique = [...new Map(pic.raters.map((rater) => [normalizeName(rater.name), rater])).values()];
        return { pic, picId, teamId, previous, raters: unique.map((rater) => ({ rater, pin: carriedPin(pins.get(normalizeName(rater.name)), rater.nik, ctx) })) };
    });
    return { rows: planned, summary: summaryOf(planned, rows, raters) };
}

function summaryOf(planned: readonly CsiPlannedRow[], rows: readonly TemplateRow[], raters: readonly RaterRow[]): CsiReplaceSummary {
    const continued = new Set(planned.map((row) => row.previous?.id).filter(Boolean));
    const pins = planned.flatMap((row) => row.raters.map((rater) => rater.pin).filter((pin): pin is CsiRaterPin => !!pin));
    return {
        before: { pics: rows.length, raters: raters.length },
        after: { pics: planned.length, raters: planned.reduce((sum, row) => sum + row.raters.length, 0) },
        pics: {
            added: planned.filter((row) => !row.previous).map((row) => row.pic.picName),
            removed: rows.filter((row) => !continued.has(row.id)).map((row) => row.picName),
        },
        keptPins: pins.length, keptConfirmations: pins.filter((pin) => pin.confirmedAt).length,
    };
}

/** Facts of the file itself: services, custom teams to create and PIC masters to create. */
export function fileFacts(pics: readonly ClassifiedPic[]) {
    return {
        services: [...new Set(pics.map((pic) => pic.serviceCode))].sort(),
        teamsAdded: [...new Set(pics.filter((pic) => pic.kind === 'team' && !pic.existingTeamId).map((pic) => pic.picName))],
        newMasterPics: pics.filter((pic) => pic.kind === 'pic' && pic.newMasterPic).map((pic) => pic.picName),
    };
}
