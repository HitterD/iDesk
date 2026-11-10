import { CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiRaterMatrix } from './csi-rater-matrix.calc';
import { CsiReportService } from './csi-report.service';
import { CsiSlaReporter } from './csi-sla.service';
import { bandsOf, CsiScoreBand, CsiScoreBands, CsiScoreWord, scoreBand, scoreWordFor } from './csi-score-bands';
import { averageOfAverages } from './csi-score.util';
import type { CsiHcRecap } from '../org/csi-hc-report.calc';

/**
 * Everything the executive report shows (PDF and Excel read the same model, so both always carry every parameter).
 * Built in memory from the report, the previous period and the participation lists; nothing is sampled or capped.
 */
export type CsiReportData = Awaited<ReturnType<CsiReportService['getReport']>>;
type Ratee = CsiReportData['ratees'][number];

const SCORE_MAX = 5;
const PERCENT = 100;
const INDEX_DECIMALS = 10;
/** Highlight boxes for long people lists: top and "needs attention" rows (the full table is always printed). */
export const HIGHLIGHT_COUNT = 3;
export const HIGHLIGHT_FROM = 10;
const SCORED = new Set<string>([CsiQuestionType.STAR, CsiQuestionType.SCALE]);

export const indexPct = (average: number | null) => (average === null ? null : Math.round((average / SCORE_MAX) * PERCENT * INDEX_DECIMALS) / INDEX_DECIMALS);
const round2 = (value: number) => Math.round(value * 100) / 100;
const delta = (now: number | null, before: number | null | undefined) => (now === null || before === null || before === undefined ? null : round2(now - before));

export type CsiReportRow = {
    rank: number; periodRateeId: string; kind: CsiRateeKind; name: string; siteCode: string | null; raters: number;
    average: number | null; word: CsiScoreWord | null; band: CsiScoreBand | null; indexPct: number | null; previous: number | null; delta: number | null;
    stars: number[];
};
export type CsiAspect = { label: string; full: string; average: number | null; answers: number };
export type CsiQuestionColumn = { code: string; label: string; full: string; type: CsiQuestionType };
export type CsiQuestionGrid = { columns: CsiQuestionColumn[]; rows: Array<{ name: string; kind: CsiRateeKind; siteCode: string | null; values: Array<number | null> }> };
export type CsiChoiceSummary = { label: string; counts: Array<{ option: string; count: number }> };
export type CsiSiteParticipation = {
    siteId: string; code: string | null; name: string | null; basis: number; target: number; responses: number;
    respondenPct: number | null; pengisiPct: number | null; reached: boolean; average: number | null;
};
export type CsiDepartmentRow = { name: string; responses: number; pct: number };
export type CsiBasisPerson = CsiSlaReporter & { siteCode: string | null; answered: boolean };
export type CsiCommentGroup = { name: string; kind: CsiRateeKind; comments: Array<{ text: string; department: string; date: Date }> };

export type CsiReportModel = {
    title: string; scopeLabel: string; startDate: string; endDate: string; siteLabel: string; modeLabel: string;
    targetPct: number; docNo: string;
    /** Colour bands of the survey (period scoreFairMin / scoreGoodMin): every colour and predikat follows them. */
    bands: CsiScoreBands;
    overall: { average: number | null; word: CsiScoreWord | null; band: CsiScoreBand | null; indexPct: number | null; previous: number | null; delta: number | null };
    participation: { basis: number; target: number; responses: number; respondenPct: number | null; pengisiPct: number | null; reached: boolean; basisLabel: string };
    sites: CsiSiteParticipation[];
    teams: CsiReportRow[];
    people: CsiReportRow[];
    aspects: CsiAspect[];
    teamGrid: CsiQuestionGrid;
    peopleGrid: CsiQuestionGrid;
    choices: CsiChoiceSummary[];
    departments: CsiDepartmentRow[];
    comments: CsiCommentGroup[];
    basis: CsiBasisPerson[];
    highlights: string[];
    notes: string;
    counts: { teams: number; people: number; sites: number; comments: number };
    /** HC per-PIC recap (set only when the period rates HC PICs). */
    hcRecap?: CsiHcRecap | null;
};

