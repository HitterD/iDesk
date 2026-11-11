import { buildNameIndex, normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';

/** Match of a template rater against active accounts. */
export type CsiTemplateRaterStatus = 'confirmed' | 'ok' | 'ambiguous' | 'no-account';
export type CsiTemplateRaterView = { id: string; raterName: string; raterNik: string | null; raterJobTitle: string | null; userId: string | null; status: CsiTemplateRaterStatus; confirmed: boolean };
export type CsiTemplatePicView = {
    id: string; area: string; serviceCode: string; picName: string; jobTitle: string | null; serviceFunction: string | null;
    picId: string | null;
    /** Custom team row (rated as a TEAM ratee); picId is then null. */
    teamId: string | null;
    raterCount: number; raters: CsiTemplateRaterView[];
};
export type CsiTemplateView = {
    id: string; scope: string; locationCode: string; name: string; updatedAt: Date | null;
    summary: { pics: number; picsUnmatched: number; picsWithoutRaters: number; raters: number; ratersConfirmed: number; ratersOk: number; ratersNoAccount: number; ratersAmbiguous: number };
    pics: CsiTemplatePicView[];
};
export type CsiAccountRef = { id: string; fullName: string; employeeId: string | null };
type RaterMatch = { raterName: string; raterNik: string | null; userId: string | null; confirmedAt: Date | null };

/** Active account indexes are built once per view; duplicate NIKs must never confirm an identity. */
type AccountLookup = { activeIds: ReadonlySet<string>; byNik: ReadonlyMap<string, CsiAccountRef | null>; byName: (name: string) => CsiAccountRef | 'ambiguous' | null };
export function lookupOf(accounts: readonly CsiAccountRef[]): AccountLookup {
    const byNik = new Map<string, CsiAccountRef | null>();
    for (const account of accounts) {
        const nik = normalizeNik(account.employeeId);
        if (nik) byNik.set(nik, byNik.has(nik) ? null : account);
    }
    return { activeIds: new Set(accounts.map((account) => account.id)), byNik, byName: buildNameIndex(accounts, (account) => account.fullName) };
}

/** Explicit confirmation wins, then unique NIK, then an unconfirmed pin, and finally name matching. */
export function resolveRater(rater: RaterMatch, accounts: readonly CsiAccountRef[] | AccountLookup): { userId: string | null; status: CsiTemplateRaterStatus } {
    const lookup = Array.isArray(accounts) ? lookupOf(accounts) : accounts as AccountLookup;
    const activePin = rater.userId && lookup.activeIds.has(rater.userId);
    if (activePin && rater.confirmedAt) return { userId: rater.userId, status: 'confirmed' };
    const nik = normalizeNik(rater.raterNik);
    const account = nik ? lookup.byNik.get(nik) : null;
    if (account) return { userId: account.id, status: 'confirmed' };
    if (activePin) return { userId: rater.userId, status: 'ok' };
    const hit = lookup.byName(rater.raterName);
    if (hit === 'ambiguous') return { userId: null, status: 'ambiguous' };
    return hit ? { userId: hit.id, status: 'ok' } : { userId: null, status: 'no-account' };
}

/**
 * Distinct template raters (by NIK, else by name) that cannot answer: no account, or an ambiguous name, and not linked
 * to an active account. Report line "N penilai di template belum punya akun iDesk (tidak termasuk basis)".
 */
export function ratersWithoutAccount(raters: readonly RaterMatch[], accounts: readonly CsiAccountRef[]): number {
    const lookup = lookupOf(accounts);
    const keyOf = (rater: RaterMatch) => normalizeNik(rater.raterNik) ? `nik:${normalizeNik(rater.raterNik)}` : `name:${normalizeName(rater.raterName)}`;
    const missing = raters.filter((rater) => {
        const { status } = resolveRater(rater, lookup);
        return status === 'no-account' || status === 'ambiguous';
    });
    return new Set(missing.map(keyOf)).size;
}

type TemplateRow = { id: string; scope: string; locationCode: string; name: string; updatedAt?: Date | null };
type PicRow = Omit<CsiTemplatePicView, 'raterCount' | 'raters' | 'teamId'> & { teamId?: string | null; sortOrder: number };
type RaterRow = RaterMatch & { id: string; templatePicId: string; raterJobTitle: string | null };

/** Template → PICs (template order) → raters (name order) with the account match of each rater. */
export function buildTemplateView(template: TemplateRow, pics: PicRow[], raters: RaterRow[], accounts: readonly CsiAccountRef[]): CsiTemplateView {
    const lookup = lookupOf(accounts);
    const views: CsiTemplatePicView[] = [...pics].sort((a, b) => a.sortOrder - b.sortOrder).map((pic) => {
        const own = raters.filter((rater) => rater.templatePicId === pic.id).sort((a, b) => a.raterName.localeCompare(b.raterName));
        return {
            id: pic.id, area: pic.area, serviceCode: pic.serviceCode, picName: pic.picName, jobTitle: pic.jobTitle, serviceFunction: pic.serviceFunction,
            picId: pic.picId, teamId: pic.teamId ?? null, raterCount: own.length,
            raters: own.map((rater) => {
                const match = resolveRater(rater, lookup);
                return { id: rater.id, raterName: rater.raterName, raterNik: rater.raterNik ?? null, raterJobTitle: rater.raterJobTitle, ...match, confirmed: match.status === 'confirmed' };
            }),
        };
    });
    const all = views.flatMap((pic) => pic.raters);
    return {
        id: template.id, scope: template.scope, locationCode: template.locationCode, name: template.name, updatedAt: template.updatedAt ?? null,
        summary: {
            pics: views.length, picsUnmatched: views.filter((pic) => !pic.picId).length, picsWithoutRaters: views.filter((pic) => !pic.raterCount).length,
            raters: all.length, ratersConfirmed: all.filter((rater) => rater.status === 'confirmed').length, ratersOk: all.filter((rater) => rater.status === 'ok').length,
            ratersNoAccount: all.filter((rater) => rater.status === 'no-account').length, ratersAmbiguous: all.filter((rater) => rater.status === 'ambiguous').length,
        },
        pics: views,
    };
}
