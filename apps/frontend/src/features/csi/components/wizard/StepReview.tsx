import { useState } from 'react';
import { Eye, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePublishCsiPeriod } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { CSI_HTTP_CONFLICT, errorMessage, errorStatus } from '../../lib/csiForm';
import { formatDateRange } from '../../lib/format';
import { formatSiteNames } from '../../lib/location';
import type { WizardStepKey } from '../../lib/wizard';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { AdminSection, MUTED_TEXT } from '../admin/AdminParts';
import { ReadinessList } from './ReadinessList';
import { SurveyPreview } from './SurveyPreview';
import { STEP_TITLES, WIZARD_COPY } from './wizardCopy';

const sectionsLabel = (period: CsiPeriodDetail) =>
    [period.teamEnabled && 'Tim', period.individualEnabled && 'Per orang'].filter(Boolean).join(' & ');

function Summary({ period }: { period: CsiPeriodDetail }) {
    const rows: Array<[string, string]> = [
        ['Judul', period.title],
        ['Site', formatSiteNames(period.sites)],
        ['Tanggal', formatDateRange(period.startDate, period.endDate)],
        ['Mode responden', CSI_MODE_LABELS[period.respondentMode]],
        ['Bagian', sectionsLabel(period)],
        ['Target SLA', `${period.slaTargetPct}%`],
        ...(period.individualEnabled ? [['Orang yang dinilai', `${period.ratees.filter((ratee) => ratee.kind === 'PERSON').length} orang`] as [string, string]] : []),
        ...(period.respondentMode === 'LISTED' ? [['Penilai', `${period.raters.length} penilai`] as [string, string]] : []),
    ];
    return (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className={cn(MUTED_TEXT, 'text-[12px]')}>{label}</dt>
                    <dd className="truncate text-[14px] font-medium">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

interface StepReviewProps {
    scope: CsiScopeParam;
    period: CsiPeriodDetail;
    onEditStep: (step: WizardStepKey) => void;
    onPublished: (periodId: string) => void;
}

export function StepReview({ scope, period, onEditStep, onPublished }: StepReviewProps) {
    const [previewing, setPreviewing] = useState(false);
    const publish = usePublishCsiPeriod(scope, period.id);
    const published = period.publishStatus === 'PUBLISHED';
    const submit = () => publish.mutate(undefined, {
        onSuccess: () => { toast.success(WIZARD_COPY.published); onPublished(period.id); },
    });
    // The server names the clashing survey (409); show it next to the button, with the way to fix it.
    const publishError = errorStatus(publish.error) === CSI_HTTP_CONFLICT ? errorMessage(publish.error) ?? null : null;

    return (
        <div className="grid gap-5">
            <AdminSection title={STEP_TITLES.review} description="Periksa kelengkapan sebelum survei tampil ke responden.">
                <Summary period={period} />
            </AdminSection>
            <AdminSection title={WIZARD_COPY.readinessTitle}>
                <ReadinessList readiness={period.readiness} onEdit={onEditStep} published={published} />
                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                    <Button variant="soft" onClick={() => setPreviewing(true)}><Eye aria-hidden="true" />{WIZARD_COPY.preview}</Button>
                    {published
                        ? <Button variant="primary" onClick={() => onPublished(period.id)}>{WIZARD_COPY.toDetail}</Button>
                        : (
                            <Button variant="primary" onClick={submit} loading={publish.isPending} disabled={!period.readiness.ready}>
                                <Send aria-hidden="true" />{WIZARD_COPY.publish}
                            </Button>
                        )}
                </div>
                {published && <p className={cn(MUTED_TEXT, 'mt-2 text-right')}>{WIZARD_COPY.alreadyPublished}</p>}
                {publishError && (
                    <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[hsl(var(--ticket-red)/.1)] px-3.5 py-3 text-[13px] font-medium text-[hsl(var(--ticket-red-ink))]">
                        <span className="min-w-0 flex-1">{publishError}</span>
                        <Button variant="soft" size="sm" onClick={() => onEditStep('info')}>Ubah tanggal / site</Button>
                    </div>
                )}
            </AdminSection>
            <SurveyPreview open={previewing} onOpenChange={setPreviewing} period={period} />
        </div>
    );
}
