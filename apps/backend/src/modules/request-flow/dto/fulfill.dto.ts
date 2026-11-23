import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { HARDWARE_TICKET_LIMITS, PNG_DATA_URL } from './create-hardware-ticket.dto';

export type FulfillMode = 'CREDENTIALS' | 'NO_CREDENTIALS';
export const FULFILL_MODES: readonly FulfillMode[] = ['CREDENTIALS', 'NO_CREDENTIALS'];
export const FULFILL_FIELD_MAX = 255;
export const FULFILL_NOTE_MAX = 2000;
export const FULFILL_NOTE_MIN = 3;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * IT gives the requested access: either with a username and password (stored encrypted) or without credentials (an
 * account the requester already has; the note says what was done). The signature is IT's, as on the paper form.
 */
export class FulfillDto {
    @IsIn(FULFILL_MODES)
    mode: FulfillMode;

    @IsOptional() @IsString() @MaxLength(FULFILL_FIELD_MAX) @Transform(trim)
    username?: string;

    /** Not trimmed: a password may start or end with a space. */
    @IsOptional() @IsString() @MaxLength(FULFILL_FIELD_MAX)
    password?: string;

    @IsOptional() @IsString() @MaxLength(FULFILL_FIELD_MAX) @Transform(trim)
    server?: string;

    @IsOptional() @IsString() @MaxLength(FULFILL_NOTE_MAX) @Transform(trim)
    note?: string;

    @IsOptional() @IsString() @MaxLength(FULFILL_FIELD_MAX) @Transform(trim)
    accountName?: string;

    @IsString()
    @MaxLength(HARDWARE_TICKET_LIMITS.signatureMaxChars)
    @Matches(PNG_DATA_URL, { message: 'Tanda tangan harus gambar PNG' })
    signatureData: string;
}
