import type { CsiAssignments, CsiPair } from '../../../types';

/** `periodRaterId|periodRateeId` — one matrix cell. */
export type PairKey = `${string}|${string}`;

type Rater = CsiAssignments['raters'][number];
type Ratee = CsiAssignments['ratees'][number] & {
    /** PERSON ratee's user (from the period detail); null for teams. Used to lock the self cell. */
    userId: string | null;
};
/** The assignments view joined with each ratee's user id (the assignments endpoint does not return it). */
export interface MatrixData { raters: Rater[]; ratees: Ratee[]; pairs: CsiPair[] }

export interface MatrixStats { raters: number; subjects: number; teams: number; people: number; pairs: number; cross: number }

const SEPARATOR = '|';

export const pairKey = (periodRaterId: string, periodRateeId: string): PairKey => `${periodRaterId}${SEPARATOR}${periodRateeId}`;

function splitKey(key: PairKey): CsiPair {
    const at = key.indexOf(SEPARATOR);
    return { periodRaterId: key.slice(0, at), periodRateeId: key.slice(at + 1) };
}

/** Joins the ratee user ids of the period detail onto the assignments view (unknown ratee = no user). */
export function withRateeUsers(view: CsiAssignments, periodRatees: ReadonlyArray<{ id: string; userId: string | null }>): MatrixData {
    const userOf = new Map(periodRatees.map((ratee) => [ratee.id, ratee.userId]));
    return { ...view, ratees: view.ratees.map((ratee) => ({ ...ratee, userId: userOf.get(ratee.periodRateeId) ?? null })) };
}

export const isSelf = (rater: Pick<Rater, 'userId'>, ratee: Pick<Ratee, 'userId'>) => ratee.userId !== null && ratee.userId === rater.userId;
export const isCross = (rater: Pick<Rater, 'siteId'>, ratee: Pick<Ratee, 'siteId'>) => rater.siteId !== ratee.siteId;

export function toPairSet(pairs: readonly CsiPair[]): Set<PairKey> {
    return new Set(pairs.map((pair) => pairKey(pair.periodRaterId, pair.periodRateeId)));
}

/** All cells present → remove them all; otherwise add them all. Returns a new set. */
export function toggleCells(pairs: ReadonlySet<PairKey>, cells: readonly PairKey[]): Set<PairKey> {
    const next = new Set(pairs);
    const allOn = cells.length > 0 && cells.every((cell) => pairs.has(cell));
    cells.forEach((cell) => (allOn ? next.delete(cell) : next.add(cell)));
    return next;
}

function cellsOf(raters: readonly Rater[], ratees: readonly Ratee[]): PairKey[] {
    return raters.flatMap((rater) => ratees.filter((ratee) => !isSelf(rater, ratee)).map((ratee) => pairKey(rater.periodRaterId, ratee.periodRateeId)));
}

export function rowCells(a: MatrixData, raterId: string): PairKey[] {
    return cellsOf(a.raters.filter((rater) => rater.periodRaterId === raterId), a.ratees);
}

export function colCells(a: MatrixData, rateeId: string): PairKey[] {
    return cellsOf(a.raters, a.ratees.filter((ratee) => ratee.periodRateeId === rateeId));
}

/** Raters of the site × subjects of the same site ("✓ Penilai <site>"). */
export function siteCells(a: MatrixData, siteId: string): PairKey[] {
    return cellsOf(a.raters.filter((rater) => rater.siteId === siteId), a.ratees.filter((ratee) => ratee.siteId === siteId));
}

/** Pairs to send: known members only, never a self pair (the server rejects those). */
export function toPairs(a: MatrixData, pairs: ReadonlySet<PairKey>): CsiPair[] {
    const raters = new Map(a.raters.map((rater) => [rater.periodRaterId, rater]));
    const ratees = new Map(a.ratees.map((ratee) => [ratee.periodRateeId, ratee]));
    return [...pairs].map(splitKey).filter((pair) => {
        const rater = raters.get(pair.periodRaterId);
        const ratee = ratees.get(pair.periodRateeId);
        return Boolean(rater && ratee && !isSelf(rater, ratee));
    });
}

export function stats(a: MatrixData, pairs: ReadonlySet<PairKey>): MatrixStats {
    const raters = new Map(a.raters.map((rater) => [rater.periodRaterId, rater]));
    const ratees = new Map(a.ratees.map((ratee) => [ratee.periodRateeId, ratee]));
    const teams = a.ratees.filter((ratee) => ratee.kind === 'TEAM').length;
    const valid = toPairs(a, pairs);
    const cross = valid.filter((pair) => {
        const rater = raters.get(pair.periodRaterId);
        const ratee = ratees.get(pair.periodRateeId);
        return rater && ratee && isCross(rater, ratee);
    }).length;
    return { raters: a.raters.length, subjects: a.ratees.length, teams, people: a.ratees.length - teams, pairs: valid.length, cross };
}

/** Same members and same pairs → nothing to save. */
export function samePairs(a: ReadonlySet<PairKey>, b: ReadonlySet<PairKey>): boolean {
    return a.size === b.size && [...a].every((key) => b.has(key));
}

/** "Isi otomatis: sama site": every rater × every subject of the rater's own site (site-less raters/subjects skipped). */
export function sameSiteCells(a: MatrixData): Set<PairKey> {
    const sites = new Set(a.raters.flatMap((rater) => (rater.siteId ? [rater.siteId] : [])));
    return new Set([...sites].flatMap((siteId) => siteCells(a, siteId)));
}

export interface SiteGroup<T> { siteId: string | null; items: T[] }

/** Groups by siteId in `order` (the period's sites); other sites follow, site-less last. Empty groups are dropped. */
export function groupBySite<T extends { siteId: string | null }>(items: readonly T[], order: readonly string[]): SiteGroup<T>[] {
    const extra = [...new Set(items.flatMap((item) => (item.siteId && !order.includes(item.siteId) ? [item.siteId] : [])))];
    const ids: Array<string | null> = [...order, ...extra, null];
    return ids.map((siteId) => ({ siteId, items: items.filter((item) => item.siteId === siteId) })).filter((group) => group.items.length > 0);
}
