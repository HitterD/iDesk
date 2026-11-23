import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const PROCURE_NOTE_MAX = 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Units bought (or not) the same way: one vendor and price, or dropped. */
export class ProcureLineDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('all', { each: true })
    itemIds: string[];

    @IsIn(['APPROVED', 'REJECTED'])
    decision: 'APPROVED' | 'REJECTED';

    @IsOptional() @Transform(trim) @IsString() @Length(1, 255)
    vendor?: string;

    @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    unitCost?: number;

    @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
    invoiceNumber?: string;

    @IsOptional() @Matches(ISO_DAY, { message: 'Tanggal invoice harus berformat YYYY-MM-DD' })
    invoiceDate?: string;
}

export class ProcureDto {
    @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ProcureLineDto)
    lines: ProcureLineDto[];

    @IsOptional() @Transform(trim) @IsString() @MaxLength(PROCURE_NOTE_MAX)
    note?: string;
}
