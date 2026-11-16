import { buildNameIndex, normalizeName } from './csi-name-match';
import { normalizeNik } from './csi-org.constants';

export type PicAccountCandidate = {
    id: string;
    fullName?: string | null;
    employeeId?: string | null;
    isActive?: boolean | null;
};

const rowOf = <T>(hit: T | 'ambiguous' | null): T | null => (hit && hit !== 'ambiguous' ? hit : null);

/**
 * Matches HC PIC rows to active iDesk accounts safely:
 * 1. Exact normalised NIK (`employeeId === normalizeNik(pic.nik)`), ignoring inactive accounts and ambiguous NIKs.
 * 2. Unique normalised full name across BOTH active users and the PIC set, when NIK could not match and the account is not already claimed by another PIC.
 */
export function buildPicAccountMatcher(
    accounts: readonly PicAccountCandidate[],
    pics: ReadonlyArray<{ fullName: string }> = [],
    initiallyClaimed: ReadonlySet<string> = new Set(),
) {
    const active = accounts.filter((account) => account.isActive !== false);
    const activeIds = new Set(active.map((account) => account.id));
    const inactiveIds = new Set(accounts.filter((account) => account.isActive === false).map((account) => account.id));

    const byNik = new Map<string, string | 'ambiguous'>();
    for (const account of active) {
        const nik = normalizeNik(account.employeeId);
        if (nik) byNik.set(nik, byNik.has(nik) ? 'ambiguous' : account.id);
    }

    const withNames = active.filter((account): account is PicAccountCandidate & { fullName: string } => Boolean(account.fullName?.trim()));
    const byName = buildNameIndex(withNames, (account) => account.fullName);

    const picNameCounts = new Map<string, number>();
    for (const pic of pics) {
        const key = normalizeName(pic.fullName);
        if (key) picNameCounts.set(key, (picNameCounts.get(key) ?? 0) + 1);
    }

    const claimed = new Set(initiallyClaimed);

    const match = (pic: { nik?: string | null; fullName?: string | null }): string | null => {
        const nik = normalizeNik(pic.nik);
        const nikHit = nik ? byNik.get(nik) : undefined;
        if (nikHit && nikHit !== 'ambiguous') {
            if (claimed.has(nikHit)) return null;
            claimed.add(nikHit);
            return nikHit;
        }
        if (nikHit === 'ambiguous') return null;

        const name = pic.fullName?.trim() ?? '';
        const key = normalizeName(name);
        if (!key) return null;
        if (picNameCounts.size > 0 && (picNameCounts.get(key) ?? 0) !== 1) return null;
        const nameHit = rowOf(byName(name));
        if (!nameHit || claimed.has(nameHit.id)) return null;
        claimed.add(nameHit.id);
        return nameHit.id;
    };

    return { activeIds, inactiveIds, claimed, match };
}
