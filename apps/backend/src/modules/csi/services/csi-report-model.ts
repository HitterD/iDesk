import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_SIMULATION_TITLE_PREFIX, CsiQuestionType, CsiRateeKind, CsiRespondentMode } from '../csi.constants';
import { CsiRaterMatrix } from './csi-rater-matrix.calc';
import { CsiDepartmentParticipation, CsiSlaBlock, departmentParticipation, slaBlock } from './csi-report-participation';
import { CsiServiceHighlight, CsiServiceRanking, rankingByService, serviceHighlight } from './csi-report-ranking';
import { CsiReportService } from './csi-report.service';
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
/** Comments about one subject; `serviceCode` = its layanan (HC report groups the comments per layanan). */
export type CsiCommentGroup = { name: string; kind: CsiRateeKind; serviceCode: string | null; comments: Array<{ text: string; department: string; date: Date }> };

export type CsiReportModel = {
    title: string; scopeLabel: string; startDate: string; endDate: string; siteLabel: string; modeLabel: string;
    targetPct: number; docNo: string;
    /** Title starts with CSI_SIMULATION_TITLE_PREFIX: fictitious answers, every PDF page carries the simulation banner. */
    simulation: boolean;
    /** Colour bands of the survey (period scoreFairMin / scoreGoodMin): every colour and predikat follows them. */
    bands: CsiScoreBands;
    overall: { average: number | null; word: CsiScoreWord | null; band: CsiScoreBand | null; indexPct: number | null; previous: number | null; delta: number | null };
    participation: { basis: number; target: number; responses: number; respondenPct: number | null; pengisiPct: number | null; reached: boolean; basisLabel: string };
    /** Official SLA status of the survey (answers vs ceil(basis × target%)). */
    sla: CsiSlaBlock;
    /** True when an earlier published period exists (Lalu / Δ columns only then). */
    hasPrevious: boolean;
    sites: CsiSiteParticipation[];
    teams: CsiReportRow[];
    people: CsiReportRow[];
    aspects: CsiAspect[];
    teamGrid: CsiQuestionGrid;
    peopleGrid: CsiQuestionGrid;
    choices: CsiChoiceSummary[];
    /** Basis raters per department, numbers only; departments below CSI_ANON_MIN_GROUP merged. No names anywhere. */
    departments: CsiDepartmentParticipation[];
    /** Fair ranking: HC per layanan, ICT "Tim" and "Orang"; fewer than CSI_RANK_MIN_RATERS raters = insufficient. */
    rankingByService: CsiServiceRanking[];
    /** HC best / worst layanan (never a person); null for ICT or fewer than two scored layanan. */
    serviceHighlight: CsiServiceHighlight | null;
    comments: CsiCommentGroup[];
    /** Summary sentences; they never name a person or team. */
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
    const own = ratees.filter((ratee) => ratee.kind === kind);
    const nameOf = (ratee: Ratee) => (kind === CsiRateeKind.TEAM ? ratee.displayName || teamLabel : ratee.displayName);
    const sameName = (key: string) => own.filter((other) => subjectKeyOf(other, nameOf(other)) === key).length;
    return own
        .sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.displayName.localeCompare(b.displayName, 'id'))
        .map((ratee, index) => {
            const name = nameOf(ratee);
            const before = previousOfSubject(previous, ratee, name, sameName(subjectKeyOf(ratee, name)));
            return {
                rank: index + 1, periodRateeId: ratee.periodRateeId, kind, name, siteCode: siteCodeOf(ratee.siteId), raters: ratee.respondentCount,
                average: ratee.average, word: scoreWordFor(ratee.average, bands), band: scoreBand(ratee.average, bands), indexPct: ratee.indexPct, previous: before, delta: delta(ratee.average, before),
                stars: ratee.starDistribution ?? [0, 0, 0, 0, 0],
            };
        });
}

/** Matches a subject across periods by name: people by name (user snapshot), teams by name + site. */
export const subjectKeyOf = (ratee: Pick<Ratee, 'kind' | 'siteId'>, name: string) => `${ratee.kind}:${name.trim().toLowerCase()}:${ratee.kind === CsiRateeKind.TEAM ? ratee.siteId ?? '' : ''}`;
/** Matches an HC PIC across periods by master PIC (renames and layanan moves keep the link). */
export const picKeyOf = (picId: string) => `PIC:${picId}`;
type PreviousSubject = { kind: CsiRateeKind; siteId: string | null; name: string; picId: string | null; average: number | null };

