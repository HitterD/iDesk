import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreatePeriodFromTemplates, useCsiTemplates, usePreviewPeriod } from '../../../../hooks/useCsiHc';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { MUTED_TEXT } from '../../AdminParts';
import { CSI_TEMPLATE_LOCATIONS } from '../hcFormat';
import { InfoStep, LocationStep, PreviewStep, StepIndicator, infoComplete, type SurveyInfo } from './HcSurveyWizardSteps';

const STEP_INFO = 0;
const STEP_LOCATIONS = 1;
const STEP_PREVIEW = 2;
const STEP_CREATE = 3;
const NO_IDS: string[] = [];

/** Template ids in the fixed location order, so the request (and the preview cache key) is stable. */
function selectedTemplateIds(templates: CsiTemplate[], locations: string[]) {
    return CSI_TEMPLATE_LOCATIONS.flatMap(({ code }) => locations.includes(code) ? templates.filter((row) => row.locationCode === code).map((row) => row.id) : []);
}

function CreateStep({ info, locations, report }: { info: SurveyInfo; locations: string[]; report: CsiTemplateApplyReport | null }) {
    const names = CSI_TEMPLATE_LOCATIONS.filter(({ code }) => locations.includes(code)).map(({ name }) => name).join(', ');
    return (
        <div className="grid gap-1.5 text-[13.5px]">
            <p className="font-semibold">{info.title}</p>
            <p className={MUTED_TEXT}>{`${info.startDate} s.d. ${info.endDate} · ${names}`}</p>
            {report?.committed && (
                <p className="font-semibold">{`Survei dibuat (draft): ${report.picsAdded + report.teamsAdded} PIC/tim · ${report.ratersAdded} penilai · ${report.pairsAdded} pasangan.`}</p>
            )}
        </div>
    );
}

/**
 * HC "Buat survei": name & period → locations (only those with a template) → preview of what the templates add and skip
 * → create one draft survey from all checked templates. Raters who appear in several locations count once.
 */
export function HcSurveyWizard({ scope, open, onOpenChange, initialLocation }: {
    scope: CsiScopeParam; open: boolean; onOpenChange: (open: boolean) => void;
    /** Location tab the wizard was opened from; preselected when it has a template. */
    initialLocation?: string;
}) {
    const { data } = useCsiTemplates(scope);
    const templates = data?.templates ?? [];
    const [step, setStep] = useState(STEP_INFO);
    const [info, setInfo] = useState<SurveyInfo>({ title: `CSI HC ${new Date().getFullYear()}`, startDate: '', endDate: '' });
    const [picked, setPicked] = useState<string[]>(initialLocation ? [initialLocation] : []);
    const [created, setCreated] = useState<CsiTemplateApplyReport | null>(null);
    // Locations without a template cannot be picked; a preselected empty tab simply drops out.
    const locations = picked.filter((code) => templates.some((row) => row.locationCode === code));
    const templateIds = selectedTemplateIds(templates, locations);
    // Preview only once the admin reaches that step, not on every checkbox click.
    const preview = usePreviewPeriod(scope, step >= STEP_PREVIEW ? templateIds : NO_IDS);
    const create = useCreatePeriodFromTemplates(scope);
    const toggle = (code: string, checked: boolean) => setPicked((current) => checked ? [...current, code] : current.filter((row) => row !== code));
    const submit = () => create.mutate({ ...info, title: info.title.trim(), templateIds }, {
        onSuccess: (result) => { setCreated(result.report); toast.success('Survei dibuat'); },
        onError: () => toast.error('Gagal membuat survei.'),
    });
    const canNext = [
        infoComplete(info),
        templateIds.length > 0,
        !!preview.data && !preview.data.blockedReason,
    ][step] ?? false;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Buat survei HC</DialogTitle>
                    <DialogDescription>Survei HC dibuat dari template penugasan lokasi yang dipilih.</DialogDescription>
                </DialogHeader>
                <StepIndicator step={step} />
                {step === STEP_INFO && <InfoStep info={info} onChange={setInfo} />}
                {step === STEP_LOCATIONS && <LocationStep templates={templates} selected={locations} onToggle={toggle} />}
                {step === STEP_PREVIEW && <PreviewStep report={preview.data} loading={preview.isLoading} failed={preview.isError} />}
                {step === STEP_CREATE && <CreateStep info={info} locations={locations} report={created} />}
                <DialogFooter>
                    {step > STEP_INFO && !created && <Button variant="ghost" onClick={() => setStep(step - 1)}>Kembali</Button>}
                    {step < STEP_CREATE
                        ? <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Lanjut</Button>
                        // After success the button stays off: a second click would build a second survey.
                        : <Button variant="primary" disabled={!!created || create.isPending} onClick={submit}>Buat survei</Button>}
                    {created && <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
