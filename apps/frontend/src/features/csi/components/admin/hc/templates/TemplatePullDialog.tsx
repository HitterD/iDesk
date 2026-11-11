import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiTemplates } from '../../../../hooks/useCsiHc';
import { errorMessage } from '../../../../lib/csiForm';
import type { CsiTemplateApplyManyReport } from '../../../../hcTypes';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../../types';
import { LocationStep, PreviewStep, selectedTemplateIds } from './HcSurveyWizardSteps';

const FAILED = 'Gagal memproses template.';
const ALERT_RED = 'rounded-xl bg-[hsl(var(--ticket-red)/.12)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-red-ink))]';
const NOTE_AMBER = 'flex items-start gap-2 rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]';

/**
 * "Ambil dari template" in an HC survey without answers: tick locations (only those with a template), preview what the
 * templates add, then Terapkan (add-only sync of PICs, raters and pairs). People picked from user accounts (no PIC) are
 * not reported in HC; when the survey has some, the admin must confirm they are replaced by the template's PICs.
 */
export function TemplatePullDialog({ scope, period, open, onOpenChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const { data } = useCsiTemplates(scope);
    const templates = data?.templates ?? [];
    const surveySites = period.sites.map((site) => site.code);
    const [picked, setPicked] = useState<string[]>(() => surveySites.filter((code): code is string => !!code));
    const [replace, setReplace] = useState(false);
    const [report, setReport] = useState<CsiTemplateApplyManyReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const client = useQueryClient();
    const locations = picked.filter((code) => templates.some((row) => row.locationCode === code));
    const templateIds = selectedTemplateIds(templates, locations);
    const nonPic = report?.nonPicRatees ?? 0;

    const run = async (commit: boolean, replaceNonPic: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const result = await CsiHcApi.applyTemplates(scope, period.id, { templateIds, replaceNonPic }, commit);
            setReport(result);
            if (commit) {
                await client.invalidateQueries({ queryKey: ['csi', scope] });
                toast.success('Template diterapkan ke survei.');
            }
        } catch (caught) {
            setError(errorMessage(caught) ?? FAILED);
        } finally {
            setBusy(false);
        }
    };
    const toggle = (code: string, checked: boolean) => {
        setPicked((current) => checked ? [...current, code] : current.filter((row) => row !== code));
        setReport(null);
        setReplace(false);
    };
    // The preview is re-run with the replacement so its numbers match what Terapkan will do.
    const confirmReplace = (checked: boolean) => { setReplace(checked); void run(false, checked); };
    const canApply = !!report && !report.committed && !report.blockedReason && (nonPic === 0 || replace);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Ambil dari template</DialogTitle>
                    <DialogDescription>PIC, penilai dan pasangan dari template lokasi yang dipilih ditambahkan ke survei ini.</DialogDescription>
                </DialogHeader>
                <LocationStep templates={templates} selected={locations} onToggle={toggle} />
                <Button variant="soft" className="justify-self-start" disabled={!templateIds.length || busy} onClick={() => void run(false, replace)}>Pratinjau</Button>
                {report && <PreviewStep report={report} loading={false} failed={false} />}
                {report?.committed && <p className="text-[13.5px] font-semibold">Tersimpan.</p>}
                {report && nonPic > 0 && !report.committed && (
                    <label className={NOTE_AMBER}>
                        <Checkbox checked={replace} disabled={busy} onCheckedChange={(state) => confirmReplace(state === true)} className="mt-0.5" />
                        <span>{`Ganti ${nonPic} orang non-PIC dengan PIC dari template. Mereka dipilih dari akun user, tidak masuk report HC, dan akan dihapus beserta pasangannya.`}</span>
                    </label>
                )}
                {error && <p role="alert" className={ALERT_RED}>{error}</p>}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button variant="primary" disabled={!canApply || busy} onClick={() => void run(true, replace && nonPic > 0)}>Terapkan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** The "Ambil dari template" button with its dialog (HC decides who rates whom, survey without answers). */
export function TemplatePullButton({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const [open, setOpen] = useState(false);
    if (period.locked) return null;
    return (
        <>
            <Button variant="soft" onClick={() => setOpen(true)}><Download aria-hidden="true" />Ambil dari template</Button>
            {open && <TemplatePullDialog scope={scope} period={period} open onOpenChange={setOpen} />}
        </>
    );
}
