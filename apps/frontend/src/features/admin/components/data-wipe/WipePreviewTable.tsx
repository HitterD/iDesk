import React from 'react';
import { AlertTriangle, Database, FolderOpen, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WipePreviewResult, formatBytes } from '../../hooks/useDataWipe';

interface WipePreviewTableProps {
    preview: WipePreviewResult;
}

const numberId = (value: number) => value.toLocaleString('id-ID');

const SummaryTile: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    hint: string;
}> = ({ icon: Icon, label, value, hint }) => (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {value}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
);

/**
 * Shows exactly what the server counted, per table. Tables outside the three
 * named domains stay in the same list rather than behind a toggle: they are the
 * rows an operator is least likely to expect, so they must be hardest to miss.
 */
export const WipePreviewTable: React.FC<WipePreviewTableProps> = ({ preview }) => {
    const affected = preview.tables.filter((t) => t.rows > 0);
    const emptyCount = preview.tables.length - affected.length;
    const counterRows = preview.counterResets.reduce((sum, counter) => sum + counter.rows, 0);

    return (
        <div className="space-y-4">
            {preview.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="space-y-1.5">
                            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                Perhatikan sebelum melanjutkan
                            </h4>
                            <ul className="space-y-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
                                {preview.warnings.map((warning) => (
                                    <li key={warning} className="flex gap-2">
                                        <span aria-hidden="true">&bull;</span>
                                        <span>{warning}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryTile
                    icon={Database}
                    label="Baris database"
                    value={numberId(preview.totalRows)}
                    hint={`${affected.length} tabel terdampak`}
                />
                <SummaryTile
                    icon={FolderOpen}
                    label="Berkas lampiran"
                    value={numberId(preview.files.fileCount)}
                    hint={formatBytes(preview.files.bytes)}
                />
                <SummaryTile
                    icon={RotateCcw}
                    label="Penghitung direset"
                    value={numberId(counterRows)}
                    hint="Baris counter direset"
                />
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <caption className="sr-only">
                            Rincian jumlah baris yang akan dihapus per tabel
                        </caption>
                        <thead>
                            <tr className="border-b border-[hsl(var(--border))] bg-slate-50 dark:bg-slate-900/50">
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                                >
                                    Data
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                                >
                                    Baris
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {affected.map((row) => (
                                <tr key={row.table} className="border-b border-[hsl(var(--border))] last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    {row.label}
                                                </span>
                                                <code className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                                    {row.table}
                                                </code>
                                                {row.outOfScope && (
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                                        Di luar 3 domain
                                                    </span>
                                                )}
                                            </div>
                                            {row.reason && (
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {row.reason}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td
                                        className={cn(
                                            'px-4 py-3 text-right align-top font-mono font-bold tabular-nums',
                                            row.outOfScope
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-slate-900 dark:text-white',
                                        )}
                                    >
                                        {numberId(row.rows)}
                                    </td>
                                </tr>
                            ))}
                            {affected.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-400">
                                        Tidak ada data yang perlu dihapus pada domain terpilih.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {emptyCount > 0 && (
                    <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] bg-slate-50 px-4 py-2.5 text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{emptyCount} tabel lain sudah kosong dan tidak ditampilkan.</span>
                    </div>
                )}
            </div>

            {preview.files.folders.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Folder lampiran yang dikosongkan:{' '}
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                        {preview.files.folders.join(', ')}
                    </span>
                </p>
            )}
        </div>
    );
};
