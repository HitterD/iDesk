import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max,
    MaxLength, Min, Validate, ValidateIf, ValidateNested, ValidationArguments, ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

export const HARDWARE_TICKET_LIMITS = {
    titleMin: 3,
    titleMax: 200,
    justificationMax: 2000,
    divisionMax: 120,
    recipientsMax: 20,
    nameMax: 120,
    manualNameMin: 2,
    quantityMax: 50,
    itemsMax: 50,
    noteMax: 300,
    fieldValueMax: 300,
    signatureMaxChars: 300 * 1024,
} as const;

/** The requester's signature from the signature pad: a PNG data URL. */
export const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimEach = ({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value);

/** The item is either from the catalog or written by hand, never both. */
@ValidatorConstraint({ name: 'catalogOrManual' })
class CatalogOrManual implements ValidatorConstraintInterface {
    validate(_value: unknown, args: ValidationArguments): boolean {
        return (args.object as HardwareTicketItemDto).manualName === undefined;
    }

    defaultMessage(): string {
        return 'Pilih barang dari katalog atau tulis manual, bukan keduanya';
    }
}

/** Extra item fields from the catalog: short texts or numbers only. */
@ValidatorConstraint({ name: 'itemFieldValues' })
export class ItemFieldValues implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return Object.values(value).every((v) =>
            (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= HARDWARE_TICKET_LIMITS.fieldValueMax));
    }

    defaultMessage(): string {
        return `Isian barang harus teks (maks ${HARDWARE_TICKET_LIMITS.fieldValueMax} karakter) atau angka`;
    }
}

export class HardwareTicketItemDto {
    /** Required unless the item is written by hand. */
    @ValidateIf((o: HardwareTicketItemDto) => o.manualName === undefined || o.catalogId !== undefined)
    @IsUUID()
    @Validate(CatalogOrManual)
    catalogId?: string;

    @IsOptional()
    @Transform(trim)
    @IsString()
    @Length(HARDWARE_TICKET_LIMITS.manualNameMin, HARDWARE_TICKET_LIMITS.nameMax)
    manualName?: string;

    @IsInt()
    @Min(1)
    @Max(HARDWARE_TICKET_LIMITS.quantityMax)
    quantity: number;

    @IsOptional()
    @IsString()
    @MaxLength(HARDWARE_TICKET_LIMITS.noteMax)
    note?: string;

    @IsOptional()
    @IsObject()
    @Validate(ItemFieldValues)
    fields?: Record<string, string | number>;

    /** Who this item is for, when the request has several recipients. */
    @IsOptional()
    @Transform(trim)
    @IsString()
    @Length(1, HARDWARE_TICKET_LIMITS.nameMax)
    recipientName?: string;
}

export class CreateHardwareTicketDto {
    @Transform(trim)
    @IsString()
    @Length(HARDWARE_TICKET_LIMITS.titleMin, HARDWARE_TICKET_LIMITS.titleMax)
    title: string;

    @Transform(trim)
    @IsString()
    @Length(1, HARDWARE_TICKET_LIMITS.justificationMax)
    justification: string;

    /** Recipient's division; defaults to the requester's department on the form. */
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    @MaxLength(HARDWARE_TICKET_LIMITS.divisionMax)
    division: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(HARDWARE_TICKET_LIMITS.recipientsMax)
    @Transform(trimEach)
    @IsString({ each: true })
    @Length(1, HARDWARE_TICKET_LIMITS.nameMax, { each: true })
    recipients: string[];

    /** The manager the requester proposes; IT decides the route during review. */
    @IsOptional()
    @IsUUID()
    managerId?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(HARDWARE_TICKET_LIMITS.itemsMax)
    @ValidateNested({ each: true })
    @Type(() => HardwareTicketItemDto)
    items: HardwareTicketItemDto[];

    @IsString()
    @MaxLength(HARDWARE_TICKET_LIMITS.signatureMaxChars)
    @Matches(PNG_DATA_URL, { message: 'Tanda tangan harus gambar PNG' })
    signatureData: string;
}
