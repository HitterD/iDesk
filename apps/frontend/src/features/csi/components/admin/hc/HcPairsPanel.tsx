import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CsiHcApi } from '../../../api/csiHc.api';
import { useImportCsiPairs } from '../../../hooks/useCsiHc';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import type { CsiPairsImportReport } from '../../../hcTypes';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../AdminParts';
import { RaterPicEditor } from './RaterPicEditor';
import { UnitRulesEditor } from './UnitRulesEditor';

/**
 * HC "Siapa menilai siapa" (default mode, HC decides): per unit rules, per person (search the employee master) or an
 * Excel round trip (export, edit, import). All three write the same raters and rater → PIC pairs.
 */
type Tab = 'unit' | 'person' | 'excel';
const TABS = [
    { value: 'unit', label: 'Per unit (divisi / bagian)' },
    { value: 'person', label: 'Cari nama' },
    { value: 'excel', label: 'Ekspor / impor Excel' },
] as const;

function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
}

function ExcelRoundTrip({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const input = useRef<HTMLInputElement>(null);
    const importer = useImportCsiPairs(scope, period.id);
    const [file, setFile] = useState<File | null>(null);
    const [report, setReport] = useState<CsiPairsImportReport | null>(null);
    const exportFile = async () => {
        try {
            download(await CsiHcApi.exportPairs(scope, period.id), 'siapa-menilai-siapa.xlsx');
        } catch {
            toast.error('Gagal mengunduh Excel');
        }
    };
    const check = (picked: File) => {
        setFile(picked);
        importer.mutate({ file: picked, commit: false }, { onSuccess: setReport });
    };
    const commit = () => file && importer.mutate({ file, commit: true }, {
        onSuccess: (result) => { setReport(result); toast.success(`${result.raters} penilai, ${result.pairs} pasangan diimpor`); },
    });
    return (
        <div className="grid gap-3">
            <ol className={MUTED_TEXT + ' grid gap-1 pl-4 [list-style:decimal]'}>
                <li>Unduh Excel. Isinya pasangan saat ini (satu baris = penilai menilai satu PIC) dan sheet "Daftar PIC".</li>
                <li>Tambah atau hapus baris. Yang dibaca hanya kolom <b>NIK Penilai</b> dan <b>NIK PIC</b>.</li>
                <li>Unggah kembali, periksa hasil cek, lalu terapkan. Impor mengganti semua pasangan survei ini.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
                <Button variant="soft" onClick={() => void exportFile()}><Download aria-hidden="true" />Unduh Excel siapa menilai siapa</Button>
                <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(event) => { const picked = event.target.files?.[0]; if (picked) check(picked); event.target.value = ''; }} />
                <Button variant="soft" disabled={period.locked || importer.isPending} onClick={() => input.current?.click()}><Upload aria-hidden="true" />Unggah Excel</Button>
            </div>
            {report && (
                <div className="grid gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-3 text-[13px]">
                    <p className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                        {`${report.committed ? 'Diterapkan' : 'Hasil cek'}: ${report.rows} baris → ${report.raters} penilai, ${report.pairs} pasangan valid`}</p>
                    {report.problemCount > 0 && (
                        <ul className="grid gap-0.5 text-[12.5px] text-[hsl(var(--ticket-amber-ink))]">
                            {report.problems.map((problem) => <li key={problem.row}>{`Baris ${problem.row}: ${problem.message}`}</li>)}
                            {report.problemCount > report.problems.length && <li>{`… dan ${report.problemCount - report.problems.length} baris lain (dilewati)`}</li>}
                        </ul>
                    )}
                    {!report.committed && <div><Button variant="primary" disabled={!report.pairs || importer.isPending} onClick={commit}>Terapkan impor</Button></div>}
                </div>
            )}
        </div>
    );
}

export function HcPairsPanel({ scope, period }: { scope: CsiScopeParam; period: CsiPeriodDetail }) {
    const [tab, setTab] = useState<Tab>(period.unitRules?.length ? 'unit' : 'person');
    const pics = useMemo(() => period.ratees.filter((ratee) => ratee.picId).sort((a, b) => a.sortOrder - b.sortOrder), [period.ratees]);
    const picBagians = useMemo(() => {
        const map: Record<string, string[]> = {};
        pics.forEach((pic) => { if (pic.serviceCode && pic.bagian) map[pic.serviceCode] = [...new Set([...(map[pic.serviceCode] ?? []), pic.bagian])].sort(); });
        return map;
    }, [pics]);
    return (
        <AdminSection title="Siapa menilai siapa" description="HC menentukan karyawan mana menilai PIC mana. Responden hanya melihat PIC yang ditetapkan untuknya."
            actions={period.locked ? <LockedNote /> : <span className={MUTED_TEXT}>{`${period.raters.length} penilai · ${pics.length} PIC`}</span>}>
            {!pics.length ? <EmptyNote>Pilih PIC yang dinilai dulu (langkah "Orang yang dinilai").</EmptyNote> : (
                <div className="grid gap-4">
                    <SegmentedControl aria-label="Cara menentukan penilai" className="dash-seg w-fit" options={TABS} value={tab} onValueChange={setTab} />
                    {tab === 'unit' && <UnitRulesEditor scope={scope} period={period} picBagians={picBagians} />}
                    {tab === 'person' && <RaterPicEditor scope={scope} period={period} pics={pics} />}
                    {tab === 'excel' && <ExcelRoundTrip scope={scope} period={period} />}
                </div>
            )}
        </AdminSection>
    );
}