/** Previous-period average: master PIC first, then the name key, never by a name two subjects share now. */
function previousOfSubject(previous: Map<string, number | null>, ratee: Pick<Ratee, 'kind' | 'siteId'> & { picId?: string | null }, name: string, sameNameNow: number): number | null {
    if (ratee.picId && previous.has(picKeyOf(ratee.picId))) return previous.get(picKeyOf(ratee.picId)) ?? null;
    return sameNameNow === 1 ? previous.get(subjectKeyOf(ratee, name)) ?? null : null;
}

/** Previous-period map: master-PIC keys plus the name keys only one subject of that period carries. */
export function previousSubjectMap(subjects: PreviousSubject[]): Map<string, number | null> {
    const keyOf = (subject: PreviousSubject) => subjectKeyOf(subject, subject.name);
    const counts = new Map<string, number>();
    subjects.forEach((subject) => counts.set(keyOf(subject), (counts.get(keyOf(subject)) ?? 0) + 1));
    return new Map(subjects.flatMap((subject): Array<[string, number | null]> => [
        ...(subject.picId ? [[picKeyOf(subject.picId), subject.average] as [string, number | null]] : []),
        ...(counts.get(keyOf(subject)) === 1 ? [[keyOf(subject), subject.average] as [string, number | null]] : []),
    ]));
}

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

const fmt = (value: number) => value.toFixed(2).replace('.', ',');

/** Summary sentences, never naming a person or team: overall, best/worst layanan (HC), count below fair, aspects. */
function highlightSentences(model: Pick<CsiReportModel, 'bands' | 'overall' | 'teams' | 'people' | 'aspects' | 'serviceHighlight'>, scope: ServiceScope): string[] {
    const lines: string[] = [];
    const { overall } = model;
    if (overall.average === null) return ['Belum ada jawaban yang bernilai pada survei ini.'];
    lines.push(`Kepuasan keseluruhan ${overall.word} (${fmt(overall.average)} dari 5)${overall.delta === null ? '.' : `, ${overall.delta >= 0 ? 'naik' : 'turun'} ${fmt(Math.abs(overall.delta))} dari periode lalu.`}`);
    const highlight = model.serviceHighlight;
    if (highlight) lines.push(`Layanan tertinggi: ${highlight.best.code} ${fmt(highlight.best.average)} · terendah: ${highlight.worst.code} ${fmt(highlight.worst.average)}.`);
    const below = [...model.teams, ...model.people].filter((row) => row.band === 'poor').length;
    if (below) lines.push(`${below} ${scope === ServiceScope.HC ? 'PIC' : 'tim/orang'} di bawah ${fmt(model.bands.fairMin)} (Perlu perbaikan).`);
    const scored = model.aspects.filter((aspect) => aspect.average !== null);
    if (scored.length > 1) lines.push(`Aspek terlemah: ${scored[0].label} (${fmt(scored[0].average!)}). Terkuat: ${scored[scored.length - 1].label} (${fmt(scored[scored.length - 1].average!)}).`);
    // Participation per site is in the "Partisipasi & SLA" block on the same page, so it is not repeated here.
    return lines;
}

/** Subjects of the per-layanan ranking; detail = HC bagian (else fungsi pelayanan), ICT site code. */
function rankSubjects(report: CsiReportData, rows: CsiReportRow[], scope: ServiceScope) {
    const byId = new Map(report.ratees.map((ratee) => [ratee.periodRateeId, ratee]));
    return rows.map((row) => {
        const ratee = byId.get(row.periodRateeId);
        const detail = scope === ServiceScope.HC ? ratee?.bagian ?? ratee?.serviceFunction ?? null : row.siteCode;
        return { name: row.name, kind: row.kind, average: row.average, raters: row.raters, serviceCode: ratee?.serviceCode ?? null, detail, previous: row.previous };
    });
}

