import { useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Pencil, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiDirectory, useCsiPics, useImportCsiDirectory, useUpdateCsiPic } from '../../../hooks/useCsiHc';
import type { CsiScopeParam } from '../../../types';
import type { CsiPicView } from '../../../hcTypes';
import { RateeAvatar } from '../../respond/RateeAvatar';
import { AdminSection, EmptyNote, MUTED_TEXT } from '../AdminParts';
import { titleCase } from './hcFormat';

/**
 * Pengaturan → PIC HC: import "Data Hirarki Approver.xlsx" (employee directory + every HCC / HCD / HCS person as PIC)
 * and the PIC list per layanan and bagian, where single PICs can be switched off.
 */
const groupBy = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>();
    rows.forEach((row) => map.set(key(row), [...(map.get(key(row)) ?? []), row]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
};

function ImportCard({ scope }: { scope: CsiScopeParam }) {
    const input = useRef<HTMLInputElement>(null);
    const { data: directory } = useCsiDirectory(scope);
    const importer = useImportCsiDirectory(scope);
    const result = importer.data;
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--ticket-green)/.14)] text-[hsl(var(--ticket-green-ink))]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Data Hirarki Approver</p>
                <p className={MUTED_TEXT}>
                    {result
                        ? `Terimpor ${result.people.toLocaleString('id-ID')} karyawan · PIC baru ${result.picsAdded}, diperbarui ${result.picsUpdated}.`
                        : `${(directory?.people ?? 0).toLocaleString('id-ID')} karyawan di direktori. Sheet "4. ALL DATA_SJA": divisi, departemen, bagian dan lokasi responden + PIC HCC/HCD/HCS.`}
                </p>
            </div>
            <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importer.mutate(file);
                event.target.value = '';
            }} />
            <Button variant="primary" disabled={importer.isPending} onClick={() => input.current?.click()}>
                <Upload aria-hidden="true" />{importer.isPending ? 'Mengimpor…' : 'Impor file Excel'}
            </Button>
        </div>
    );
}

/** Same label as the report tables for a PIC without bagian. */
const NO_BAGIAN = 'Tanpa bagian';
const hasBagian = (pic: CsiPicView) => !!pic.bagian?.trim();

/** Active PICs without bagian land under "Tanpa bagian" in every report table; the banner can filter to them. */
function MissingBagianNotice({ count, filtered, onToggle }: { count: number; filtered: boolean; onToggle: () => void }) {
    const label = `${count} PIC belum punya bagian`;
    return (
        <div role="status" aria-label={label}
            className="flex flex-wrap items-center gap-2 rounded-2xl bg-[hsl(var(--ticket-amber)/.15)] px-4 py-3 text-[13px] text-[hsl(var(--ticket-amber-ink))]">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><b>{label}</b>{` — di laporan tampil sebagai "${NO_BAGIAN}". Lengkapi di Data Hirarki Approver lalu impor ulang.`}</span>
            <Button variant="soft" size="sm" onClick={onToggle}>{filtered ? 'Tampilkan semua PIC' : 'Tampilkan PIC tanpa bagian'}</Button>
        </div>
    );
}

const SERVICE_FUNCTION_MAX = 150;

/** Fungsi pelayanan shown under the title; a pencil turns it into an input (Enter saves, Escape cancels). */
function ServiceFunctionField({ pic, onSave }: { pic: CsiPicView; onSave: (value: string | null) => void }) {
    const [draft, setDraft] = useState<string | null>(null);
    if (draft === null) {
        return (
            <span className="mt-0.5 flex items-start gap-1">
                <span className={cn('break-words text-[12px] leading-snug', pic.serviceFunction ? 'font-medium text-[hsl(var(--idesk-sapphire))]' : 'italic text-[hsl(var(--idesk-text-secondary))]')}>
                    {pic.serviceFunction ?? 'Fungsi pelayanan belum diisi'}
                </span>
                <button type="button" aria-label={`Ubah fungsi pelayanan ${titleCase(pic.fullName)}`} onClick={() => setDraft(pic.serviceFunction ?? '')}
                    className="shrink-0 rounded p-0.5 text-[hsl(var(--idesk-text-secondary))] hover:bg-[hsl(var(--muted))]">
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                </button>
            </span>
        );
    }
    const save = () => { onSave(draft.trim() || null); setDraft(null); };
    return (
        <input autoFocus aria-label="Fungsi pelayanan" value={draft} maxLength={SERVICE_FUNCTION_MAX} onChange={(event) => setDraft(event.target.value)}
            onBlur={save} onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); save(); }
                if (event.key === 'Escape') setDraft(null);
            }}
            className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-2 py-1 text-[12px]" />
    );
}

interface PicRowProps { pic: CsiPicView; onToggle: () => void; onServiceFunction: (value: string | null) => void; pending: boolean }

