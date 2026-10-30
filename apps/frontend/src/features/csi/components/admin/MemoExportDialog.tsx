import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCsiMemoSettings, useCsiPeriods, useExportCsiMemo } from '../../hooks/useCsi';
import { blobErrorMessage, downloadBlob } from '../../lib/csiAdmin';
import { defaultOpening, memoDefaults, MEMO_PERIOD_MAX, validMemo } from '../../lib/memo';
import type { CsiMemoHeader, CsiPeriodListItem, CsiScopeParam } from '../../types';
import { MemoHeaderFields } from './MemoHeaderFields';

function MemoForm({ scope, onDone }: { scope: CsiScopeParam; onDone: () => void }) {
    const { data: periods = [], isLoading, isError } = useCsiPeriods(scope);
    const { data: saved, isLoading: settingsLoading, isError: settingsError } = useCsiMemoSettings(scope);
    const exportMemo = useExportCsiMemo(scope);
    const [selected, setSelected] = useState<string[]>([]);
    const [edited, setEdited] = useState<CsiMemoHeader | null>(null);
    const available = [...periods].filter((period) => period.publishStatus === 'PUBLISHED').sort((a, b) => b.endDate.localeCompare(a.endDate));
    const chosen = selected.flatMap((id) => available.filter((period) => period.id === id));
    const header = edited ?? memoDefaults(saved, chosen);
    const toggle = (period: CsiPeriodListItem, checked: boolean) => {
        const next = checked ? [...selected, period.id] : selected.filter((id) => id !== period.id);
        if (edited && edited.opening === defaultOpening(chosen)) setEdited({ ...edited, opening: defaultOpening(next.flatMap((id) => available.filter((row) => row.id === id))) });
        setSelected(next);
    };
    const run = async () => {
        try {
            const result = await exportMemo.mutateAsync({ periodIds: selected, header });
            downloadBlob(result.blob, result.filename);
            toast.success('Memo PDF berhasil dibuat');
            onDone();
        } catch (error) { toast.error(await blobErrorMessage(error)); }
    };
    if (isLoading || settingsLoading) return <p role="status">Memuat pengaturan memo…</p>;
    if (isError || settingsError) return <p role="alert">Gagal memuat pengaturan memo. Tutup lalu coba kembali.</p>;
    return (
        <div className="grid gap-6">
            <fieldset className="rounded-2xl border border-border p-4"><legend className="px-1 text-sm font-medium">Pilih survei (maksimal {MEMO_PERIOD_MAX})</legend>
                <SurveyChoices periods={available} selected={selected} onToggle={toggle} disabled={exportMemo.isPending} />
                {!available.length && <p className="text-sm text-muted-foreground">Belum ada survei terbit yang dapat diekspor.</p>}
            </fieldset>
            <MemoHeaderFields value={header} onChange={setEdited} />
            <p className="text-xs text-muted-foreground">PDF berisi memo rekap, rincian jawaban, dan lampiran SLA. Isian header disimpan setelah PDF berhasil dibuat.</p>
            <div className="flex justify-end"><Button loading={exportMemo.isPending} disabled={!selected.length || !validMemo(header)} onClick={run}>Buat PDF</Button></div>
        </div>
    );
}

function SurveyChoices({ periods, selected, onToggle, disabled }: { periods: CsiPeriodListItem[]; selected: string[]; onToggle: (period: CsiPeriodListItem, checked: boolean) => void; disabled: boolean }) {
    return <ul className="grid max-h-52 gap-3 overflow-y-auto">{periods.map((period) => <li key={period.id} className="flex items-start gap-3">
        <Checkbox id={`memo-${period.id}`} aria-label={period.title} checked={selected.includes(period.id)} disabled={disabled || (!selected.includes(period.id) && selected.length >= MEMO_PERIOD_MAX)} onCheckedChange={(checked) => onToggle(period, checked === true)} />
        <label htmlFor={`memo-${period.id}`} className="cursor-pointer text-sm">{period.title}<span className="mt-0.5 block text-xs text-muted-foreground">{period.sites.map((site) => site.name).join(' & ')}</span></label>
    </li>)}</ul>;
}

export function MemoExportDialog({ scope, open, onOpenChange }: { scope: CsiScopeParam; open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader><DialogTitle>Export memo PDF</DialogTitle><DialogDescription>Pilih survei dan sesuaikan Interoffice Memo sebelum diunduh.</DialogDescription></DialogHeader>
                {open && <MemoForm key={scope} scope={scope} onDone={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}
