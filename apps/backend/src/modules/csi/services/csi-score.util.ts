const DECIMALS = 100;
const PERCENT = 100;

/** Rounds to 2 decimals (the precision of every CSI average). */
export function round2(value: number): number {
    return Math.round(value * DECIMALS) / DECIMALS;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const present = (values: Array<number | null>): number[] =>
    values.filter((value): value is number => value !== null && value !== undefined);

/** Mean of the non-null scores of one response, or null when it has none. Never converts "no score" to 0. */
export function responseAverage(scores: Array<number | null>): number | null {
    const scored = present(scores);
    return scored.length ? round2(mean(scored)) : null;
}

/** Mean of per-response averages, ignoring null; null when nothing is scored. */
export function averageOfAverages(values: Array<number | null>): number | null {
    const scored = present(values);
    return scored.length ? round2(mean(scored)) : null;
}

/** SLA target = ceil(basis x pct / 100). */
export function slaTarget(basis: number, targetPct: number): number {
    return Math.ceil((basis * targetPct) / PERCENT);
}

/** % Pengisi = min(100, round(responses / target x 100)); null when there is no basis (or target). */
export function pengisiPct(basis: number, responses: number, target: number): number | null {
    if (!basis || !target) return null;
    return Math.min(PERCENT, Math.round((responses / target) * PERCENT));
}
