import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiPeriods } from '../../../../hooks/useCsi';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { FIELD, OutsideSitesNote, SkippedLists, UnconfirmedNote } from './HcSurveyWizardSteps';

function ReportView({ report }: { report: CsiTemplateApplyReport }) {
    if (report.blockedReason) {
        return <p role="alert" className="rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[13px] text-[hsl(var(--ticket-amber-ink))]">{report.blockedReason}</p>;
    }
    return (
        <div className="grid gap-2">
            <p className="text-[13.5px] font-semibold">
                {`${report.picsAdded} PIC baru · ${report.ratersAdded} penilai baru · ${report.pairsAdded} pasangan baru`}
                {report.committed && ' — tersimpan'}
            </p>
            {report.siteAdded && (
                <p className="rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[13px]">
                    {report.committed ? `Site ${report.siteAdded} ditambahkan ke survei ini.` : `Site ${report.siteAdded} akan ditambahkan ke survei ini.`}
                </p>
            )}
            <UnconfirmedNote count={report.ratersUnconfirmed} />
            <OutsideSitesNote names={report.ratersOutsideSites} />
            <SkippedLists report={report} />
        </div>
    );
}

/**
 * "Gunakan template": add-only sync into an existing HC survey (preview first, then Terapkan; nothing is removed and the
 * template's site joins the survey). A new survey is built by the multi-location wizard instead (onNewSurvey).
 */
export function TemplateApplyDialog({ scope, template, open, onOpenChange, onNewSurvey }: {
    scope: CsiScopeParam; template: CsiTemplate; open: boolean; onOpenChange: (open: boolean) => void; onNewSurvey: () => void;
}) {
    const { data: periods = [] } = useCsiPeriods(scope);
    const [periodId, setPeriodId] = useState('');
    const [report, setReport] = useState<CsiTemplateApplyReport | null>(null);
    const [busy, setBusy] = useState(false);
    const client = useQueryClient();
    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        try { await work(); } catch { toast.error('Gagal memproses template.'); } finally { setBusy(false); }
    };
    const preview = () => run(async () => setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, false)));
    const apply = () => run(async () => {
        setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, true));
        // Survey lists, details and the template counts all changed.
        await client.invalidateQueries({ queryKey: ['csi', scope] });
        toast.success('Template disinkronkan ke survei.');
    });
    // After a successful apply the button stays off until another preview.
    const canApply = !!report && !report.committed && !report.blockedReason;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{`Gunakan template ${template.name}`}</DialogTitle>
                    <DialogDescription>Hanya menambah PIC, penilai dan pasangan; tidak ada yang dihapus dari survei.</DialogDescription>
                </DialogHeader>
                <Button variant="soft" className="justify-self-start" onClick={onNewSurvey}>Buat survei baru…</Button>
                <p className="text-[13.5px] font-semibold">Masukkan ke survei existing (Sinkronkan)</p>
                <div className="flex gap-2">
                    <select aria-label="Survei" className={FIELD} value={periodId} onChange={(event) => { setPeriodId(event.target.value); setReport(null); }}>
                        <option value="">Pilih survei HC…</option>
                        {periods.map((period) => <option key={period.id} value={period.id}>{period.title}</option>)}
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
