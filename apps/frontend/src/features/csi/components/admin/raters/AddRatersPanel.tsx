import { useState } from 'react';
import { Lightbulb, Ticket, Upload, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { useActiveSites } from '@/components/site/useActiveSites';
import { cn } from '@/lib/utils';
import {
    useAddCsiRaterGroup, useAddCsiRaters, useAddCsiTicketRaters, useCsiRaterDepartments, useCsiRaterGroupPreview, useCsiTicketRaterPreview, useImportCsiRaters,
} from '../../../hooks/useCsi';
import type { DraftUser } from '../../../lib/csiAdmin';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiRaterImportResult, CsiScopeParam } from '../../../types';
import { FIELD_LABEL, MUTED_TEXT, UserMultiPicker } from '../AdminParts';
import { parseRaterKeys, readRaterFile } from './raterImport';

type AddMode = 'group' | 'ticket' | 'import' | 'search';
const BASE_MODES = [
    { value: 'group', label: 'Per kelompok' },
    { value: 'import', label: 'Impor daftar' },
    { value: 'search', label: 'Cari satu-satu' },
] as const;
const ICT_MODES = [
    { value: 'group', label: 'Per kelompok' },
    { value: 'ticket', label: 'Dari tiket IT Support' },
    { value: 'import', label: 'Impor daftar' },
    { value: 'search', label: 'Cari satu-satu' },
] as const;
const ALL = 'all';
const PREVIEW_BOX = 'rounded-xl border border-dashed border-[hsl(var(--idesk-border))] bg-[hsl(var(--muted)/.35)] px-3.5 py-3 text-[13px]';

function Sample({ names, more }: { names: string[]; more: number }) {
    if (!names.length) return null;
    return (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Contoh nama">
            {names.map((name) => <li key={name} className="rounded-full border border-[hsl(var(--idesk-border))] bg-card px-2.5 py-0.5 text-[12px]">{name}</li>)}
            {more > 0 && <li className={cn(MUTED_TEXT, 'px-1 text-[12px]')}>{`+${more} lainnya`}</li>}
        </ul>
    );
}

