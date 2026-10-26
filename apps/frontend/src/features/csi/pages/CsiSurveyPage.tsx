import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/stores/useAuth';
import { useCsiForm, useSubmitCsi } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import { CSI_HTTP_CONFLICT, CSI_HTTP_GONE, CSI_HTTP_NOT_FOUND, CSI_MESSAGES, errorStatus } from '../lib/csiForm';
import { clearDraft, draftKey } from '../lib/surveyDraft';
import { BackLink, CsiStatusScreen, CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { SurveyFlow } from '../components/respond/SurveyFlow';
import type { CsiOpenForm } from '../types';

const SKELETON_CARDS = 3;
const THANK_YOU_TITLE = 'Terima kasih!';

function SurveySkeleton() {
    return (
        <div className="mx-auto max-w-2xl space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Memuat survei">
            <div className="h-8 w-2/3 rounded-xl bg-muted" />
            <div className="h-4 w-full rounded bg-muted/60" />
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className={`${CSI_CARD} h-40`} />)}
        </div>
    );
}

/** The server is the authority: once it reports the survey as answered or ended (410), the local draft is obsolete. */
function useClearDraftWhen(done: boolean, userId: string, periodId: string) {
    useEffect(() => {
        if (done && userId) clearDraft(draftKey(userId, periodId));
    }, [done, userId, periodId]);
}

function SurveyForm({ form, basePath, userId }: { form: CsiOpenForm; basePath: string; userId: string }) {
    const submit = useSubmitCsi(form.id);
    const status = errorStatus(submit.error);
    useClearDraftWhen(submit.isSuccess || status === CSI_HTTP_CONFLICT || status === CSI_HTTP_GONE, userId, form.id);

    if (submit.isSuccess) {
        return <CsiStatusScreen tone="success" title={THANK_YOU_TITLE} message={submit.data.thankYou} backTo={basePath} />;
    }
    if (status === CSI_HTTP_CONFLICT) {
        return <CsiStatusScreen tone="success" title={CSI_MESSAGES.alreadySubmitted} backTo={basePath} />;
    }
    if (status === CSI_HTTP_GONE) {
        return <CsiStatusScreen tone="warning" title={CSI_MESSAGES.ended} backTo={basePath} />;
    }
    if (status === CSI_HTTP_NOT_FOUND) {
        return <CsiStatusScreen tone="muted" title={CSI_MESSAGES.notFound} backTo={basePath} />;
    }
    return (
        <div className="mx-auto max-w-2xl">
            <FadeIn className="mb-4 pt-1"><BackLink to={basePath} /></FadeIn>
            <SurveyFlow form={form} userId={userId} onSubmit={(payload) => submit.mutate(payload)}
                submitting={submit.isPending} error={submit.error} />
        </div>
    );
}

export function CsiSurveyPage() {
    const { id = '' } = useParams<{ id: string }>();
    const basePath = useCsiBasePath();
    const userId = useAuth((state) => state.user?.id ?? '');
    const { data: form, error, isLoading, refetch } = useCsiForm(id);
    useClearDraftWhen(Boolean(form?.submitted) || errorStatus(error) === CSI_HTTP_GONE, userId, id);

    if (isLoading) return <SurveySkeleton />;
    if (error || !form) {
        const status = errorStatus(error);
        if (status === CSI_HTTP_GONE) return <CsiStatusScreen tone="warning" title={CSI_MESSAGES.ended} backTo={basePath} />;
        if (status === CSI_HTTP_NOT_FOUND || !error) return <CsiStatusScreen tone="muted" title={CSI_MESSAGES.notFound} backTo={basePath} />;
        return <ErrorState title="Gagal memuat survei" message="Terjadi kendala saat memuat survei. Silakan coba lagi." onRetry={() => refetch()} />;
    }
    if (form.submitted) {
        return <CsiStatusScreen tone="success" title={form.title} message={form.thankYou} backTo={basePath} />;
    }
    return <SurveyForm key={form.id} form={form} basePath={basePath} userId={userId} />;
}

export default CsiSurveyPage;
