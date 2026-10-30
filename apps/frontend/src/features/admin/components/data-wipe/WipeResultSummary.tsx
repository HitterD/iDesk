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
            <div className="rounded-2xl border border-ok/30 bg-ok/10 p-5">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ok text-white">
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black tracking-tight text-ok-ink">
                            Penghapusan data selesai
                        </h3>
                        <p className="mt-1 text-sm text-ok-ink">
                            {numberId(result.totalRowsDeleted)} baris database dan{' '}
                            {numberId(result.filesDeleted)} berkas lampiran telah dihapus permanen.
                            Sistem siap dimulai dari nol.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-ok-ink" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-ink">
                        Backup pengaman
                    </h4>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                    Dibuat otomatis sebelum penghapusan dimulai. Simpan path ini — hanya berkas
                    inilah jalan untuk memulihkan data.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-fill p-3">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs text-ink">
                        {result.backupPath}
                    </code>
                    <button
                        type="button"
                        onClick={copyPath}
                        aria-label="Salin path backup"
                        className="idesk-btn is-soft shrink-0"
                    >
                        {copied ? (
                            <>
                                <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
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
                <p className="mt-2 text-xs text-ink-2">
                    Ukuran berkas {formatBytes(result.backupSizeBytes)}.
                </p>
            </div>

            {result.fileSweepWarning && (
                <div className="rounded-2xl border border-warn/30 bg-warn/10 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
                        <div>
                            <h4 className="text-sm font-bold text-warn-ink">
                                Sebagian berkas gagal dihapus
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed text-warn-ink">
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

            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
                <div className="border-b border-line bg-fill px-4 py-3">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink-2">
                        Rincian per tabel
                    </h4>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                        <caption className="sr-only">Jumlah baris yang terhapus per tabel</caption>
                        <tbody>
                            {deletedRows.map(([table, rows]) => (
                                <tr key={table} className="border-b border-line last:border-0">
                                    <td className="px-4 py-2.5 font-mono text-xs text-ink-2">
                                        {table}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-sm font-bold tabular-nums text-ink">
                                        {numberId(rows)}
                                    </td>
                                </tr>
                            ))}
                            {deletedRows.length === 0 && (
                                <tr>
                                    <td className="px-4 py-8 text-center text-sm text-ink-3">
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
                className="idesk-btn is-soft"
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
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
        <div className="flex items-center gap-2 text-ink-2">
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black tabular-nums text-ink">
            {value}
        </div>
        <p className="mt-0.5 text-xs text-ink-2">{hint}</p>
    </div>
);
