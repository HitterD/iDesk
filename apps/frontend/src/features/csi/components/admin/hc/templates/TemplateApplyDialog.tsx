import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiPeriods } from '../../../../hooks/useCsi';
import { CSI_SURVEY_STATE_LABELS, surveyState } from '../../../../lib/csiAdmin';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { FIELD, OutsideSitesNote, SkippedLists, UnconfirmedNote, WithoutRatersNote } from './HcSurveyWizardSteps';

function ReportView({ report }: { report: CsiTemplateApplyReport }) {
    if (report.blockedReason) {
        return <p role="alert" className="rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]">{report.blockedReason}</p>;
    }
    const emptyDiff = report.picsAdded + report.teamsAdded + report.ratersAdded + report.pairsAdded === 0 && !report.siteAdded && !report.committed;
    return (
        <div className="grid gap-2">
            <p className="text-[13.5px] font-semibold">
                {`${report.picsAdded} PIC baru · ${report.ratersAdded} penilai baru · ${report.pairsAdded} pasangan baru`}
                {report.committed && ' — tersimpan'}
            </p>
            {emptyDiff && (
                <p className="rounded-xl bg-[hsl(var(--idesk-sapphire)/.08)] px-3 py-2 text-[12.5px] text-[hsl(var(--idesk-text-secondary))]">
                    Survei ini sudah sinkron dengan template lokasi ini (tidak ada PIC atau penilai baru yang perlu ditambahkan).
                </p>
            )}
            {report.siteAdded && (
                <p className="rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[13px]">
                    {report.committed ? `Site ${report.siteAdded} ditambahkan ke survei ini.` : `Site ${report.siteAdded} akan ditambahkan ke survei ini.`}
                </p>
            )}
            <UnconfirmedNote count={report.ratersUnconfirmed} />
            <OutsideSitesNote names={report.ratersOutsideSites} />
            <WithoutRatersNote names={report.picsWithoutRaters} />
            <SkippedLists report={report} />
        </div>
    );
}

/**
 * "Gunakan template": add-only sync into an existing HC survey (auto-previews selected survey, then Terapkan;
 * nothing is removed and the template's site joins the survey). A new survey is built by the multi-location wizard (onNewSurvey).
 */
export function TemplateApplyDialog({ scope, template, open, onOpenChange, onNewSurvey, initialPeriodId = '' }: {
    scope: CsiScopeParam; template: CsiTemplate; open: boolean; onOpenChange: (open: boolean) => void;
    onNewSurvey: () => void; initialPeriodId?: string;
}) {
    const { data: periods = [] } = useCsiPeriods(scope);
    const [periodId, setPeriodId] = useState(initialPeriodId);
    const [report, setReport] = useState<CsiTemplateApplyReport | null>(null);
    const [busy, setBusy] = useState(false);
    const previewKeyRef = useRef<string | null>(null);
    const client = useQueryClient();
    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        try { await work(); } catch { toast.error('Gagal memproses template.'); } finally { setBusy(false); }
    };
    const preview = () => {
        if (!periodId) return;
        previewKeyRef.current = periodId;
        void run(async () => setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, false)));
    };
    useEffect(() => {
        if (!open) { previewKeyRef.current = null; return; }
        if (!periodId || previewKeyRef.current === periodId) return;
        previewKeyRef.current = periodId;
        void run(async () => setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, false)));
    });
    const apply = () => run(async () => {
        setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, true));
        // Survey lists, details and the template counts all changed.
        await client.invalidateQueries({ queryKey: ['csi', scope] });
        toast.success('Template disinkronkan ke survei tanpa mengubah jawaban lama.');
    });
    const hasChanges = !!report && (report.picsAdded + report.teamsAdded + report.ratersAdded + report.pairsAdded > 0 || Boolean(report.siteAdded));
    // After a successful apply the button stays off until another preview.
    const canApply = !!report && !report.committed && !report.blockedReason && hasChanges;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{`Gunakan template ${template.name}`}</DialogTitle>
                    <DialogDescription>Mode tambah-saja (aman untuk survei berjalan): hanya menambah PIC, penilai dan pasangan yang belum ada; jawaban existing tidak dihapus atau diubah.</DialogDescription>
                </DialogHeader>
                {!initialPeriodId && <Button variant="soft" className="justify-self-start" onClick={onNewSurvey}>Buat survei baru…</Button>}
                <p className="text-[13.5px] font-semibold">Masukkan ke survei existing (Sinkronkan)</p>
                <div className="flex gap-2">
                    <select aria-label="Survei" className={FIELD} value={periodId} onChange={(event) => {
                        setPeriodId(event.target.value);
                        setReport(null);
                        previewKeyRef.current = null;
                    }}>
                        <option value="">Pilih survei HC…</option>
                        {periods.map((period) => {
                            const state = period.publishStatus && period.status ? CSI_SURVEY_STATE_LABELS[surveyState(period)] : null;
                            return <option key={period.id} value={period.id}>{state ? `${period.title} (${state})` : period.title}</option>;
                        })}
                    </select>
                    <Button variant="soft" disabled={!periodId || busy} onClick={preview}>Pratinjau</Button>
                </div>
                {report && <ReportView report={report} />}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button variant="primary" disabled={!canApply || busy} onClick={apply}>Terapkan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