function PicRow({ pic, onToggle, onServiceFunction, pending }: PicRowProps) {
    return (
        <li className={cn('flex items-start gap-2.5 rounded-xl px-2 py-1.5', !pic.isActive && 'opacity-55')}>
            <RateeAvatar name={pic.fullName} avatarUrl={pic.photoUrl} size="sm" />
            {/* Names and titles wrap instead of being cut off. */}
            <span className="min-w-0 flex-1">
                <span className="block break-words text-[13px] font-semibold leading-snug">{titleCase(pic.fullName)}</span>
                <span className="block break-words text-[12px] leading-snug text-[hsl(var(--idesk-text-secondary))]">{titleCase(pic.jobTitle ?? '')}</span>
                <ServiceFunctionField key={pic.serviceFunction ?? ''} pic={pic} onSave={onServiceFunction} />
                <span className="mt-0.5 flex flex-wrap gap-1">
                    {pic.workLocation && <span className="rounded-md bg-[hsl(var(--muted))] px-1.5 text-[11px] font-medium">{pic.workLocation}</span>}
                    {pic.userId && <span className="rounded-md bg-[hsl(var(--ticket-green)/.13)] px-1.5 text-[11px] font-medium text-[hsl(var(--ticket-green-ink))]">akun iDesk</span>}
                </span>
            </span>
            <button type="button" role="switch" aria-checked={pic.isActive} aria-label={`${pic.fullName} aktif`} disabled={pending} onClick={onToggle}
                className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', pic.isActive ? 'bg-[hsl(var(--idesk-sapphire))]' : 'bg-[hsl(var(--border))]')}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', pic.isActive ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </button>
        </li>
    );
}

export function PicsTab({ scope }: { scope: CsiScopeParam }) {
    const { data: pics = [], isLoading } = useCsiPics(scope, true);
    const update = useUpdateCsiPic(scope);
    const [service, setService] = useState<string | null>(null);
    const [onlyMissing, setOnlyMissing] = useState(false);
    const missing = pics.filter((pic) => pic.isActive && !hasBagian(pic)).length;
    const listed = onlyMissing && missing ? pics.filter((pic) => pic.isActive && !hasBagian(pic)) : pics;
    const services = groupBy(listed, (pic) => pic.serviceCode);
    const shown = services.filter(([code]) => !service || code === service);
    return (
        <AdminSection title="PIC HC per layanan & bagian" description="Semua staf HCC, HCD dan HCS dari Data Hirarki Approver. PIC yang dinonaktifkan tidak muncul di survei baru.">
            <div className="grid gap-4">
                <ImportCard scope={scope} />
                {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                {!isLoading && !pics.length && <EmptyNote>Belum ada PIC. Impor file Excel di atas.</EmptyNote>}
                {missing > 0 && <MissingBagianNotice count={missing} filtered={onlyMissing} onToggle={() => setOnlyMissing((value) => !value)} />}
                {services.length > 0 && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter layanan">
                        {[['', `Semua · ${listed.length}`] as const, ...services.map(([code, rows]) => [code, `${code} · ${rows.length}`] as const)].map(([code, label]) => (
                            <button key={code || 'all'} type="button" aria-pressed={(service ?? '') === code} onClick={() => setService(code || null)}
                                className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-semibold',
                                    (service ?? '') === code ? 'bg-[hsl(var(--idesk-sapphire))] text-white' : 'bg-[hsl(var(--muted))]')}>{label}</button>
                        ))}
                    </div>
                )}
                <div className={cn('grid gap-3', shown.length > 1 && 'lg:grid-cols-2')}>
                    {shown.map(([code, rows]) => (
                        <section key={code} className="rounded-2xl bg-[hsl(var(--muted)/.45)] p-3">
                            <h3 className="mb-2 text-[14px] font-bold">{`${code} · ${rows[0]?.serviceName ?? ''}`}<span className="ml-1 font-medium text-[hsl(var(--idesk-text-secondary))]">{`(${rows.filter((pic) => pic.isActive).length} aktif)`}</span></h3>
                            <div className={cn('grid max-h-[620px] gap-2 overflow-auto pr-1', shown.length === 1 && 'md:grid-cols-2 xl:grid-cols-3')}>
                                {groupBy(rows, (pic) => (hasBagian(pic) ? pic.bagian!.trim() : NO_BAGIAN)).map(([bagian, people]) => (
                                    <div key={bagian} className="rounded-xl bg-[hsl(var(--idesk-surface))] p-2">
                                        <p className="mb-1 px-2 text-[11.5px] font-bold uppercase tracking-wide text-[hsl(var(--idesk-text-secondary))]">{`${titleCase(bagian)} · ${people.length}`}</p>
                                        <ul>{people.map((pic) => (
                                            <PicRow key={pic.id} pic={pic} pending={update.isPending} onToggle={() => update.mutate({ id: pic.id, isActive: !pic.isActive })}
                                                onServiceFunction={(value) => value !== pic.serviceFunction && update.mutate({ id: pic.id, serviceFunction: value })} />
                                        ))}</ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </AdminSection>
    );
}