/** Report label of a question: the short label, else the bracketed aspect of the description, else the text. */
export function questionLabel(question: { name: string; shortLabel?: string | null; description?: string | null }): string {
    const short = question.shortLabel?.trim();
    if (short) return short;
    return question.description?.trim().match(/^\[([\s\S]+)\]$/)?.[1].trim() || question.name;
}
const questionKey = (question: { name: string; description?: string | null }) => `${question.name}\u0000${question.description?.trim() ?? ''}`;

type RowContext = { siteCodeOf: (id: string | null) => string | null; previous: Map<string, number | null>; teamLabel: string; bands: CsiScoreBands };

function rows(ratees: Ratee[], kind: CsiRateeKind, { siteCodeOf, previous, teamLabel, bands }: RowContext): CsiReportRow[] {
    return ratees.filter((ratee) => ratee.kind === kind)
        .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.displayName.localeCompare(b.displayName, 'id'))
        .map((ratee, index) => {
            const name = kind === CsiRateeKind.TEAM ? ratee.displayName || teamLabel : ratee.displayName;
            const before = previous.get(subjectKeyOf(ratee, name)) ?? null;
            return {
                rank: index + 1, periodRateeId: ratee.periodRateeId, kind, name, siteCode: siteCodeOf(ratee.siteId), raters: ratee.respondentCount,
                average: ratee.average, word: scoreWordFor(ratee.average, bands), band: scoreBand(ratee.average, bands), indexPct: ratee.indexPct, previous: before, delta: delta(ratee.average, before),
                stars: ratee.starDistribution ?? [0, 0, 0, 0, 0],
            };
        });
}

/** Matches a subject across periods: people by name (user snapshot), teams by name + site. */
export const subjectKeyOf = (ratee: Pick<Ratee, 'kind' | 'siteId'>, name: string) => `${ratee.kind}:${name.trim().toLowerCase()}:${ratee.kind === CsiRateeKind.TEAM ? ratee.siteId ?? '' : ''}`;

/** Questions across all subjects of one kind, in first-seen order, coded P1..Pn (team and people grids separately). */
function grid(ratees: Ratee[], kind: CsiRateeKind, siteCodeOf: (id: string | null) => string | null, teamLabel: string, ordered: CsiReportRow[]): CsiQuestionGrid {
    const own = ratees.filter((ratee) => ratee.kind === kind);
    const columns: Array<CsiQuestionColumn & { key: string }> = [];
    own.forEach((ratee) => ratee.questions.forEach((question) => {
        if (!SCORED.has(question.type)) return;
        const key = questionKey(question);
        if (!columns.some((column) => column.key === key)) {
            columns.push({ key, code: `${kind === CsiRateeKind.TEAM ? 'T' : 'P'}${columns.length + 1}`, label: questionLabel(question), full: question.name, type: question.type as CsiQuestionType });
        }
    }));
    const byId = new Map(own.map((ratee) => [ratee.periodRateeId, ratee]));
    return {
        columns: columns.map(({ key: _key, ...column }) => column),
        rows: ordered.map((row) => {
            const ratee = byId.get(row.periodRateeId)!;
            const values = columns.map((column) => ratee.questions.find((question) => questionKey(question) === column.key)?.average ?? null);
            return { name: row.name || (kind === CsiRateeKind.TEAM ? teamLabel : ''), kind, siteCode: siteCodeOf(ratee.siteId), values };
        }),
    };
}

/** Mean per question label over every subject asked it (weighted by subject), weakest first. */
function aspects(ratees: Ratee[]): CsiAspect[] {
    const groups = new Map<string, { full: string; averages: Array<number | null>; answers: number }>();
    ratees.forEach((ratee) => ratee.questions.forEach((question) => {
        if (!SCORED.has(question.type)) return;
        const label = questionLabel(question);
        const group = groups.get(label) ?? { full: question.name, averages: [], answers: 0 };
        groups.set(label, { ...group, averages: [...group.averages, question.average], answers: group.answers + question.count });
    }));
    return [...groups].map(([label, group]) => ({ label, full: group.full, average: averageOfAverages(group.averages), answers: group.answers }))
        .sort((a, b) => (a.average ?? 99) - (b.average ?? 99));
}

