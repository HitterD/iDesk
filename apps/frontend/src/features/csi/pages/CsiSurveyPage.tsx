import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/stores/useAuth';
import { useCsiForm, useSubmitCsi } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import { CSI_HTTP_GONE, CSI_HTTP_NOT_FOUND, CSI_MESSAGES, errorStatus } from '../lib/csiForm';
import { clearDraft, draftKey } from '../lib/surveyDraft';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackLink, CsiStatusScreen, CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { RESPOND_COPY } from '../components/respond/respondCopy';
import { SurveyFlow } from '../components/respond/SurveyFlow';
import type { CsiOpenForm } from '../types';

const SKELETON_CARDS = 3;
const PAGE_WIDTH = 'mx-auto max-w-5xl';

function SurveySkeleton() {
    return (
        <div className="mx-auto max-w-5xl space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Memuat survei">
            <div className="h-8 w-2/3 rounded-xl bg-muted" />
            <div className="h-4 w-full rounded bg-muted/60" />
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className={`${CSI_CARD} h-40`} />)}
        </div>
    );
}

/** The server is the authority: after a successful submit or an ended period (410) the local draft is obsolete; a 409 keeps it. */
function useClearDraftWhen(done: boolean, userId: string, periodId: string) {
    useEffect(() => {
        if (done && userId) clearDraft(draftKey(userId, periodId));
    }, [done, userId, periodId]);
}

function ThankYou({ message, basePath, onFillAgain }: { message: string; basePath: string; onFillAgain: () => void }) {
    return (
        <FadeIn className={cn(CSI_CARD, 'mx-auto max-w-xl px-6 py-12 text-center sm:px-10 sm:py-16')}>
            <div role="status" className="flex flex-col items-center">
                <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{RESPOND_COPY.thankYouTitle}</h1>
                {message && <p className="mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{message}</p>}
                <div className="mt-8 flex flex-col items-center gap-4">
                    <Button type="button" size="lg" onClick={onFillAgain}>{RESPOND_COPY.fillAgain}</Button>
                    <Link to={basePath} className="idesk-text-link">{RESPOND_COPY.backToList}</Link>
                </div>
            </div>
        </FadeIn>
    );
}

function SurveyForm({ form, basePath, userId }: { form: CsiOpenForm; basePath: string; userId: string }) {
    const submit = useSubmitCsi(form.id);
    // Bumping `round` remounts the flow empty; the department of the last submission carries over.
    const [round, setRound] = useState({ count: 0, departmentId: '' });
    const [lastDepartment, setLastDepartment] = useState('');
    const status = errorStatus(submit.error);
    useClearDraftWhen(submit.isSuccess || status === CSI_HTTP_GONE, userId, form.id);

    if (submit.isSuccess) {
        const fillAgain = () => {
            clearDraft(draftKey(userId, form.id));
            submit.reset();
            setRound((previous) => ({ count: previous.count + 1, departmentId: lastDepartment }));
        };
        return <ThankYou message={submit.data.thankYou} basePath={basePath} onFillAgain={fillAgain} />;
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
            <SurveyFlow key={round.count} form={form} userId={userId} fresh={round.count ? { departmentId: round.departmentId } : undefined}
                onSubmit={(payload) => { setLastDepartment(payload.departmentId); submit.mutate(payload); }}
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
    return <SurveyForm key={form.id} form={form} basePath={basePath} userId={userId} />;
}

export default CsiSurveyPage;
