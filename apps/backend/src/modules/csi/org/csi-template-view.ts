import { buildNameIndex } from './csi-name-match';

/** Match of a template rater against active accounts. */
export type CsiTemplateRaterStatus = 'ok' | 'no-account' | 'ambiguous';
export type CsiTemplateRaterView = { id: string; raterName: string; raterJobTitle: string | null; userId: string | null; status: CsiTemplateRaterStatus };
export type CsiTemplatePicView = {
    id: string; area: string; serviceCode: string; picName: string; jobTitle: string | null; serviceFunction: string | null;
    picId: string | null; raterCount: number; raters: CsiTemplateRaterView[];
};
export type CsiTemplateView = {
    id: string; scope: string; locationCode: string; name: string; updatedAt: Date | null;
    summary: { pics: number; picsUnmatched: number; picsWithoutRaters: number; raters: number; ratersOk: number; ratersNoAccount: number; ratersAmbiguous: number };
    pics: CsiTemplatePicView[];
};
export type CsiAccountRef = { id: string; fullName: string };

/** Active accounts by id and by normalised name, built once per view (not once per rater). */
type AccountLookup = { activeIds: ReadonlySet<string>; byName: (name: string) => CsiAccountRef | 'ambiguous' | null };
const lookupOf = (accounts: readonly CsiAccountRef[]): AccountLookup =>
    ({ activeIds: new Set(accounts.map((account) => account.id)), byName: buildNameIndex(accounts, (account) => account.fullName) });

/**
 * Resolves a rater name: a stored userId wins while that account is active (set when an admin picked the account),
 * otherwise the name must match exactly one active account.
 */
export function resolveRater(rater: { raterName: string; userId: string | null }, accounts: readonly CsiAccountRef[] | AccountLookup): { userId: string | null; status: CsiTemplateRaterStatus } {
    const lookup = Array.isArray(accounts) ? lookupOf(accounts) : accounts as AccountLookup;
    // A pinned account only counts while it is still active; otherwise the name decides again.
    if (rater.userId && lookup.activeIds.has(rater.userId)) return { userId: rater.userId, status: 'ok' };
    const hit = lookup.byName(rater.raterName);
    if (hit === 'ambiguous') return { userId: null, status: 'ambiguous' };
    return hit ? { userId: hit.id, status: 'ok' } : { userId: null, status: 'no-account' };
}

type TemplateRow = { id: string; scope: string; locationCode: string; name: string; updatedAt?: Date | null };
type PicRow = Omit<CsiTemplatePicView, 'raterCount' | 'raters'> & { sortOrder: number };
type RaterRow = { id: string; templatePicId: string; raterName: string; raterJobTitle: string | null; userId: string | null };

/** Template → PICs (template order) → raters (name order) with the account match of each rater. */
export function buildTemplateView(template: TemplateRow, pics: PicRow[], raters: RaterRow[], accounts: readonly CsiAccountRef[]): CsiTemplateView {
    const lookup = lookupOf(accounts);
    const views: CsiTemplatePicView[] = [...pics].sort((a, b) => a.sortOrder - b.sortOrder).map((pic) => {
        const own = raters.filter((rater) => rater.templatePicId === pic.id).sort((a, b) => a.raterName.localeCompare(b.raterName));
        return {
            id: pic.id, area: pic.area, serviceCode: pic.serviceCode, picName: pic.picName, jobTitle: pic.jobTitle, serviceFunction: pic.serviceFunction,
            picId: pic.picId, raterCount: own.length,
            raters: own.map((rater) => ({ id: rater.id, raterName: rater.raterName, raterJobTitle: rater.raterJobTitle, ...resolveRater(rater, lookup) })),
        };
    });
    const all = views.flatMap((pic) => pic.raters);
    return {
        id: template.id, scope: template.scope, locationCode: template.locationCode, name: template.name, updatedAt: template.updatedAt ?? null,
        summary: {
            pics: views.length, picsUnmatched: views.filter((pic) => !pic.picId).length, picsWithoutRaters: views.filter((pic) => !pic.raterCount).length,
            raters: all.length, ratersOk: all.filter((rater) => rater.status === 'ok').length,
            ratersNoAccount: all.filter((rater) => rater.status === 'no-account').length, ratersAmbiguous: all.filter((rater) => rater.status === 'ambiguous').length,
        },
        pics: views,
    };
}
