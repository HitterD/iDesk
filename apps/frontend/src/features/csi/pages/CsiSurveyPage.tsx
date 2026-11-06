import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/stores/useAuth';
import { useCsiForm, useSubmitCsi } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import { CSI_HTTP_GONE, CSI_HTTP_NOT_FOUND, CSI_MESSAGES, errorStatus, hasAnswered } from '../lib/csiForm';
import { formatDateTime } from '../lib/format';
import { clearDraft, draftKey } from '../lib/surveyDraft';
import { BackLink, CsiStatusScreen, CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { ThankYouScreen } from '../components/respond/ThankYouScreen';
import { clearPicks, RespondentFlow } from '../components/respond/PicSurveyFlow';
import { NextSurveyCard } from '../components/respond/NextSurveyCard';
import { answeredOnText, RESPOND_COPY } from '../components/respond/respondCopy';
import type { CsiOpenForm, SubmitCsiResponse } from '../types';

const SKELETON_CARDS = 3;
/** The app's wide content width (dashboard / resources / hardware request use 1480 px) so the photo layout has room. */
const PAGE_WIDTH = 'mx-auto w-full max-w-[1480px]';

function SurveySkeleton() {
    return (
        <div className={`${PAGE_WIDTH} space-y-5 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Memuat survei">
            <div className="h-8 w-2/3 rounded-xl bg-muted" />
            <div className="h-4 w-full rounded bg-muted/60" />
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className={`${CSI_CARD} h-40`} />)}
        </div>
    );
}

/** The server is the authority: after a successful submit or an ended period (410) the local draft is obsolete; a 409 keeps it. */
function useClearDraftWhen(done: boolean, userId: string, periodId: string) {
    useEffect(() => {
        if (!done || !userId) return;
        clearDraft(draftKey(userId, periodId));
        clearPicks(userId, periodId);
    }, [done, userId, periodId]);
}

/** Ratees the payload actually answered (HC per PIC rates only the picked PICs); everyone otherwise. */
const ratedIn = (form: CsiOpenForm, payload: SubmitCsiResponse | null) => {
    if (!form.respondentPicks || !payload) return form.ratees;
    const answered = new Set(payload.items.map((item) => item.periodRateeDimensionId));
    return form.ratees.filter((ratee) => ratee.dimensions.some((dimension) => answered.has(dimension.periodRateeDimensionId)));
};

/** The account already answered: one answer per account, so the survey is closed for it (with the next one offered). */
function AlreadyAnswered({ form, basePath }: { form: CsiOpenForm; basePath: string }) {
    return (
        <FadeIn className={`${CSI_CARD} mx-auto max-w-2xl px-6 py-12 text-center sm:px-10 sm:py-14`}>
            <div role="status" className="flex flex-col items-center">
                <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{RESPOND_COPY.alreadyAnsweredTitle}</h1>
                <p className="mt-1 text-[15px] font-medium text-foreground">{form.title}</p>
                {form.submittedAt && <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">{answeredOnText(formatDateTime(form.submittedAt))}</p>}
            </div>
            <NextSurveyCard currentId={form.id} basePath={basePath} className="mt-8" />
            <div className="mt-8"><BackLink to={basePath} /></div>
        </FadeIn>
    );
}

function SurveyForm({ form, basePath, userId }: { form: CsiOpenForm; basePath: string; userId: string }) {
    const submit = useSubmitCsi(form.id);
    // The last payload sent: the thank-you screen shows per-subject averages from it.
    const [lastPayload, setLastPayload] = useState<SubmitCsiResponse | null>(null);
    const status = errorStatus(submit.error);
    useClearDraftWhen(submit.isSuccess || status === CSI_HTTP_GONE, userId, form.id);

    if (submit.isSuccess) {
        return (
            <ThankYouScreen periodId={form.id} respondentName={form.respondent.fullName} ratees={ratedIn(form, lastPayload)} payload={lastPayload}
                message={submit.data.thankYou} basePath={basePath} />
        );
    }
    if (status === CSI_HTTP_GONE) {
        return <CsiStatusScreen tone="warning" title={CSI_MESSAGES.ended} backTo={basePath} />;
    }
    if (status === CSI_HTTP_NOT_FOUND) {
        return <CsiStatusScreen tone="muted" title={CSI_MESSAGES.notFound} backTo={basePath} />;
    }
    return (
        <div className={PAGE_WIDTH}>
            <FadeIn className="mb-4 pt-1"><BackLink to={basePath} /></FadeIn>
            <RespondentFlow form={form} userId={userId}
                onSubmit={(payload) => { setLastPayload(payload); submit.mutate(payload); }}
                submitting={submit.isPending} error={submit.error} />
        </div>
    );
}

export function CsiSurveyPage() {
    const { id = '' } = useParams<{ id: string }>();
    const basePath = useCsiBasePath();
    const userId = useAuth((state) => state.user?.id ?? '');
    const { data: form, error, isLoading, refetch } = useCsiForm(id);
    useClearDraftWhen(errorStatus(error) === CSI_HTTP_GONE, userId, id);

    if (isLoading) return <SurveySkeleton />;
    if (error || !form) {
        const status = errorStatus(error);
        if (status === CSI_HTTP_GONE) return <CsiStatusScreen tone="warning" title={CSI_MESSAGES.ended} backTo={basePath} />;
        if (status === CSI_HTTP_NOT_FOUND || !error) return <CsiStatusScreen tone="muted" title={CSI_MESSAGES.notFound} backTo={basePath} />;
        return <ErrorState title="Gagal memuat survei" message="Terjadi kendala saat memuat survei. Silakan coba lagi." onRetry={() => refetch()} />;
    }
    if (hasAnswered(form)) return <AlreadyAnswered form={form} basePath={basePath} />;
    return <SurveyForm key={form.id} form={form} basePath={basePath} userId={userId} />;
}

export default CsiSurveyPage;
