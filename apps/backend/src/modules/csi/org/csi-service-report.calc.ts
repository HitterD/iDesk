import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_ANON_MIN_GROUP, CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { buildHcRecap, CsiHcPic, CsiHcRating, CsiHcRecap, CsiRecapRow } from './csi-hc-report.calc';

export const NO_DEPARTMENT = 'Tanpa departemen';

export type CsiPendingDepartment = { department: string; pending: number; total: number };

/**
 * Report of one HC service (pure): the recap restricted to the service's PICs, all locations. Ratings of the
 * `hiddenRateeIds` (the viewer's own PIC rows) only show on the viewer's own PIC row (masked, see maskOwnRow).
 * Every other total (service, bagian, overall, respondent units) is computed without them, so subtracting cannot reveal them.
 */
export function buildServiceReport(input: {
    pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[]; serviceCode: string; hiddenRateeIds: ReadonlySet<string>; scope?: ServiceScope;
}): CsiHcRecap {
    const pics = input.pics.filter((pic) => pic.serviceCode === input.serviceCode);
    const ids = new Set(pics.map((pic) => pic.periodRateeId));
    const ratings = input.ratings.filter((rating) => ids.has(rating.periodRateeId));
    const visible = ratings.filter((rating) => !input.hiddenRateeIds.has(rating.periodRateeId));
    const full = buildHcRecap({ pics, ratings, dimensions: input.dimensions, scope: input.scope });
    const named = buildHcRecap({ pics, ratings: visible, dimensions: input.dimensions, scope: input.scope });
    const ownRow = new Map(full.services.filter((row) => row.level === 'pic' && input.hiddenRateeIds.has(row.key.slice(PIC_KEY_PREFIX.length)))
        .map((row) => [row.key, maskOwnRow(row)]));
    const services = named.services.map((row) => ownRow.get(row.key) ?? row);
    return { ...named, services };
}

const PIC_KEY_PREFIX = 'p:';
/** Below this many ratings the viewer's own averages are hidden (same rule as "Hasil penilaian saya"). */
export const CSI_OWN_ROW_MIN_RATINGS = 3;
const EMPTY_CELL = { average: null, ratings: 0 };

/**
 * The viewer's own PIC row: no split per rater location (one rater from a location would be identifiable), and no
 * averages at all until enough people rated (the count stays visible).
 */
function maskOwnRow(row: CsiRecapRow): CsiRecapRow {
    const byLocation = Object.fromEntries(Object.keys(row.byLocation).map((code) => [code, EMPTY_CELL])) as CsiRecapRow['byLocation'];
    if (row.all.ratings >= CSI_OWN_ROW_MIN_RATINGS) return { ...row, byLocation };
    return {
        ...row, byLocation, all: { average: null, ratings: row.all.ratings },
        dimensions: Object.fromEntries(Object.keys(row.dimensions).map((label) => [label, null])),
    };
}

/** Raters still to answer per department (no names), most pending first. */
export function pendingByDepartment(raters: Array<{ department: string | null; answered: boolean }>): CsiPendingDepartment[] {
    const groups = new Map<string, CsiPendingDepartment>();
    raters.forEach((rater) => {
        const department = rater.department?.trim() || NO_DEPARTMENT;
        const row = groups.get(department) ?? { department, pending: 0, total: 0 };
        groups.set(department, { department, pending: row.pending + (rater.answered ? 0 : 1), total: row.total + 1 });
    });
    return [...groups.values()].sort((a, b) => b.pending - a.pending || a.department.localeCompare(b.department, 'id'));
}

/**
 * Service-owner view of pendingByDepartment: departments with fewer than CSI_ANON_MIN_GROUP raters are summed into
 * one CSI_SMALL_GROUP_LABEL row at the end, so a pending count never points at one or two people.
 */
export function mergeSmallDepartments(rows: CsiPendingDepartment[]): CsiPendingDepartment[] {
    const small = rows.filter((row) => row.total < CSI_ANON_MIN_GROUP);
    if (!small.length) return rows;
    const merged = small.reduce((sum, row) => ({ ...sum, pending: sum.pending + row.pending, total: sum.total + row.total }),
        { department: CSI_SMALL_GROUP_LABEL, pending: 0, total: 0 });
    return [...rows.filter((row) => row.total >= CSI_ANON_MIN_GROUP), merged];
}
