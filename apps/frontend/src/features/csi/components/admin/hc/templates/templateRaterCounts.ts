import type { CsiTemplate } from '../../../../hcTypes';
import { groupRaters } from './raterRows';

/** Group the combined assignments so repeated people keep their worst status across locations too. */
export function templateRaterCounts(templates: CsiTemplate[]) {
    const rows = templates.length ? groupRaters({ ...templates[0], pics: templates.flatMap((template) => template.pics) }) : [];
    const confirmed = rows.filter((row) => row.status === 'confirmed').length;
    const ok = rows.filter((row) => row.status === 'ok').length;
    const ambiguous = rows.filter((row) => row.status === 'ambiguous').length;
    const noAccount = rows.filter((row) => row.status === 'no-account').length;
    return { total: rows.length, confirmed, ok, ambiguous, noAccount, issues: ambiguous + noAccount };
}
