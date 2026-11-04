import { addDays, addMonths, differenceInCalendarDays, differenceInCalendarMonths, endOfMonth, format, isLastDayOfMonth, parseISO } from 'date-fns';
import { CSI_DEFAULT_MODE } from './csiAdmin';
import type {
    CreateCsiPeriod, CsiPeriodDetail, CsiPeriodListItem, CsiRespondentMode, CsiScopeParam, UpdateCsiPeriod,
} from '../types';

export const NO_COPY = '';
export const DEFAULT_TEAM_LABEL = 'Tim IT Support';
export const DEFAULT_SLA_TARGET = 80;
export const SLA_TARGET_MIN = 1;
export const SLA_TARGET_MAX = 100;
export const TEAM_LABEL_MAX = 100;

export interface PeriodFormState {
    siteIds: string[];
    title: string;
    intro: string;
    thankYou: string;
    startDate: string;
    endDate: string;
    respondentMode: CsiRespondentMode;
    teamEnabled: boolean;
    teamLabel: string;
    individualEnabled: boolean;
    /** Kept as typed text so the field can be empty while editing. */
    slaTargetPct: string;
    /** Create only: "Salin dari survei sebelumnya" chosen. */
    copying: boolean;
    copyFromPeriodId: string;
}

type SectionSource = Pick<CsiPeriodDetail, 'teamEnabled' | 'teamLabel' | 'individualEnabled' | 'slaTargetPct'>;
const sectionFields = (source: SectionSource) => ({
    teamEnabled: source.teamEnabled, teamLabel: source.teamLabel, individualEnabled: source.individualEnabled, slaTargetPct: String(source.slaTargetPct),
});

export const initialState = (scope: CsiScopeParam, period?: CsiPeriodDetail): PeriodFormState => period ? {
    siteIds: period.sites.map((site) => site.id), title: period.title, intro: period.intro, thankYou: period.thankYou,
    startDate: period.startDate, endDate: period.endDate, respondentMode: period.respondentMode, ...sectionFields(period),
    copying: false, copyFromPeriodId: NO_COPY,
} : {
    siteIds: [], title: '', intro: '', thankYou: '', startDate: '', endDate: '', respondentMode: CSI_DEFAULT_MODE[scope],
    teamEnabled: false, teamLabel: DEFAULT_TEAM_LABEL, individualEnabled: true, slaTargetPct: String(DEFAULT_SLA_TARGET),
    copying: false, copyFromPeriodId: NO_COPY,
};

const ISO = 'yyyy-MM-dd';

/** ISO calendar dates compare correctly as strings. */
export const datesInvalid = (form: PeriodFormState) => !!form.startDate && !!form.endDate && form.endDate < form.startDate;

/** At least one of "Penilaian tim" / "Penilaian per orang" must stay on. */
export const sectionsInvalid = (form: PeriodFormState) => !form.teamEnabled && !form.individualEnabled;

export const slaTargetValue = (form: PeriodFormState) => Number(form.slaTargetPct);
export const slaInvalid = (form: PeriodFormState) => {
    const value = slaTargetValue(form);
    return !form.slaTargetPct.trim() || !Number.isInteger(value) || value < SLA_TARGET_MIN || value > SLA_TARGET_MAX;
};
export const teamLabelInvalid = (form: PeriodFormState) => form.teamEnabled && !form.teamLabel.trim();

const TEXT_FIELDS = ['title', 'intro', 'thankYou', 'startDate', 'endDate'] as const;
const FROZEN_FIELDS = ['respondentMode', 'teamEnabled', 'individualEnabled', 'teamLabel'] as const;
const sameIdSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** A new period is always "dirty"; an existing one only when an editable field changed (frozen fields only while unlocked). */
export function formDirty(form: PeriodFormState, period?: CsiPeriodDetail): boolean {
    if (!period) return true;
    if (TEXT_FIELDS.some((key) => (key === 'title' ? form.title.trim() : form[key]) !== period[key])) return true;
    if (slaTargetValue(form) !== period.slaTargetPct) return true;
    if (period.locked) return false;
    return FROZEN_FIELDS.some((key) => form[key] !== period[key]) || !sameIdSet(form.siteIds, period.sites.map((site) => site.id));
}

/** Switching to copy mode always clears the dates: a copied survey must get its own range. */
export const withCopyMode = (form: PeriodFormState, copying: boolean): PeriodFormState => copying
    ? { ...form, copying, startDate: '', endDate: '' }
    : { ...form, copying, copyFromPeriodId: NO_COPY };

/**
 * "Buat lagi untuk periode berikutnya": the source copied with the same length right after it ends
 * (a monthly survey of 1-31 Okt becomes 1-31 Nov; a 3-day one starts the next day).
 */
export function nextPeriodRange(source: Pick<CsiPeriodListItem, 'startDate' | 'endDate'>): { startDate: string; endDate: string } {
    const start = parseISO(source.startDate);
    const end = parseISO(source.endDate);
    const wholeMonth = start.getDate() === 1 && isLastDayOfMonth(end);
    if (wholeMonth) {
        const months = differenceInCalendarMonths(end, start) + 1;
        const nextStart = addMonths(start, months);
        return { startDate: format(nextStart, ISO), endDate: format(endOfMonth(addMonths(nextStart, months - 1)), ISO) };
    }
    const nextStart = addDays(end, 1);
    return { startDate: format(nextStart, ISO), endDate: format(addDays(nextStart, differenceInCalendarDays(end, start)), ISO) };
}

/** Pre-filled "copy" form for the next period of `source`. */
export function nextPeriodForm(scope: CsiScopeParam, periods: readonly CsiPeriodListItem[], sourceId: string): PeriodFormState {
    const source = periods.find((item) => item.id === sourceId);
    const copied = withCopySource({ ...initialState(scope), copying: true }, periods, sourceId);
    return source ? { ...copied, ...nextPeriodRange(source) } : copied;
}

/** Copying also brings the source's sites, sections and SLA target; the user can still override them. */
export function withCopySource(form: PeriodFormState, periods: readonly CsiPeriodListItem[], id: string): PeriodFormState {
    const source = periods.find((item) => item.id === id);
    if (!source) return { ...form, copyFromPeriodId: NO_COPY };
    return {
        ...form, copyFromPeriodId: id, title: source.title, intro: source.intro, thankYou: source.thankYou,
        respondentMode: source.respondentMode, siteIds: source.sites.map((site) => site.id), ...sectionFields(source),
        startDate: '', endDate: '',
    };
}

const textAndDates = (form: PeriodFormState) => ({
    title: form.title.trim(), intro: form.intro, thankYou: form.thankYou, startDate: form.startDate, endDate: form.endDate,
    slaTargetPct: slaTargetValue(form),
});

const frozenPayload = (form: PeriodFormState) => ({
    siteIds: form.siteIds, respondentMode: form.respondentMode, teamEnabled: form.teamEnabled,
    individualEnabled: form.individualEnabled, ...(form.teamEnabled ? { teamLabel: form.teamLabel.trim() } : {}),
});

/** Once the survey has answers the backend freezes sites, mode and sections; only texts, dates and SLA stay. */
export const toUpdatePayload = (form: PeriodFormState, locked: boolean): UpdateCsiPeriod => ({
    ...textAndDates(form),
    ...(locked ? {} : frozenPayload(form)),
});

export const toCreatePayload = (form: PeriodFormState): CreateCsiPeriod => ({
    ...textAndDates(form),
    ...frozenPayload(form),
    ...(form.copying && form.copyFromPeriodId ? { copyFromPeriodId: form.copyFromPeriodId } : {}),
});
