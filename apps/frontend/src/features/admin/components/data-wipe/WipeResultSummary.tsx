import React, { useState } from 'react';
import {
    CheckCircle2,
    ShieldCheck,
    Copy,
    Check,
    AlertTriangle,
    Database,
    FolderOpen,
    Clock,
} from 'lucide-react';
import { WipeExecuteResult, formatBytes } from '../../hooks/useDataWipe';

interface WipeResultSummaryProps {
    result: WipeExecuteResult;
    onReset: () => void;
}

const numberId = (value: number) => value.toLocaleString('id-ID');

/**
 * Terminal screen for a completed wipe. The backup path is the single most
 * important thing here — it is the only route back — so it is copyable and is
 * never collapsed behind an expander.
 */
export const WipeResultSummary: React.FC<WipeResultSummaryProps> = ({ result, onReset }) => {
    const [copied, setCopied] = useState(false);

    const copyPath = async () => {
        try {
            await navigator.clipboard.writeText(result.backupPath);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be blocked by permissions; the path stays selectable on screen.
            setCopied(false);
        }
    };

    const deletedRows = Object.entries(result.deleted)
        .filter(([, rows]) => rows > 0)
        .sort((a, b) => b[1] - a[1]);

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/30">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black tracking-tight text-emerald-900 dark:text-emerald-200">
                            Penghapusan data selesai
                        </h3>
                        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300/90">
                            {numberId(result.totalRowsDeleted)} baris database dan{' '}
                            {numberId(result.filesDeleted)} berkas lampiran telah dihapus permanen.
                            Sistem siap dimulai dari nol.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-xs">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Backup pengaman
                    </h4>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Dibuat otomatis sebelum penghapusan dimulai. Simpan path ini — hanya berkas
                    inilah jalan untuk memulihkan data.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-700 dark:text-slate-300">
                        {result.backupPath}
                    </code>
                    <button
                        type="button"
                        onClick={copyPath}
                        aria-label="Salin path backup"
                        className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        {copied ? (
                            <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                                Tersalin
                            </>
                        ) : (
                            <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                Salin
                            </>
                        )}
                    </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Ukuran berkas {formatBytes(result.backupSizeBytes)}.
                </p>
            </div>

            {result.fileSweepWarning && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                Sebagian berkas gagal dihapus
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
                                {result.fileSweepWarning} Data database sudah terhapus sepenuhnya —
                                sisa berkas ini dapat dibersihkan manual.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile
                    icon={Database}
                    label="Baris dihapus"
                    value={numberId(result.totalRowsDeleted)}
                    hint={`${result.countersReset} penghitung direset`}
                />
                <StatTile
                    icon={FolderOpen}
                    label="Berkas dihapus"
                    value={numberId(result.filesDeleted)}
                    hint={`${formatBytes(result.bytesFreed)} dibebaskan`}
                />
                <StatTile
                    icon={Clock}
                    label="Durasi"
                    value={`${(result.durationMs / 1000).toFixed(1)}s`}
                    hint={`Audit ${result.auditLogId.slice(0, 8)}`}
                />
            </div>

            <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xs">
                <div className="border-b border-[hsl(var(--border))] bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Rincian per tabel
                    </h4>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                        <caption className="sr-only">Jumlah baris yang terhapus per tabel</caption>
                        <tbody>
                            {deletedRows.map(([table, rows]) => (
                                <tr key={table} className="border-b border-[hsl(var(--border))] last:border-0">
                                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                                        {table}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                                        {numberId(rows)}
                                    </td>
                                </tr>
                            ))}
                            {deletedRows.length === 0 && (
                                <tr>
                                    <td className="px-4 py-8 text-center text-sm text-slate-400">
                                        Tidak ada baris yang terhapus.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <button
                type="button"
                onClick={onReset}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
                Kembali ke pemilihan domain
            </button>
        </div>
    );
};

const StatTile: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    hint: string;
}> = ({ icon: Icon, label, value, hint }) => (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xs">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {value}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
);
