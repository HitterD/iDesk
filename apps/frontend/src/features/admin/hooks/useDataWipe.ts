import { useCallback, useState } from 'react';
import api from '@/lib/api';

export type WipeDomain = 'TICKETING' | 'EFORM' | 'HARDWARE';

export interface WipeTablePreview {
    table: string;
    label: string;
    rows: number;
    outOfScope: boolean;
    reason?: string;
}

export interface WipePreviewResult {
    token: string;
    expiresAt: string;
    domains: WipeDomain[];
    tables: WipeTablePreview[];
    totalRows: number;
    files: { folders: string[]; fileCount: number; bytes: number };
    counterResets: { table: string; column: string; label: string; rows: number }[];
    warnings: string[];
}

export interface WipeExecuteResult {
    backupPath: string;
    backupSizeBytes: number;
    deleted: Record<string, number>;
    totalRowsDeleted: number;
    countersReset: number;
    filesDeleted: number;
    bytesFreed: number;
    fileSweepWarning?: string;
    auditLogId: string;
    durationMs: number;
}

export const WIPE_DOMAIN_LABELS: Record<WipeDomain, string> = {
    TICKETING: 'Tiketing',
    EFORM: 'E-Form',
    HARDWARE: 'Hardware Request',
};

/**
 * Drives the two-step preview -> execute contract.
 *
 * The preview token is held here rather than in the page so that any change to
 * the selected domains can invalidate it in one place: an approved preview must
 * never be carried over to a different selection.
 */
export function useDataWipe() {
    const [preview, setPreview] = useState<WipePreviewResult | null>(null);
    const [result, setResult] = useState<WipeExecuteResult | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

    const runPreview = useCallback(async (domains: WipeDomain[]) => {
        // A refresh request invalidates the previous token immediately. If the
        // request fails, the operator must not be able to execute stale counts.
        setPreview(null);
        setResult(null);
        setIsPreviewing(true);
        try {
            const response = await api.post('/admin/data-wipe/preview', { domains });
            const data: WipePreviewResult = response.data.preview;
            setPreview(data);
            setResult(null);
            return data;
        } finally {
            setIsPreviewing(false);
        }
    }, []);

    const execute = useCallback(
        async (token: string, confirmPhrase: string) => {
            setIsExecuting(true);
            try {
                const response = await api.post('/admin/data-wipe/execute', {
                    token,
                    confirmPhrase,
                });
                const data: WipeExecuteResult = response.data.result;
                setResult(data);
                // The token is single-use server-side; drop it so the UI cannot retry.
                setPreview(null);
                return data;
            } finally {
                setIsExecuting(false);
            }
        },
        [],
    );

    /** Called whenever the domain selection changes, so a stale preview cannot be executed. */
    const clearPreview = useCallback(() => setPreview(null), []);
    const clearResult = useCallback(() => setResult(null), []);

    return {
        preview,
        result,
        isPreviewing,
        isExecuting,
        runPreview,
        execute,
        clearPreview,
        clearResult,
    };
}

/** Formats a byte count for display, matching the units used elsewhere in admin. */
export function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
