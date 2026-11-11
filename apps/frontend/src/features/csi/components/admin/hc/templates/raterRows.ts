import type { CsiTemplate, CsiTemplateRaterStatus } from '../../../../hcTypes';

export interface RaterRow {
    key: string; name: string; nik: string | null; userId: string | null;
    status: CsiTemplateRaterStatus; raterIds: string[]; pics: string[];
}

const STATUS_ORDER: Record<CsiTemplateRaterStatus, number> = { 'no-account': 0, ambiguous: 1, ok: 2, confirmed: 3 };
const normaliseName = (name: string) => name.toUpperCase().replace(/\s+/g, ' ').trim();

/** Aggregate assignments without mutating the template; unresolved names share one correction action. */
export function groupRaters(view: CsiTemplate): RaterRow[] {
    const rows = new Map<string, RaterRow>();
    for (const pic of view.pics) {
        for (const rater of pic.raters) {
            const key = rater.userId ?? `name:${normaliseName(rater.raterName)}`;
            const current = rows.get(key);
            rows.set(key, {
                key, name: current?.name ?? rater.raterName, nik: current?.nik ?? rater.raterNik, userId: rater.userId,
                status: current && STATUS_ORDER[current.status] < STATUS_ORDER[rater.status] ? current.status : rater.status,
                raterIds: [...(current?.raterIds ?? []), rater.id],
                pics: [...new Set([...(current?.pics ?? []), pic.picName])].sort((a, b) => a.localeCompare(b)),
            });
        }
    }
    return [...rows.values()].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));
}
