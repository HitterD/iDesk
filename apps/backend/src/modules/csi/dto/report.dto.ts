import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const RESET_REASON_MAX = 500;
export const CSI_REPORT_NOTES_MAX = 2000;
const SIGNOFF_PARAM_MAX = 8000;
export const CSI_REMINDER_USERS_MAX = 1000;

/** Minimum length is checked in CsiReportService after trimming (CSI_RESET_REASON_MIN). */
export class ResetResponseDto {
    @IsString({ message: 'Alasan reset harus berupa teks' })
    @MaxLength(RESET_REASON_MAX, { message: `Alasan reset maksimal ${RESET_REASON_MAX} karakter` })
    reason: string;
}

export class ReportQueryDto {
    @IsOptional()
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId?: string;
}

/** Report download: optional site filter, the admin's notes and a one-off sign-off layout (JSON, from the preview). */
export class ReportExportQueryDto extends ReportQueryDto {
    @IsOptional()
    @IsString({ message: 'Catatan harus berupa teks' })
    @MaxLength(CSI_REPORT_NOTES_MAX, { message: `Catatan maksimal ${CSI_REPORT_NOTES_MAX} karakter` })
    notes?: string;

    @IsOptional()
    @IsString({ message: 'Tanda tangan harus berupa teks' })
    @MaxLength(SIGNOFF_PARAM_MAX, { message: 'Tanda tangan terlalu panjang' })
    signoff?: string;
}

/** Omitted or empty `userIds` = every rater of the period who has not answered yet. */
export class SendRemindersDto {
    @IsOptional()
    @IsArray({ message: 'Daftar pengguna harus berupa array' })
    @ArrayMaxSize(CSI_REMINDER_USERS_MAX, { message: `Maksimal ${CSI_REMINDER_USERS_MAX} pengguna sekali kirim` })
    @IsUUID('all', { each: true, message: 'ID pengguna harus berupa UUID' })
    userIds?: string[];
}
