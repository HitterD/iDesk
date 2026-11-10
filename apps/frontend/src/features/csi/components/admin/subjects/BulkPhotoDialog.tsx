import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useUploadCsiSubjectPhoto } from '../../../hooks/useCsi';
import { errorMessage } from '../../../lib/csiForm';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiScopeParam, CsiSubjectGroup, CsiSubjectView } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { expandZip, isPhotoName, isZipFile, matchPhotoFiles } from './photoMatch';
import { photoError } from './SubjectEditSheet';

const FIELD = 'h-8 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 text-[12.5px]';
const SKIP = '';
const UPLOAD_FAILED = 'Gagal mengunggah';
const ZIP_FAILED = 'ZIP tidak bisa dibaca';

type RowStatus = { state: 'idle' } | { state: 'done' } | { state: 'failed'; message: string };
interface Row { id: number; file: File; url: string | null; key: string; ambiguous: boolean; status: RowStatus }

/** Every subject of the HC list (SITE team, custom teams, people) with its site, for matching and the select. */
const subjectsOf = (group: CsiSubjectGroup): CsiSubjectView[] => [...(group.team ? [group.team] : []), ...group.teams, ...group.people];

/** Image files as-is plus the photos inside any ZIP; a broken ZIP is reported instead of failing the whole pick. */
async function expandPicked(files: File[]): Promise<{ photos: File[]; problems: string[] }> {
    const photos: File[] = [];
    const problems: string[] = [];
    for (const file of files) {
        if (isZipFile(file)) {
            try {
                photos.push(...await expandZip(file));
            } catch {
                problems.push(`${file.name}: ${ZIP_FAILED}`);
            }
        } else if (isPhotoName(file.name)) photos.push(file);
    }
    return { photos, problems };
}

const objectUrl = (file: File) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null);

function StatusCell({ row }: { row: Row }) {
    if (row.status.state === 'done') return <span className={cn('font-semibold', toneClasses('green').ink)}>Terunggah</span>;
    if (row.status.state === 'failed') return <span className={toneClasses('red').ink}>{row.status.message}</span>;
    if (!row.key) return <span className={MUTED_TEXT}>{row.ambiguous ? 'Nama ganda, pilih subjek' : 'Dilewati'}</span>;
    return <span className={MUTED_TEXT}>Siap</span>;
}

function SubjectSelect({ row, groups, disabled, onChange }: { row: Row; groups: CsiSubjectGroup[]; disabled: boolean; onChange: (key: string) => void }) {
    return (
        <select aria-label={`Subjek untuk ${row.file.name}`} className={FIELD} value={row.key} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
            <option value={SKIP}>Lewati</option>
            {groups.map((group) => (
                <optgroup key={group.siteId} label={`${group.siteCode} · ${group.siteName}`}>
                    {subjectsOf(group).map((subject) => <option key={subject.key} value={subject.key}>{subject.name}</option>)}
                </optgroup>
            ))}
        </select>
    );
}

