import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CsiHcApi } from '../../../../api/csiHc.api';
import { useCsiPeriods } from '../../../../hooks/useCsi';
import type { CsiTemplate, CsiTemplateApplyReport } from '../../../../hcTypes';
import type { CsiScopeParam } from '../../../../types';
import { titleCase } from '../hcFormat';

type Mode = 'new' | 'existing';
const FIELD = 'h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px]';

function NameList({ title, names }: { title: string; names: string[] }) {
    if (!names.length) return null;
    return (
        <details className="rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[12.5px]" open={names.length <= 6}>
            <summary className="cursor-pointer font-semibold">{`${title} (${names.length})`}</summary>
            <p className="mt-1 text-muted-foreground">{names.map(titleCase).join(', ')}</p>
        </details>
    );
}

function ReportView({ report }: { report: CsiTemplateApplyReport }) {
    return (
        <div className="grid gap-2">
            <p className="text-[13.5px] font-semibold">
                {`${report.picsAdded} PIC baru · ${report.ratersAdded} penilai baru · ${report.pairsAdded} pasangan baru`}
                {report.committed && ' — tersimpan'}
            </p>
            <NameList title="PIC dilewati (belum ada penilai)" names={report.picsSkippedNoRaters} />
            <NameList title="PIC belum cocok dengan PIC master" names={report.picsUnmatched} />
            <NameList title="Penilai belum punya akun (masuk saat Sinkronkan berikutnya)" names={report.ratersNoAccount} />
            <NameList title="Penilai dengan nama ganda (perbaiki di template)" names={report.ratersAmbiguous} />
        </div>
    );
}

/**
 * "Gunakan template": a new draft survey for the template's location, or an add-only sync into an existing HC survey
 * (preview first, then Terapkan). Nothing in the survey is removed.
 */
export function TemplateApplyDialog({ scope, template, open, onOpenChange }: {
    scope: CsiScopeParam; template: CsiTemplate; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const { data: periods = [] } = useCsiPeriods(scope);
    const [mode, setMode] = useState<Mode>('new');
    const [periodId, setPeriodId] = useState('');
    const [form, setForm] = useState({ title: template.name, startDate: '', endDate: '' });
    const [report, setReport] = useState<CsiTemplateApplyReport | null>(null);
    const [busy, setBusy] = useState(false);
    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        try { await work(); } catch { toast.error('Gagal memproses template.'); } finally { setBusy(false); }
    };
    const preview = () => run(async () => setReport(await CsiHcApi.applyTemplate(scope, template.id, periodId, false)));
    const apply = () => run(async () => {
        const result = mode === 'existing'
            ? await CsiHcApi.applyTemplate(scope, template.id, periodId, true)
            : (await CsiHcApi.createPeriodFromTemplate(scope, template.id, form)).report;
        setReport(result);
        toast.success(mode === 'existing' ? 'Template disinkronkan ke survei.' : 'Survei draft dibuat dari template.');
    });
    const canApply = mode === 'existing' ? !!report && !report.committed : !!form.title && !!form.startDate && !!form.endDate;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{`Gunakan template ${template.name}`}</DialogTitle>
                    <DialogDescription>Hanya menambah PIC, penilai dan pasangan; tidak ada yang dihapus dari survei.</DialogDescription>
                </DialogHeader>
                <div role="radiogroup" aria-label="Tujuan" className="grid gap-1.5 text-[13.5px]">
                    <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'new'} onChange={() => { setMode('new'); setReport(null); }} />Buat survei baru</label>
                    <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'existing'} onChange={() => { setMode('existing'); setReport(null); }} />Survei yang sudah ada (Sinkronkan)</label>
                </div>
                {mode === 'new' ? (
                    <div className="grid gap-2">
                        <input aria-label="Judul survei" className={FIELD} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" aria-label="Tanggal mulai" className={FIELD} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
                            <input type="date" aria-label="Tanggal selesai" className={FIELD} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <select aria-label="Survei" className={FIELD} value={periodId} onChange={(event) => { setPeriodId(event.target.value); setReport(null); }}>
                            <option value="">Pilih survei HC…</option>
                            {periods.map((period) => <option key={period.id} value={period.id}>{period.title}</option>)}
                        </select>
                        <Button variant="soft" disabled={!periodId || busy} onClick={preview}>Pratinjau</Button>
                    </div>
                )}
                {report && <ReportView report={report} />}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
                    <Button variant="primary" disabled={!canApply || busy} onClick={apply}>{mode === 'new' ? 'Buat survei' : 'Terapkan'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
