import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, Validate, ValidateIf, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { HARDWARE_TICKET_LIMITS, PNG_DATA_URL } from './create-hardware-ticket.dto';

export type ApprovalDecision = 'APPROVE' | 'RETURN' | 'REJECT';
export const DECISIONS: readonly ApprovalDecision[] = ['APPROVE', 'RETURN', 'REJECT'];
export const NOTE_MAX = 1000;
export const REASON_MIN = 5;

/** A note is optional on approval and a reason of at least `REASON_MIN` characters when returning or rejecting. */
@ValidatorConstraint({ name: 'decisionNote' })
class DecisionNote implements ValidatorConstraintInterface {
    validate(value: unknown, args: ValidationArguments): boolean {
        const approving = (args.object as ApproveDto).decision === 'APPROVE';
        if (value === undefined) return approving;
        if (typeof value !== 'string' || value.length > NOTE_MAX) return false;
        return approving || value.length >= REASON_MIN;
    }

    defaultMessage(args: ValidationArguments): string {
        return (args.object as ApproveDto).decision === 'APPROVE'
            ? `Catatan maksimal ${NOTE_MAX} karakter`
            : `Alasan wajib diisi (${REASON_MIN}-${NOTE_MAX} karakter)`;
    }
}

export class ApproveDto {
    @IsIn(DECISIONS)
    decision: ApprovalDecision;

    /** PNG data URL from the signature pad; required to approve. */
    @ValidateIf((o: ApproveDto) => o.decision === 'APPROVE')
    @IsString()
    @MaxLength(HARDWARE_TICKET_LIMITS.signatureMaxChars)
    @Matches(PNG_DATA_URL, { message: 'Tanda tangan harus gambar PNG' })
    signatureData?: string;

    @Validate(DecisionNote)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    note?: string;
}
