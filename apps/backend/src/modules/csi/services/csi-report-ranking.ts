import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_RANK_MIN_RATERS, CsiRateeKind } from '../csi.constants';
import { CSI_HC_SERVICES, serviceName } from '../org/csi-org.constants';
import { CsiScoreBands, CsiScoreWord, scoreWordFor } from './csi-score-bands';
import { round2 } from './csi-score.util';

/** One ranked (rank set), "Belum cukup penilai" or "Belum ada penilaian" (rank null) person/team of a service. */
export type CsiRankRow = {
    rank: number | null; name: string; detail: string | null; raters: number; average: number | null;
    word: CsiScoreWord | null; previous: number | null; delta: number | null;
};
export type CsiServiceRanking = {
    serviceCode: string | null; serviceName: string; ranked: CsiRankRow[];
    /** 1 to CSI_RANK_MIN_RATERS - 1 raters with a score: listed with it, no rank. */
    insufficient: CsiRankRow[];
    /** No score yet (no rater, or no scored answer): listed by name, never dropped. */
    noAnswers: CsiRankRow[];
};
export type CsiServiceHighlight = { best: CsiServiceScore; worst: CsiServiceScore };
type CsiServiceScore = { code: string; name: string; average: number };

/** A rated subject as the ranking needs it: HC groups by serviceCode, ICT by kind; `detail` = bagian/fungsi or site. */
export type CsiRankSubject = {
    name: string; kind: CsiRateeKind; average: number | null; raters: number; serviceCode: string | null; detail: string | null; previous: number | null;
};

/** HC report order of the services (HCD, HCC, HCS); subjects without a service come last as "Lainnya". */
const HC_SERVICE_ORDER = ['HCD', 'HCC', 'HCS'];
const OTHER_SERVICE = 'Lainnya';
const ICT_GROUPS: ReadonlyArray<{ kind: CsiRateeKind; name: string }> = [{ kind: CsiRateeKind.TEAM, name: 'Tim' }, { kind: CsiRateeKind.PERSON, name: 'Orang' }];

/**
 * Competition ranking (1, 2, 2, 4) on the average rounded to 2 decimals (what the report prints). Order: real average
 * high to low, then name; rows without an average are not ranked.
 */
export function competitionRanks<T extends { name: string; average: number | null }>(rows: T[]): Array<T & { rank: number }> {
    const sorted = rows.filter((row) => row.average !== null)
        .sort((a, b) => b.average! - a.average! || a.name.localeCompare(b.name, 'id'));
    return sorted.map((row) => ({ ...row, rank: 1 + sorted.filter((other) => round2(other.average!) > round2(row.average!)).length }));
}

function rankRow(subject: CsiRankSubject, bands: CsiScoreBands, rank: number | null): CsiRankRow {
    const { name, detail, raters, average, previous } = subject;
    return {
        rank, name, detail, raters, average, word: scoreWordFor(average, bands), previous,
        delta: average === null || previous === null ? null : round2(average - previous),
    };
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'id');

/**
 * Ranked rows from CSI_RANK_MIN_RATERS raters on; fewer raters with a score are listed with it but without a number;
 * subjects without any score (0 raters or no scored answer) are listed apart by name.
 */
function serviceGroup(serviceCode: string | null, name: string, subjects: CsiRankSubject[], bands: CsiScoreBands): CsiServiceRanking {
    const scored = subjects.filter((subject) => subject.raters > 0 && subject.average !== null);
    const enough = scored.filter((subject) => subject.raters >= CSI_RANK_MIN_RATERS);
    const insufficient = scored.filter((subject) => subject.raters < CSI_RANK_MIN_RATERS)
        .sort((a, b) => b.average! - a.average! || byName(a, b));
    const noAnswers = subjects.filter((subject) => !scored.includes(subject)).sort(byName);
    return {
        serviceCode, serviceName: name,
        ranked: competitionRanks(enough).map((subject) => rankRow(subject, bands, subject.rank)),
        insufficient: insufficient.map((subject) => rankRow(subject, bands, null)),
        noAnswers: noAnswers.map((subject) => rankRow(subject, bands, null)),
    };
}

/** Every row of a group in report order (ranked, Belum cukup penilai, Belum ada penilaian). */
export const rankRowsOf = (group: CsiServiceRanking) => [...group.ranked, ...group.insufficient, ...group.noAnswers];

const hcServiceOrder = (code: string | null) => {
    const index = code === null ? -1 : HC_SERVICE_ORDER.indexOf(code);
    return index < 0 ? HC_SERVICE_ORDER.length : index;
};
/** Report order of layanan codes everywhere (HCD, HCC, HCS, then others A-Z, no layanan last). */
export const compareServiceCodes = (a: string | null, b: string | null) =>
    hcServiceOrder(a || null) - hcServiceOrder(b || null) || (a === b ? 0 : !a ? 1 : !b ? -1 : a.localeCompare(b));

/** HC: one group per service (PICs and teams together); ICT: the old split, "Tim" then "Orang". Empty groups are left out. */
export function rankingByService(input: { scope: ServiceScope; subjects: CsiRankSubject[]; bands: CsiScoreBands }): CsiServiceRanking[] {
    const { scope, subjects, bands } = input;
    if (scope === ServiceScope.ICT) {
        return ICT_GROUPS.map((group) => serviceGroup(null, group.name, subjects.filter((subject) => subject.kind === group.kind), bands))
            .filter((group) => rankRowsOf(group).length);
    }
    const known = (code: string | null) => (code && CSI_HC_SERVICES.some((service) => service.code === code) ? code : null);
    const codes = [...new Set(subjects.map((subject) => known(subject.serviceCode)))]
        .sort(compareServiceCodes);
    return codes.map((code) => serviceGroup(code, serviceName(code) ?? OTHER_SERVICE, subjects.filter((subject) => known(subject.serviceCode) === code), bands));
}

/** Best and worst HC service by average (never a person); null when fewer than two services have an average. */
export function serviceHighlight(services: Array<{ serviceCode: string | null; average: number | null }>): CsiServiceHighlight | null {
    const scored = services
        .filter((service): service is { serviceCode: string; average: number } => !!service.serviceCode && service.average !== null && !!serviceName(service.serviceCode))
        .map((service) => ({ code: service.serviceCode, name: serviceName(service.serviceCode)!, average: service.average }))
        .sort((a, b) => b.average - a.average || a.code.localeCompare(b.code));
    return scored.length < 2 ? null : { best: scored[0], worst: scored[scored.length - 1] };
}
