import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiTemplates } from '../../../../hooks/useCsiHc';
import { isRaterAdditionOpen } from '../../../../lib/csiAdmin';
import { errorMessage } from '../../../../lib/csiForm';
import { isHcDecided } from '../../../../lib/hcMode';
import type { CsiTemplateApplyManyReport } from '../../../../hcTypes';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../../types';
import { LocationStep, PreviewStep, selectedTemplateIds } from './HcSurveyWizardSteps';

const FAILED = 'Gagal memproses template.';
const ALERT_RED = 'rounded-xl bg-[hsl(var(--ticket-red)/.12)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-red-ink))]';
const NOTE_AMBER = 'flex items-start gap-2 rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]';
const NOTE_SAFE = 'rounded-xl bg-[hsl(var(--idesk-sapphire)/.08)] px-3 py-2 text-[12.5px] text-[hsl(var(--idesk-text-secondary))]';

/**
 * "Ambil dari template": tick locations (only those with a template), auto-preview what the templates add, then Terapkan
 * (add-only sync of PICs, raters and pairs; safe on active answered surveys). People picked from user accounts (no PIC)
 * are not reported in HC; before answers exist, the admin may confirm replacing them with template PICs.
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
    const effectiveReplace = !period.locked && replace;
    const requestKey = `${templateIds.join(',')}|${effectiveReplace}`;
    const previewKeyRef = useRef<string | null>(null);

    const run = async (commit: boolean, replaceNonPic: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const result = await CsiHcApi.applyTemplates(scope, period.id, { templateIds, replaceNonPic }, commit);
            setReport(result);
            if (commit) {
                await client.invalidateQueries({ queryKey: ['csi', scope] });
                toast.success('Template disinkronkan ke survei tanpa mengubah jawaban lama.');
            }
        } catch (caught) {
            setError(errorMessage(caught) ?? FAILED);
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (!open) {
            previewKeyRef.current = null;
            return;
        }
        if (!templateIds.length || previewKeyRef.current === requestKey) return;
        previewKeyRef.current = requestKey;
        void run(false, effectiveReplace);
    });

    const toggle = (code: string, checked: boolean) => {
        setPicked((current) => checked ? [...current, code] : current.filter((row) => row !== code));
        setReport(null);
        setError(null);
        setReplace(false);
        previewKeyRef.current = null;
    };
    const refreshPreview = () => {
        previewKeyRef.current = requestKey;
        void run(false, effectiveReplace);
    };
    const confirmReplace = (checked: boolean) => {
        setReplace(checked);
        setReport(null);
        previewKeyRef.current = null;
    };
    const hasChanges = !!report && (report.picsAdded + report.teamsAdded + report.ratersAdded + report.pairsAdded > 0 || Boolean(report.siteAdded));
    const canApply = !!report && !report.committed && !report.blockedReason && hasChanges && (period.locked || nonPic === 0 || effectiveReplace);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Ambil dari template</DialogTitle>
                    <DialogDescription>
                        {period.locked
                            ? 'Mode tambah-saja (survei sudah berjalan): hanya menambahkan PIC, penilai, dan pasangan baru dari template yang belum ada.'
                            : 'PIC, penilai dan pasangan dari template lokasi yang dipilih ditambahkan ke survei ini.'}
                    </DialogDescription>
                </DialogHeader>
                {period.locked && (
                    <p className={NOTE_SAFE}>
                        Aman untuk survei berjalan: data dan jawaban yang sudah masuk tidak dihapus atau diubah. Penilai yang sudah mengisi akan otomatis diminta menilai PIC baru yang belum mereka nilai.
                    </p>
                )}
                <LocationStep templates={templates} selected={locations} onToggle={toggle} />
                <Button variant="soft" className="justify-self-start" disabled={!templateIds.length || busy} onClick={refreshPreview}>Pratinjau</Button>
                {busy && !report && <PreviewStep report={undefined} loading failed={false} />}
                {report && <PreviewStep report={report} loading={false} failed={false} />}
                {report && !report.blockedReason && !hasChanges && !report.committed && (
                    <p className={NOTE_SAFE}>Semua PIC dan penilai dari lokasi terpilih sudah sinkron dengan survei ini.</p>
                )}
                {report?.committed && <p className="text-[13.5px] font-semibold">Tersimpan.</p>}
                {!period.locked && report && nonPic > 0 && !report.committed && (
                    <label className={NOTE_AMBER}>
                        <Checkbox checked={effectiveReplace} disabled={busy} onCheckedChange={(state) => confirmReplace(state === true)} className="mt-0.5" />
                        <span>{`Ganti ${nonPic} orang non-PIC dengan PIC dari template. Mereka dipilih dari akun user, tidak masuk report layanan, dan akan dihapus beserta pasangannya, termasuk penilai yang hanya menilai mereka.`}</span>
                    </label>
                )}
                {error && <p role="alert" className={ALERT_RED}>{error}</p>}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button variant="primary" disabled={!canApply || busy} onClick={() => void run(true, effectiveReplace && nonPic > 0)}>Terapkan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** The "Ambil dari template" button with its dialog (add-only sync allowed on active surveys with answers). */
export function TemplatePullButton({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const [open, setOpen] = useState(false);
    const allowed = !period.locked || (isRaterAdditionOpen(period) && isHcDecided(scope, period));
    if (!allowed) return null;
    return (
        <>
            <Button variant="soft" onClick={() => setOpen(true)}><Download aria-hidden="true" />Ambil dari template</Button>
            {open && <TemplatePullDialog scope={scope} period={period} open onOpenChange={setOpen} />}
        </>
    );
}
