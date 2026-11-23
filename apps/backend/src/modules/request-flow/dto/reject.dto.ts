import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const REJECT_REASON_MIN = 5;
export const REJECT_REASON_MAX = 1000;

/** IT's reason for refusing a request that is still in review; the requester reads it. */
export class RejectDto {
    @IsString() @MinLength(REJECT_REASON_MIN, { message: `Alasan wajib diisi (minimal ${REJECT_REASON_MIN} karakter)` }) @MaxLength(REJECT_REASON_MAX)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    reason: string;
}