export type CsiReportModelInput = {
    report: CsiReportData;
    matrix: CsiRaterMatrix;
    scopeLabel: string;
    scope: ServiceScope;
    /** Average per subject in the previous period (subjectKeyOf); empty when there is none. */
    previousBySubject: Map<string, number | null>;
    /** An earlier published period exists (even when nobody answered it). */
    hasPrevious: boolean;
    /** Per site: SLA basis (number of people), responses and average. */
    siteBasis: Array<{ siteId: string; basis: number; responses: number; average: number | null }>;
    /** Every basis rater: department (directory, else account) and whether they answered; never a name. */
    raters: Array<{ department: string | null; answered: boolean }>;
    /** HC: average per layanan (mean of every rating of its PICs, as the recap); empty for ICT. */
    serviceAverages: Array<{ serviceCode: string | null; average: number | null }>;
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
        const basis = row.basis;
        const target = Math.ceil((basis * targetPct) / PERCENT);
        return {
            siteId: row.siteId, code: site?.code ?? null, name: site?.name ?? null, basis, target, responses: row.responses,
            respondenPct: respondenPct(row.responses, basis), pengisiPct: target ? Math.min(PERCENT, Math.round((row.responses / target) * PERCENT)) : null,
            reached: target > 0 && row.responses >= target, average: row.average,
        };
    });
    const sla = report.sla;
    const byRatee = new Map<string, CsiCommentGroup>();
    const serviceOf = new Map(report.ratees.map((ratee) => [ratee.periodRateeId, ratee.serviceCode ?? null]));
    [...teams, ...people].forEach((row) => byRatee.set(row.periodRateeId, { name: row.name, kind: row.kind, serviceCode: serviceOf.get(row.periodRateeId) ?? null, comments: [] }));
    input.comments.forEach((comment) => byRatee.get(comment.periodRateeId)?.comments.push({ text: comment.text, department: comment.department, date: comment.date }));
    const commentGroups = [...byRatee.values()].filter((group) => group.comments.length)
        .map((group) => ({ ...group, comments: [...group.comments].sort((a, b) => b.date.getTime() - a.date.getTime()) }));
    const overallAverage = report.overall.average;
    const partial: Omit<CsiReportModel, 'highlights'> = {
        title: report.period.title, scopeLabel, startDate: report.period.startDate, endDate: report.period.endDate,
        siteLabel: report.period.sites.map((site) => site.name ?? site.code).filter(Boolean).join(', ') || 'Semua site',
        modeLabel: sla.mode === CsiRespondentMode.LISTED ? 'Hanya penilai terdaftar' : 'Semua user di site',
        targetPct, docNo: `CSI-${scopeLabel}-${report.period.id.slice(0, 8).toUpperCase()}`, bands,
        simulation: report.period.title.startsWith(CSI_SIMULATION_TITLE_PREFIX),
        overall: { average: overallAverage, word: scoreWordFor(overallAverage, bands), band: scoreBand(overallAverage, bands), indexPct: indexPct(overallAverage), previous: report.previousAverage, delta: delta(overallAverage, report.previousAverage) },
        participation: {
            basis: sla.basis, target: sla.target, responses: sla.responses, respondenPct: respondenPct(sla.responses, sla.basis),
            pengisiPct: sla.pengisiPct, reached: sla.target > 0 && sla.responses >= sla.target,
            basisLabel: sla.mode === CsiRespondentMode.LISTED ? 'penilai terdaftar' : 'pelapor iDesk 12 bulan terakhir',
        },
        sla: slaBlock({ basis: sla.basis, targetPct, target: sla.target, responses: sla.responses }), hasPrevious: input.hasPrevious,
        sites, teams, people,
        rankingByService: rankingByService({ scope: input.scope, bands, subjects: rankSubjects(report, [...teams, ...people], input.scope) }),
        serviceHighlight: input.scope === ServiceScope.HC ? serviceHighlight(input.serviceAverages) : null,
        aspects: aspects(report.ratees),
        teamGrid: grid(report.ratees, CsiRateeKind.TEAM, siteCodeOf, teamLabel, teams),
        peopleGrid: grid(report.ratees, CsiRateeKind.PERSON, siteCodeOf, teamLabel, people),
        choices: choices(report.ratees),
        departments: departmentParticipation(input.raters, targetPct),
        comments: commentGroups, notes: input.notes.trim(),
        counts: { teams: teams.length, people: people.length, sites: report.period.sites.length, comments: commentGroups.reduce((sum, group) => sum + group.comments.length, 0) },
    };
    return { ...partial, highlights: highlightSentences(partial, input.scope) };
}