/** Everyone of a site and/or an HR department, previewed (count + sample) before anything is added. */
function GroupAdd({ scope }: { scope: CsiScopeParam }) {
    const { data: sites = [] } = useActiveSites();
    const [siteId, setSiteId] = useState<string>(ALL);
    const [departmentId, setDepartmentId] = useState<string>(ALL);
    const site = siteId === ALL ? undefined : siteId;
    const department = departmentId === ALL ? undefined : departmentId;
    const { data: departments = [] } = useCsiRaterDepartments(scope, site);
    const filter = { siteId: site, departmentId: department };
    const { data: preview, isFetching } = useCsiRaterGroupPreview(scope, filter);
    const add = useAddCsiRaterGroup(scope);
    const run = () => add.mutate(filter, { onSuccess: (result) => toast.success(`${result.added} penilai ditambahkan`) });
    return (
        <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Site</span>
                    <Select value={siteId} onValueChange={(value) => { setSiteId(value); setDepartmentId(ALL); }}>
                        <SelectTrigger aria-label="Site penilai"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua site</SelectItem>
                            {sites.map((row) => <SelectItem key={row.id} value={row.id}>{`${row.code} — ${row.name}`}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </label>
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Departemen (opsional)</span>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                        <SelectTrigger aria-label="Departemen penilai"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua departemen</SelectItem>
                            {departments.map((row) => <SelectItem key={row.id} value={row.id}>{`${row.name} (${row.userCount})`}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </label>
            </div>
            {!site && !department && <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>Pilih site atau departemen untuk melihat siapa saja yang akan ditambahkan.</p>}
            {preview && (site || department) && (
                <div className={PREVIEW_BOX} aria-busy={isFetching || undefined}>
                    <b>{`${preview.total} user aktif`}</b>
                    {preview.alreadyRegistered > 0 && <span className={MUTED_TEXT}>{` · ${preview.alreadyRegistered} sudah terdaftar akan dilewati`}</span>}
                    <Sample names={preview.sample} more={preview.toAdd - preview.sample.length} />
                </div>
            )}
            <Button variant="primary" className="w-fit" onClick={run} loading={add.isPending} disabled={!preview?.toAdd}>
                <UserPlus aria-hidden="true" />{preview?.toAdd ? `Tambahkan ${preview.toAdd} orang` : 'Tambahkan'}
            </Button>
        </div>
    );
}

function ImportResult({ result }: { result: CsiRaterImportResult }) {
    return (
        <div className={PREVIEW_BOX} role="status">
            <span className={cn('font-semibold', toneClasses('green').ink)}>{`✓ ${result.matched} cocok`}</span>
            {result.alreadyRegistered > 0 && <span className={MUTED_TEXT}>{` · ${result.alreadyRegistered} sudah terdaftar`}</span>}
            {result.notFound.length > 0 && (
                <p className={cn('mt-1 font-semibold', toneClasses('red').ink)}>
                    {`✗ ${result.notFound.length} tidak ditemukan: `}
                    <span className="font-normal">{result.notFound.slice(0, 10).join(', ')}{result.notFound.length > 10 ? ', …' : ''}</span>
                </p>
            )}
            <Sample names={result.sample} more={result.toAdd - result.sample.length} />
        </div>
    );
}

/** Paste or upload (Excel / CSV) a list of emails or NIKs; the match is shown before anything is added. */
function ImportAdd({ scope }: { scope: CsiScopeParam }) {
    const [text, setText] = useState('');
    const [result, setResult] = useState<CsiRaterImportResult | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const run = useImportCsiRaters(scope);
    const keys = parseRaterKeys(text);
    const check = (list = keys) => run.mutate({ keys: list, commit: false }, { onSuccess: setResult });
    const commit = () => run.mutate({ keys, commit: true }, {
        onSuccess: (done) => { toast.success(`${done.added} penilai ditambahkan`); setResult(null); setText(''); },
    });
    const upload = async (file: File | undefined) => {
        if (!file) return;
        setFileError(null);
        try {
            const list = await readRaterFile(file);
            setText(list.join('\n'));
            check(list);
        } catch (error) {
            setFileError((error as Error).message);
        }
    };
    return (
        <div className="grid gap-3">
            <label className="grid gap-1.5">
                <span className={FIELD_LABEL}>Tempel email atau NIK (satu per baris, atau dipisah koma)</span>
                <Textarea rows={4} value={text} onChange={(event) => { setText(event.target.value); setResult(null); }}
                    placeholder={'budi@kapalapi.co.id\n00012345'} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[hsl(var(--idesk-border))] bg-card px-3 py-1.5 text-[13px] font-semibold text-[hsl(var(--idesk-sapphire))] hover:bg-[hsl(var(--muted)/.5)]">
                    <Upload className="h-4 w-4" aria-hidden="true" />Unggah Excel / CSV
                    <input type="file" accept=".xlsx,.xls,.csv,.txt" className="sr-only" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
                </label>
                <span className={cn(MUTED_TEXT, 'text-[12px]')}>Kolom yang dibaca: Email atau NIK (baris pertama boleh judul kolom).</span>
            </div>
            {fileError && <p role="alert" className={cn('text-[12.5px]', toneClasses('red').ink)}>{fileError}</p>}
            {result && <ImportResult result={result} />}
            <div className="flex flex-wrap gap-2">
                <Button variant="soft" onClick={() => check()} loading={run.isPending && !result} disabled={!keys.length}>{`Cek ${keys.length || ''} baris`}</Button>
                <Button variant="primary" onClick={commit} loading={run.isPending && !!result} disabled={!result?.toAdd}>
                    <UserPlus aria-hidden="true" />{result?.toAdd ? `Tambahkan ${result.toAdd} penilai` : 'Tambahkan'}
                </Button>
            </div>
        </div>
    );
}

function SearchAdd({ scope, registered }: { scope: CsiScopeParam; registered: ReadonlySet<string> }) {
    const add = useAddCsiRaters(scope);
    const [picked, setPicked] = useState<DraftUser[]>([]);
    return (
        <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[240px] flex-1">
                <UserMultiPicker scope={scope} label="Pilih penilai" selected={picked} onChange={setPicked} excludeIds={registered} />
            </div>
            <Button variant="primary" loading={add.isPending} disabled={!picked.length}
                onClick={() => add.mutate({ userIds: picked.map((user) => user.id) }, { onSuccess: () => setPicked([]) })}>
                <UserPlus aria-hidden="true" />{picked.length ? `Tambahkan ${picked.length} orang` : 'Tambahkan'}
            </Button>
        </div>
    );
}

/** Active, logged-in users who have ever filed an IT Support (OPS_SUPPORT) ticket. */
function TicketRatersAdd({ scope }: { scope: CsiScopeParam }) {
    const { data: sites = [] } = useActiveSites();
    const [siteId, setSiteId] = useState<string>(ALL);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [includeAllRoles, setIncludeAllRoles] = useState(false);
    const invalidDates = !!(startDate && endDate && endDate < startDate);
    const filter = {
        siteId: siteId === ALL ? undefined : siteId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeAllRoles,
    };
    const { data: preview, isFetching } = useCsiTicketRaterPreview(scope, filter);
    const add = useAddCsiTicketRaters(scope);
    const run = () => add.mutate(filter, { onSuccess: (result) => toast.success(`${result.added} penilai dari tiket IT Support ditambahkan`) });

    return (
        <div className="grid gap-3">
            <p className={cn(MUTED_TEXT, 'text-[12.5px]')}>
                Menarik user aktif yang sudah pernah login dan pernah membuat tiket IT Support (OPS Support). User yang belum pernah login atau belum pernah buat tiket tidak masuk daftar.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Site</span>
                    <Select value={siteId} onValueChange={setSiteId}>
                        <SelectTrigger aria-label="Site penilai tiket"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Semua site</SelectItem>
                            {sites.map((row) => <SelectItem key={row.id} value={row.id}>{`${row.code} — ${row.name}`}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </label>
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Dari tanggal tiket (opsional)</span>
                    <Input type="date" aria-label="Dari tanggal tiket" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="grid gap-1.5">
                    <span className={FIELD_LABEL}>Sampai tanggal tiket (opsional)</span>
                    <Input type="date" aria-label="Sampai tanggal tiket" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
            </div>
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox checked={includeAllRoles} onCheckedChange={(state) => setIncludeAllRoles(state === true)} />
                <span>Sertakan role selain USER (Agent / Manager / Admin)</span>
            </label>
            {invalidDates && (
                <p role="alert" className={cn('text-[12.5px]', toneClasses('red').ink)}>Tanggal selesai tidak boleh sebelum tanggal mulai.</p>
            )}
            {!invalidDates && preview && (
                <div className={PREVIEW_BOX} aria-busy={isFetching || undefined}>
                    <b>{`${preview.total} user memenuhi syarat`}</b>
                    {preview.alreadyRegistered > 0 && <span className={MUTED_TEXT}>{` · ${preview.alreadyRegistered} sudah terdaftar akan dilewati`}</span>}
                    {preview.bySite.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {preview.bySite.map((site) => (
                                <span key={site.code} className="rounded-md bg-card px-2 py-0.5 text-[11.5px] font-medium border border-[hsl(var(--idesk-border))]">
                                    {`${site.code}: ${site.toAdd} baru (${site.total} total)`}
                                </span>
                            ))}
                        </div>
                    )}
                    <Sample names={preview.sample} more={preview.toAdd - preview.sample.length} />
                </div>
            )}
            <Button variant="primary" className="w-fit" onClick={run} loading={add.isPending} disabled={invalidDates || !preview?.toAdd}>
                <Ticket aria-hidden="true" />{preview?.toAdd ? `Tambahkan ${preview.toAdd} penilai` : 'Tambahkan'}
            </Button>
        </div>
    );
}

/** Three ways to register raters (four for ICT with IT Support ticket history), the fastest first. */
export function AddRatersPanel({ scope, registered }: { scope: CsiScopeParam; registered: ReadonlySet<string> }) {
    const [mode, setMode] = useState<AddMode>('group');
    const modes = scope === 'ict' ? ICT_MODES : BASE_MODES;
    return (
        <div className="grid gap-3">
            <p className={cn('flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px]', toneClasses('sky').soft, toneClasses('sky').ink)}>
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Paling cepat: tambahkan satu kelompok sekaligus (per site, departemen, atau pembuat tiket IT Support), lalu hapus yang tidak perlu dari daftar di bawah.
            </p>
            <SegmentedControl aria-label="Cara menambah penilai" className="dash-seg w-fit" options={modes} value={mode} onValueChange={setMode} />
            {mode === 'group' && <GroupAdd scope={scope} />}
            {mode === 'ticket' && scope === 'ict' && <TicketRatersAdd scope={scope} />}
            {mode === 'import' && <ImportAdd scope={scope} />}
            {mode === 'search' && <SearchAdd scope={scope} registered={registered} />}
        </div>
    );
}
