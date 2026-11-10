import { CSI_ANON_MIN_GROUP, CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { NO_DEPARTMENT } from '../org/csi-service-report.calc';

const PERCENT = 100;

/** Survey SLA: answers against the basis and the target (ceil(basis × targetPct / 100)). The official status. */
export type CsiSlaBlock = { basis: number; submitted: number; pct: number; targetPct: number; targetCount: number; met: boolean; missing: number };
/** Participation of one rater department (numbers only); small departments are merged (CSI_ANON_MIN_GROUP). */
export type CsiDepartmentParticipation = { name: string; submitted: number; total: number; pct: number; met: boolean };

/** Share in whole percent, never above 100 (more answers than the basis still reads as complete); 0 without a basis. */
const sharePct = (part: number, whole: number) => (whole > 0 ? Math.min(PERCENT, Math.round((part / whole) * PERCENT)) : 0);

export function slaBlock(sla: { basis: number; targetPct: number; target: number; responses: number }): CsiSlaBlock {
    return {
        basis: sla.basis, submitted: sla.responses, pct: sharePct(sla.responses, sla.basis), targetPct: sla.targetPct, targetCount: sla.target,
        met: sla.target > 0 && sla.responses >= sla.target, missing: Math.max(0, sla.target - sla.responses),
    };
}

const participationRow = (name: string, submitted: number, total: number, targetPct: number): CsiDepartmentParticipation => ({
    // Exact comparison: 26 of 29 (89.7%) does not meet 90% although it prints as 90%.
    name, submitted, total, pct: sharePct(submitted, total), met: total > 0 && submitted * PERCENT >= targetPct * total,
});

/**
 * Basis raters per department (same department rule as pendingByDepartment): departments with fewer than
 * CSI_ANON_MIN_GROUP raters become one "Departemen kecil (gabungan)" row. Lowest participation first, then by name.
 */
export function departmentParticipation(raters: Array<{ department: string | null; answered: boolean }>, targetPct: number): CsiDepartmentParticipation[] {
    const groups = new Map<string, { submitted: number; total: number }>();
    raters.forEach((rater) => {
        const name = rater.department?.trim() || NO_DEPARTMENT;
        const row = groups.get(name) ?? { submitted: 0, total: 0 };
        groups.set(name, { submitted: row.submitted + (rater.answered ? 1 : 0), total: row.total + 1 });
    });
    const entries = [...groups];
    const small = entries.filter(([, row]) => row.total < CSI_ANON_MIN_GROUP);
    const rows = entries.filter(([, row]) => row.total >= CSI_ANON_MIN_GROUP).map(([name, row]) => participationRow(name, row.submitted, row.total, targetPct));
    if (small.length) {
        const sum = (key: 'submitted' | 'total') => small.reduce((total, [, row]) => total + row[key], 0);
        rows.push(participationRow(CSI_SMALL_GROUP_LABEL, sum('submitted'), sum('total'), targetPct));
    }
    return rows.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name, 'id'));
}