function choices(ratees: Ratee[]): CsiChoiceSummary[] {
    const groups = new Map<string, Map<string, number>>();
    ratees.forEach((ratee) => ratee.questions.forEach((question) => {
        if (question.type !== CsiQuestionType.CHOICE) return;
        const label = questionLabel(question);
        const counts = groups.get(label) ?? new Map<string, number>();
        question.distribution.forEach((bucket) => counts.set(bucket.label, (counts.get(bucket.label) ?? 0) + bucket.count));
        groups.set(label, counts);
    }));
    return [...groups].map(([label, counts]) => ({ label, counts: [...counts].map(([option, count]) => ({ option, count })) }));
}

function highlightSentences(model: Pick<CsiReportModel, 'bands' | 'overall' | 'teams' | 'people' | 'aspects' | 'sites'>): string[] {
    const lines: string[] = [];
    const fmt = (value: number) => value.toFixed(2).replace('.', ',');
    const { overall } = model;
    if (overall.average === null) return ['Belum ada jawaban yang bernilai pada survei ini.'];
    lines.push(`Kepuasan keseluruhan ${overall.word} (${fmt(overall.average)} dari 5)${overall.delta === null ? '.' : `, ${overall.delta >= 0 ? 'naik' : 'turun'} ${fmt(Math.abs(overall.delta))} dari periode lalu.`}`);
    const all = [...model.teams, ...model.people].filter((row) => row.average !== null);
    const best = [...all].sort((a, b) => b.average! - a.average!)[0];
    const worst = [...all].sort((a, b) => a.average! - b.average!)[0];
    if (best && worst && best !== worst) lines.push(`Tertinggi: ${best.name} (${fmt(best.average!)}). Perlu perhatian: ${worst.name} (${fmt(worst.average!)})${worst.delta !== null && worst.delta < 0 ? `, turun ${fmt(-worst.delta)}` : ''}.`);
    const below = all.filter((row) => row.band === 'poor').length;
    if (below) lines.push(`${below} tim/orang di bawah ${fmt(model.bands.fairMin)} (Perlu perbaikan).`);
    const scored = model.aspects.filter((aspect) => aspect.average !== null);
    if (scored.length > 1) lines.push(`Aspek terlemah: ${scored[0].label} (${fmt(scored[0].average!)}). Terkuat: ${scored[scored.length - 1].label} (${fmt(scored[scored.length - 1].average!)}).`);
    const missed = model.sites.filter((site) => !site.reached && site.basis > 0);
    lines.push(missed.length ? `Site belum mencapai target partisipasi: ${missed.map((site) => `${site.code ?? site.name} (${site.respondenPct ?? 0}%)`).join(', ')}.` : 'Semua site mencapai target partisipasi.');
    return lines;
}

export type CsiReportModelInput = {
    report: CsiReportData;
    matrix: CsiRaterMatrix;
    scopeLabel: string;
    /** Average per subject in the previous period (subjectKeyOf); empty when there is none. */
    previousBySubject: Map<string, number | null>;
    /** Per site: basis people (SLA) and the user ids that answered. */
    siteBasis: Array<{ siteId: string; reporters: Array<CsiSlaReporter & { userId?: string }>; responses: number; average: number | null }>;
    answeredUserIds: Set<string>;
    reporterUserIds: Map<string, string>;
    departments: Array<{ name: string; responses: number }>;
    comments: Array<{ periodRateeId: string; text: string; department: string; date: Date }>;
    notes: string;
};

/** Responses against the basis, never above 100% (more answers than the basis still reads as complete). */
const respondenPct = (responses: number, basis: number) => (basis > 0 ? Math.min(PERCENT, Math.round((responses / basis) * PERCENT)) : null);