function RowsTable({ rows, groups, disabled, onAssign }: { rows: Row[]; groups: CsiSubjectGroup[]; disabled: boolean; onAssign: (id: number, key: string) => void }) {
    return (
        <div className="max-h-[50vh] overflow-auto rounded-xl ring-1 ring-[hsl(var(--border))]">
            <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-[hsl(var(--muted))] text-left">
                    <tr><th className="p-2">Foto</th><th className="p-2">File</th><th className="p-2">Subjek</th><th className="p-2">Status</th></tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className="border-t border-[hsl(var(--border)/.6)]">
                            <td className="p-2">{row.url ? <img src={row.url} alt="" className="h-10 w-8 rounded object-cover" /> : <span className="block h-10 w-8 rounded bg-[hsl(var(--muted))]" />}</td>
                            <td className="max-w-[160px] break-words p-2">{row.file.name}</td>
                            <td className="min-w-[180px] p-2"><SubjectSelect row={row} groups={groups} disabled={disabled} onChange={(key) => onAssign(row.id, key)} /></td>
                            <td className="p-2"><StatusCell row={row} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Many photos (or a ZIP) at once: file names are matched to subject names, the admin reviews and fixes the pairing,
 * then the photos go up one by one through the subject photo endpoint (user:, team: and pic: keys alike).
 */
export function BulkPhotoDialog({ scope, groups, open, onOpenChange }: {
    scope: CsiScopeParam; groups: CsiSubjectGroup[]; open: boolean; onOpenChange: (open: boolean) => void;
}) {
    const upload = useUploadCsiSubjectPhoto(scope);
    const input = useRef<HTMLInputElement>(null);
    const nextId = useRef(0);
    const [rows, setRows] = useState<Row[]>([]);
    const [problems, setProblems] = useState<string[]>([]);
    const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
    const [running, setRunning] = useState(false);
    const urls = useRef<string[]>([]);
    const revokeAll = () => { urls.current.forEach((url) => URL.revokeObjectURL(url)); urls.current = []; };
    useEffect(() => revokeAll, []);

    const close = (next: boolean) => {
        if (running) return;
        if (!next) { revokeAll(); setRows([]); setProblems([]); setProgress(null); }
        onOpenChange(next);
    };
    const pick = async (files: File[]) => {
        const { photos, problems: zipProblems } = await expandPicked(files);
        const subjects = groups.flatMap(subjectsOf).map(({ key, name }) => ({ key, name }));
        const added = matchPhotoFiles(photos, subjects).map(({ file, key, candidates }): Row => {
            const url = objectUrl(file);
            if (url) urls.current.push(url);
            const invalid = photoError(file);
            return { id: nextId.current++, file, url, key: invalid ? SKIP : key ?? SKIP, ambiguous: candidates.length > 1, status: invalid ? { state: 'failed', message: invalid } : { state: 'idle' } };
        });
        setRows((prev) => [...prev, ...added]);
        setProblems((prev) => [...prev, ...zipProblems]);
        setProgress(null);
    };
    const assign = (id: number, key: string) => setRows((prev) => prev.map((row) => (row.id === id ? { ...row, key } : row)));
    const queue = rows.filter((row) => row.key && row.status.state === 'idle');

    /** Sequential on purpose: one request at a time keeps the order readable and the server unloaded. */
    const save = async () => {
        setRunning(true);
        let failed = 0;
        setProgress({ done: 0, total: queue.length, failed });
        for (const [index, row] of queue.entries()) {
            let status: RowStatus;
            try {
                await upload.mutateAsync({ key: row.key, file: row.file });
                status = { state: 'done' };
            } catch (failure) {
                status = { state: 'failed', message: errorMessage(failure) ?? UPLOAD_FAILED };
                failed += 1;
            }
            setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status } : item)));
            setProgress({ done: index + 1, total: queue.length, failed });
        }
        setRunning(false);
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
                <DialogHeader>
                    <DialogTitle>Unggah foto massal</DialogTitle>
                    <DialogDescription>Nama file dicocokkan ke nama orang atau tim (mis. "Rara Kurnia.jpg"). Periksa pasangannya sebelum mengunggah.</DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 gap-3 overflow-y-auto">
                    <div>
                        <Button variant="soft" disabled={running} onClick={() => input.current?.click()}><Upload aria-hidden="true" />Pilih foto atau ZIP</Button>
                        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,.zip,application/zip" aria-label="Pilih foto atau ZIP" tabIndex={-1} className="sr-only"
                            onChange={(event) => { const picked = Array.from(event.target.files ?? []); event.target.value = ''; void pick(picked); }} />
                        <p className={cn(MUTED_TEXT, 'mt-1 text-[12px]')}>JPG/PNG/WebP ≤ 5 MB per foto. File lain di dalam ZIP diabaikan.</p>
                    </div>
                    {problems.map((problem) => <p key={problem} role="alert" className={cn('text-[12.5px]', toneClasses('red').ink)}>{problem}</p>)}
                    {rows.length > 0 && <RowsTable rows={rows} groups={groups} disabled={running} onAssign={assign} />}
                    {progress && <p role="status" className="text-[13px] font-semibold tabular-nums">{`${progress.done} / ${progress.total}`}</p>}
                    {progress && !running && (
                        <p className={cn('text-[13px]', progress.failed ? toneClasses('red').ink : toneClasses('green').ink)}>
                            {`${progress.total - progress.failed} foto terunggah, ${progress.failed} gagal`}
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" disabled={running} onClick={() => close(false)}>Tutup</Button>
                    <Button variant="primary" loading={running} disabled={!queue.length} onClick={() => void save()}>{`Unggah ${queue.length} foto`}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
