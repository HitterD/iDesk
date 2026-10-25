import { IsString, MaxLength } from 'class-validator';

const RESET_REASON_MAX = 500;

/** Minimum length is checked in CsiReportService after trimming (CSI_RESET_REASON_MIN). */
export class ResetResponseDto {
    @IsString({ message: 'Alasan reset harus berupa teks' })
    @MaxLength(RESET_REASON_MAX, { message: `Alasan reset maksimal ${RESET_REASON_MAX} karakter` })
    reason: string;
}
