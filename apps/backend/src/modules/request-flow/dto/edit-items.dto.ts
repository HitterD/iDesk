import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, Validate, ValidateNested,
} from 'class-validator';
import { HARDWARE_TICKET_LIMITS, ItemFieldValues } from './create-hardware-ticket.dto';

export const EDIT_REASON_MIN = 5;
export const EDIT_REASON_MAX = 500;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** One line of the request as IT wants it: the units it keeps (if any), what they are, and how many there are in all. */
export class EditItemLineDto {
    /** Units (rows) of the request this line keeps; the rest of the quantity is added as new units. */
    @IsOptional() @IsArray() @ArrayMaxSize(HARDWARE_TICKET_LIMITS.quantityMax) @IsUUID('all', { each: true })
    existingItemIds?: string[];

    @IsOptional() @IsUUID()
    catalogId?: string;

    @IsOptional() @Transform(trim) @IsString() @Length(HARDWARE_TICKET_LIMITS.manualNameMin, HARDWARE_TICKET_LIMITS.nameMax)
    manualName?: string;

    @IsInt() @Min(1) @Max(HARDWARE_TICKET_LIMITS.quantityMax)
    quantity: number;

    @IsOptional() @IsString() @MaxLength(HARDWARE_TICKET_LIMITS.noteMax)
    note?: string;

    @IsOptional() @IsObject() @Validate(ItemFieldValues)
    fields?: Record<string, string | number>;

    @IsOptional() @Transform(trim) @IsString() @Length(1, HARDWARE_TICKET_LIMITS.nameMax)
    recipientName?: string;

    /** The item this one replaces (a swap); kept on the unit's snapshot. */
    @IsOptional() @Transform(trim) @IsString() @Length(1, HARDWARE_TICKET_LIMITS.nameMax)
    replacesName?: string;
}

/** IT changes the items of a request that is not installed yet. */
export class EditItemsDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(HARDWARE_TICKET_LIMITS.itemsMax)
    @ValidateNested({ each: true }) @Type(() => EditItemLineDto)
    items: EditItemLineDto[];

    @Transform(trim) @IsString() @Length(EDIT_REASON_MIN, EDIT_REASON_MAX)
    reason: string;
}
