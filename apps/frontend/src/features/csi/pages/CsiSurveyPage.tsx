import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { useCsiForm, useSubmitCsi } from '../hooks/useCsi';
import { useCsiBasePath } from '../lib/useCsiBasePath';
import {
    buildSubmitPayload, countDimensions, countRated, CSI_HTTP_CONFLICT, CSI_HTTP_GONE, CSI_HTTP_NOT_FOUND,
    CSI_MESSAGES, errorMessage, errorStatus, type CsiComments, type CsiScores,
} from '../lib/csiForm';
import {
    BackLink, ConfirmSheet, CsiProgress, CsiStatusScreen, CSI_CARD, FadeIn, IdentityCard, RateeCard,
} from '../components/CsiSurveyParts';
import type { CsiOpenForm } from '../types';

const SKELETON_CARDS = 3;
const THANK_YOU_TITLE = 'Terima kasih!';

function SurveySkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Memuat survei">
            <div className="h-8 w-2/3 rounded-xl bg-muted" />
            <div className="h-4 w-full rounded bg-muted/60" />
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <div key={index} className={`${CSI_CARD} h-40`} />)}
        </div>
    );
}

function SurveyForm({ form, basePath }: { form: CsiOpenForm; basePath: string }) {
    const submit = useSubmitCsi(form.id);
    const [departmentId, setDepartmentId] = useState('');
    const [scores, setScores] = useState<CsiScores>({});
    const [comments, setComments] = useState<CsiComments>({});
    const [confirmOpen, setConfirmOpen] = useState(false);

    const total = countDimensions(form);
    const rated = countRated(form, scores);
    const complete = Boolean(departmentId) && rated === total;

    if (submit.isSuccess) {
        return <CsiStatusScreen tone="success" title={THANK_YOU_TITLE} message={submit.data.thankYou} backTo={basePath} />;
    }
    const status = errorStatus(submit.error);
    if (status === CSI_HTTP_CONFLICT) {
        return <CsiStatusScreen tone="success" title={CSI_MESSAGES.alreadySubmitted} backTo={basePath} />;
    }
    if (status === CSI_HTTP_GONE) {
        return <CsiStatusScreen tone="warning" title={CSI_MESSAGES.ended} backTo={basePath} />;
    }
    if (status === CSI_HTTP_NOT_FOUND) {
        return <CsiStatusScreen tone="muted" title={CSI_MESSAGES.notFound} backTo={basePath} />;
    }

    const handleSubmit = () => {
        submit.mutate(buildSubmitPayload(form, departmentId, scores, comments), { onSettled: () => setConfirmOpen(false) });
    };
    const failure = submit.isError ? (errorMessage(submit.error) ?? CSI_MESSAGES.submitFailed) : null;

    return (
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
            <FadeIn className="space-y-3 pt-1">
                <BackLink to={basePath} />
                <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-foreground">{form.title}</h1>
                {form.intro && <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{form.intro}</p>}
            </FadeIn>

            <CsiProgress rated={rated} total={total} />

            <FadeIn index={1}>
                <IdentityCard form={form} departmentId={departmentId} onDepartmentChange={setDepartmentId} />
            </FadeIn>

            {form.ratees.map((ratee, index) => (
                <FadeIn key={ratee.periodRateeId} index={index + 2}>
                    <RateeCard ratee={ratee} scores={scores} comment={comments[ratee.periodRateeId] ?? ''}
                        onScore={(dimensionId, score) => setScores((previous) => ({ ...previous, [dimensionId]: score }))}
                        onComment={(text) => setComments((previous) => ({ ...previous, [ratee.periodRateeId]: text }))} />
                </FadeIn>
            ))}

            {failure && (
                <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{failure}
                </p>
            )}

            <div className="flex flex-col items-stretch gap-2 pb-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                {!complete && (
                    <p className="text-[13px] text-muted-foreground sm:order-first sm:mr-auto">
                        Pilih departemen dan isi semua bintang untuk melanjutkan.
                    </p>
                )}
                <button type="button" className="idesk-cta ct-submit justify-center" disabled={!complete} onClick={() => setConfirmOpen(true)}>
                    Tinjau &amp; Kirim
                </button>
            </div>

            <ConfirmSheet open={confirmOpen} onOpenChange={setConfirmOpen} form={form} scores={scores}
                submitting={submit.isPending} onSubmit={handleSubmit} />
        </div>
    );
}

export function CsiSurveyPage() {
    const { id = '' } = useParams<{ id: string }>();
    const basePath = useCsiBasePath();
    const { data: form, error, isLoading, refetch } = useCsiForm(id);

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
    return <SurveyForm key={form.id} form={form} basePath={basePath} />;
}

export default CsiSurveyPage;
