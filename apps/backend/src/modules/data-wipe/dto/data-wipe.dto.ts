import { ArrayNotEmpty, IsArray, IsEnum, IsString, MinLength } from 'class-validator';
import { WipeDomain } from '../constants/wipe-scope.constants';

/** Exact phrase the operator must type to arm the execute endpoint. */
export const WIPE_CONFIRM_PHRASE = 'HAPUS SEMUA DATA';

export class WipePreviewDto {
    @IsArray()
    @ArrayNotEmpty({ message: 'Pilih minimal satu domain data yang akan dihapus.' })
    @IsEnum(WipeDomain, { each: true, message: 'Domain data tidak dikenali.' })
    domains: WipeDomain[];
}

export class WipeExecuteDto {
    @IsString()
    @MinLength(1, { message: 'Token pratinjau wajib diisi.' })
    token: string;

    @IsString()
    @MinLength(1, { message: 'Frasa konfirmasi wajib diisi.' })
    confirmPhrase: string;
}

export interface WipeTablePreview {
    table: string;
    label: string;
    rows: number;
    outOfScope: boolean;
    reason?: string;
}

export interface WipeFilePreview {
    folders: string[];
    fileCount: number;
    bytes: number;
}

export interface WipePreviewResult {
    token: string;
    expiresAt: string;
    domains: WipeDomain[];
    tables: WipeTablePreview[];
    totalRows: number;
    files: WipeFilePreview;
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
