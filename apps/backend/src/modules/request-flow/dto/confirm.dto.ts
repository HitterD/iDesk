import { Transform } from 'class-transformer';
import { IsIn, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export type ConfirmResult = 'OK' | 'ISSUE';
export const CONFIRM_RESULTS: readonly ConfirmResult[] = ['OK', 'ISSUE'];
export const CONFIRM_NOTE_MAX = 1000;
export const ISSUE_NOTE_MIN = 5;

/** A note is optional when the requester is satisfied and a description (5 to 1000 characters) when there is an issue. */
@ValidatorConstraint({ name: 'confirmNote' })
class ConfirmNote implements ValidatorConstraintInterface {
    validate(value: unknown, args: ValidationArguments): boolean {
        const issue = (args.object as ConfirmDto).result === 'ISSUE';
        if (value === undefined) return !issue;
        if (typeof value !== 'string' || value.length > CONFIRM_NOTE_MAX) return false;
        return !issue || value.length >= ISSUE_NOTE_MIN;
    }

    defaultMessage(args: ValidationArguments): string {
        return (args.object as ConfirmDto).result === 'ISSUE'
            ? `Jelaskan kendalanya (${ISSUE_NOTE_MIN}-${CONFIRM_NOTE_MAX} karakter)`
            : `Catatan maksimal ${CONFIRM_NOTE_MAX} karakter`;
    }
}

/** The requester's answer once IT reported the work done: it works, or it does not. */
export class ConfirmDto {
    @IsIn(CONFIRM_RESULTS)
    result: ConfirmResult;

    @Validate(ConfirmNote)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    note?: string;
}
