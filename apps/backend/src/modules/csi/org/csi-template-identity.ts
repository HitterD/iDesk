import type { CsiTemplateDraft, CsiTemplateSeedPic } from './csi-template-excel';
import { nameSimilarity } from './csi-account-suggest';
import { normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';

export type PicResolution = { as: 'team' } | { as: 'pic' } | { as: 'rename'; picName: string };
export type ClassifiedPic = CsiTemplateSeedPic & {
    kind: 'pic' | 'team'; existingTeamId: string | null; newMasterPic: boolean;
};
export type ClassifyContext = {
    findPic: (name: string, nik: string | null) => 'found' | 'ambiguous' | null;
    findPerson: (name: string, nik: string | null) => 'found' | 'ambiguous' | null;
    teamsOfSite: ReadonlyArray<{ id: string; name: string }>;
    resolutions: Readonly<Record<string, PicResolution>>;
    suggestionPool: readonly string[];
};
type Classification = { pics: ClassifiedPic[]; unresolved: Array<{ name: string; suggestions: string[] }> };

const MIN_SUGGESTION_SCORE = 0.35;
const MAX_SUGGESTIONS = 5;
const TEAM_PREFIX = /^(TIM|TEAM) /;

function suggestionsFor(name: string, pool: readonly string[]): string[] {
    return pool.map((candidate) => ({ name: candidate, score: nameSimilarity(name, candidate) }))
        .filter((candidate) => candidate.score >= MIN_SUGGESTION_SCORE)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, MAX_SUGGESTIONS).map((candidate) => candidate.name);
}

function classifyRow(row: CsiTemplateSeedPic, ctx: ClassifyContext, siteTeams: ReadonlyMap<string, string>,
    sheetTeams: ReadonlySet<string>): ClassifiedPic | null {
    const picName = normalizeName(row.picName);
    const nik = normalizeNik(row.nik);
    const seed = { ...row, picName };
    const existingTeamId = siteTeams.get(picName) ?? null;
    const team = (): ClassifiedPic => ({ ...seed, kind: 'team', existingTeamId, newMasterPic: false });
    const resolution = Object.prototype.hasOwnProperty.call(ctx.resolutions, picName) ? ctx.resolutions[picName] : undefined;
    // Explicit administrator choices override automatic identity rules, including team prefixes.
    if (resolution) {
        if (resolution.as === 'team') return team();
        const resolvedName = resolution.as === 'rename' ? normalizeName(resolution.picName) : picName;
        return { ...seed, picName: resolvedName, kind: 'pic', existingTeamId: null,
            newMasterPic: ctx.findPic(resolvedName, nik) !== 'found' };
    }
    // Lookups own NIK-first matching; ambiguous identities remain PICs for the import service to resolve.
    const master = ctx.findPic(picName, nik);
    const person = ctx.findPerson(picName, nik);
    if (master !== null || person !== null) {
        return { ...seed, kind: 'pic', existingTeamId: null,
            newMasterPic: master !== 'found' && master !== 'ambiguous' && person !== 'ambiguous' };
    }
    if (sheetTeams.has(picName) || existingTeamId !== null || TEAM_PREFIX.test(picName)) return team();
    return null;
}

/** Classify without database access or mutating the draft; unresolved rows cannot enter the commit-ready list. */
export function classifyPics(draft: CsiTemplateDraft, ctx: ClassifyContext): Classification {
    const siteTeams = new Map(ctx.teamsOfSite.map((team) => [normalizeName(team.name), team.id]));
    const sheetTeams = new Set(draft.teams.map((team) => normalizeName(team.name)));
    const pics: ClassifiedPic[] = [];
    const unresolved: Classification['unresolved'] = [];
    for (const row of draft.pics) {
        const classified = classifyRow(row, ctx, siteTeams, sheetTeams);
        if (classified) pics.push(classified);
        else {
            const name = normalizeName(row.picName);
            unresolved.push({ name, suggestions: suggestionsFor(name, ctx.suggestionPool) });
        }
    }
    return { pics, unresolved };
}
