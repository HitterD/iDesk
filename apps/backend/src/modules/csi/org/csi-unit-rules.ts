import { CsiOrgLocation, locationOfWorkLocation, normalizeBagian } from './csi-org.constants';

/**
 * "Siapa menilai siapa" per unit (HC default): respondents of a unit (division, optionally department / bagian /
 * work location) rate the PICs of a layanan (optionally one bagian, or listed PICs). Pure matching, no I/O.
 */
export type CsiUnitRule = {
    division: string; department?: string | null; bagian?: string | null; location?: CsiOrgLocation | null;
    serviceCode: string; picBagian?: string | null; picIds?: string[] | null;
};
export type CsiRulePerson = { nik: string; division: string | null; department: string | null; bagian: string | null; workLocation: string | null };
export type CsiRulePic = { periodRateeId: string; picId: string; serviceCode: string | null; bagian: string | null };

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/** Whether a directory person belongs to the rule's respondent unit (empty filters match everything). */
export function personMatches(rule: CsiUnitRule, person: CsiRulePerson): boolean {
    if (!same(rule.division, person.division)) return false;
    if (rule.department && !same(rule.department, person.department)) return false;
    if (rule.bagian && !same(normalizeBagian(rule.bagian), normalizeBagian(person.bagian))) return false;
    if (rule.location && locationOfWorkLocation(person.workLocation) !== rule.location) return false;
    return true;
}

/** Period PIC ratees targeted by the rule. */
export function targetPics(rule: CsiUnitRule, pics: CsiRulePic[]): CsiRulePic[] {
    return pics.filter((pic) => pic.serviceCode === rule.serviceCode
        && (!rule.picBagian || same(rule.picBagian, pic.bagian))
        && (!rule.picIds?.length || rule.picIds.includes(pic.picId)));
}

/** NIK → set of period ratee ids, merged over every rule. */
export function expandRules(rules: CsiUnitRule[], people: CsiRulePerson[], pics: CsiRulePic[]): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    rules.forEach((rule) => {
        const targets = targetPics(rule, pics).map((pic) => pic.periodRateeId);
        if (!targets.length) return;
        people.filter((person) => personMatches(rule, person)).forEach((person) => {
            const set = result.get(person.nik) ?? new Set<string>();
            targets.forEach((id) => set.add(id));
            result.set(person.nik, set);
        });
    });
    return result;
}
