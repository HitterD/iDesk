import { CSI_DEFAULT_MODE } from './csiAdmin';
import type {
    CreateCsiPeriod, CsiPeriodDetail, CsiPeriodListItem, CsiRespondentMode, CsiScopeParam, UpdateCsiPeriod,
} from '../types';

export const NO_COPY = '';

export interface PeriodFormState {
    siteId: string;
    title: string;
    intro: string;
    thankYou: string;
    startDate: string;
    endDate: string;
    respondentMode: CsiRespondentMode;
    /** Create only: "Salin dari survei sebelumnya" chosen. */
    copying: boolean;
    copyFromPeriodId: string;
}

export const initialState = (scope: CsiScopeParam, period?: CsiPeriodDetail): PeriodFormState => period ? {
    siteId: period.sites[0]?.id ?? '', title: period.title, intro: period.intro, thankYou: period.thankYou,
    startDate: period.startDate, endDate: period.endDate, respondentMode: period.respondentMode, copying: false, copyFromPeriodId: NO_COPY,
} : {
    siteId: '', title: '', intro: '', thankYou: '', startDate: '', endDate: '', respondentMode: CSI_DEFAULT_MODE[scope], copying: false, copyFromPeriodId: NO_COPY,
};

/** ISO calendar dates compare correctly as strings. */
export const datesInvalid = (form: PeriodFormState) => !!form.startDate && !!form.endDate && form.endDate < form.startDate;

const EDITABLE_FIELDS = ['title', 'intro', 'thankYou', 'startDate', 'endDate', 'respondentMode'] as const;

/** A new period is always "dirty"; an existing one only when an editable field changed. */
export const formDirty = (form: PeriodFormState, period?: CsiPeriodDetail) =>
    !period || EDITABLE_FIELDS.some((key) => (key === 'title' ? form.title.trim() : form[key]) !== period[key]);

/** Switching to copy mode always clears the dates: a copied survey must get its own range. */
export const withCopyMode = (form: PeriodFormState, copying: boolean): PeriodFormState => copying
    ? { ...form, copying, startDate: '', endDate: '' }
    : { ...form, copying, copyFromPeriodId: NO_COPY };

export function withCopySource(form: PeriodFormState, periods: readonly CsiPeriodListItem[], id: string): PeriodFormState {
    const source = periods.find((item) => item.id === id);
    if (!source) return { ...form, copyFromPeriodId: NO_COPY };
    return {
        ...form, copyFromPeriodId: id, title: source.title, intro: source.intro, thankYou: source.thankYou,
        respondentMode: source.respondentMode, startDate: '', endDate: '',
    };
}

const textAndDates = (form: PeriodFormState) => ({
    title: form.title.trim(), intro: form.intro, thankYou: form.thankYou, startDate: form.startDate, endDate: form.endDate,
});

export const toUpdatePayload = (form: PeriodFormState, modeLocked: boolean): UpdateCsiPeriod => ({
    ...textAndDates(form),
    ...(modeLocked ? {} : { respondentMode: form.respondentMode }),
});

export const toCreatePayload = (form: PeriodFormState): CreateCsiPeriod => ({
    ...textAndDates(form),
    respondentMode: form.respondentMode,
    siteIds: [form.siteId],
    ...(form.copying && form.copyFromPeriodId ? { copyFromPeriodId: form.copyFromPeriodId } : {}),
});