export function buildReportModel(input: CsiReportModelInput): CsiReportModel {
    const { report, scopeLabel } = input;
    const siteCodeOf = (id: string | null) => report.period.sites.find((site) => site.id === id)?.code ?? null;
    const teamLabel = report.period.teamLabel;
    const bands = bandsOf(report.period);
    const context: RowContext = { siteCodeOf, previous: input.previousBySubject, teamLabel, bands };
    const teams = rows(report.ratees, CsiRateeKind.TEAM, context);
    const people = rows(report.ratees, CsiRateeKind.PERSON, context);
    const targetPct = report.period.slaTargetPct;
    const sites: CsiSiteParticipation[] = input.siteBasis.map((row) => {
        const site = report.period.sites.find((item) => item.id === row.siteId);
        const basis = row.reporters.length;
        const target = Math.ceil((basis * targetPct) / PERCENT);
        return {
            siteId: row.siteId, code: site?.code ?? null, name: site?.name ?? null, basis, target, responses: row.responses,
            respondenPct: respondenPct(row.responses, basis), pengisiPct: target ? Math.min(PERCENT, Math.round((row.responses / target) * PERCENT)) : null,
            reached: target > 0 && row.responses >= target, average: row.average,
        };
    });
    const sla = report.sla;
    const totalDepartmentResponses = input.departments.reduce((sum, row) => sum + row.responses, 0);
    const byRatee = new Map<string, CsiCommentGroup>();
    [...teams, ...people].forEach((row) => byRatee.set(row.periodRateeId, { name: row.name, kind: row.kind, comments: [] }));
    input.comments.forEach((comment) => byRatee.get(comment.periodRateeId)?.comments.push({ text: comment.text, department: comment.department, date: comment.date }));
    const commentGroups = [...byRatee.values()].filter((group) => group.comments.length)
        .map((group) => ({ ...group, comments: [...group.comments].sort((a, b) => b.date.getTime() - a.date.getTime()) }));
    const basis: CsiBasisPerson[] = input.siteBasis.flatMap((row) => row.reporters.map((reporter) => {
        const userId = reporter.userId ?? input.reporterUserIds.get(reporter.email.toLowerCase());
        return { ...reporter, siteCode: siteCodeOf(row.siteId), answered: !!userId && input.answeredUserIds.has(userId) };
    })).sort((a, b) => (a.siteCode ?? '').localeCompare(b.siteCode ?? '') || Number(a.answered) - Number(b.answered) || a.fullName.localeCompare(b.fullName, 'id', { numeric: true }));
    const overallAverage = report.overall.average;
    const partial: Omit<CsiReportModel, 'highlights'> = {
        title: report.period.title, scopeLabel, startDate: report.period.startDate, endDate: report.period.endDate,
        siteLabel: report.period.sites.map((site) => site.name ?? site.code).filter(Boolean).join(', ') || 'Semua site',
        modeLabel: sla.mode === CsiRespondentMode.LISTED ? 'Hanya penilai terdaftar' : 'Semua user di site',
        targetPct, docNo: `CSI-${scopeLabel}-${report.period.id.slice(0, 8).toUpperCase()}`, bands,
        overall: { average: overallAverage, word: scoreWordFor(overallAverage, bands), band: scoreBand(overallAverage, bands), indexPct: indexPct(overallAverage), previous: report.previousAverage, delta: delta(overallAverage, report.previousAverage) },
        participation: {
            basis: sla.basis, target: sla.target, responses: sla.responses, respondenPct: respondenPct(sla.responses, sla.basis),
            pengisiPct: sla.pengisiPct, reached: sla.target > 0 && sla.responses >= sla.target,
            basisLabel: sla.mode === CsiRespondentMode.LISTED ? 'penilai terdaftar' : 'pelapor iDesk 12 bulan terakhir',
        },
        sites, teams, people,
        aspects: aspects(report.ratees),
        teamGrid: grid(report.ratees, CsiRateeKind.TEAM, siteCodeOf, teamLabel, teams),
        peopleGrid: grid(report.ratees, CsiRateeKind.PERSON, siteCodeOf, teamLabel, people),
        choices: choices(report.ratees),
        departments: input.departments
            .map((row) => ({ ...row, pct: totalDepartmentResponses ? Math.round((row.responses / totalDepartmentResponses) * 1000) / 10 : 0 }))
            .sort((a, b) => b.responses - a.responses || a.name.localeCompare(b.name, 'id')),
        comments: commentGroups, basis, notes: input.notes.trim(),
        counts: { teams: teams.length, people: people.length, sites: report.period.sites.length, comments: commentGroups.reduce((sum, group) => sum + group.comments.length, 0) },
    };
    return { ...partial, highlights: highlightSentences(partial) };
}
