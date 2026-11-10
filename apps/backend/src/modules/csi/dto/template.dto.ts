import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, Validate, ValidateIf,
    ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const NAME_MAX = 150;
const SERVICE_CODES = ['HCC', 'HCD', 'HCS'];

export class AddTemplatePicDto {
    @IsIn(SERVICE_CODES, { message: 'Layanan harus HCC, HCD atau HCS' })
    serviceCode: string;

    @IsString() @Length(2, NAME_MAX, { message: 'Nama PIC 2-150 karakter' })
    picName: string;

    @IsOptional() @IsString() @MaxLength(NAME_MAX)
    jobTitle?: string | null;

    @IsOptional() @IsString() @MaxLength(NAME_MAX, { message: 'Fungsi pelayanan maksimal 150 karakter' })
    serviceFunction?: string | null;
}

export class UpdateTemplatePicDto {
    @ValidateIf((_dto, value) => value !== undefined && value !== null) @IsString() @MaxLength(NAME_MAX)
    jobTitle?: string | null;

    @ValidateIf((_dto, value) => value !== undefined && value !== null) @IsString() @MaxLength(NAME_MAX, { message: 'Fungsi pelayanan maksimal 150 karakter' })
    serviceFunction?: string | null;
}

export class AddTemplateRaterDto {
    @IsOptional() @IsString() @Length(2, NAME_MAX, { message: 'Nama penilai 2-150 karakter' })
    name?: string;

    @IsOptional() @IsUUID('all', { message: 'ID pengguna harus berupa UUID' })
    userId?: string;

    @IsOptional() @IsString() @MaxLength(NAME_MAX)
    jobTitle?: string | null;
}

export class SetTemplateRaterAccountDto {
    @ValidateIf((_dto, value) => value !== null) @IsUUID('all', { message: 'ID pengguna harus berupa UUID' })
    userId: string | null;
}

const MAX_BULK_RATERS = 2000;

class TemplateRaterSelectionDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_BULK_RATERS) @IsUUID('4', { each: true })
    raterIds: string[];
}

export class SetTemplateRaterAccountsDto extends TemplateRaterSelectionDto {
    @IsOptional() @IsUUID('4', { message: 'ID pengguna harus berupa UUID' })
    userId?: string | null;
}

export class ConfirmTemplateRatersDto extends TemplateRaterSelectionDto {
    @IsBoolean()
    confirmed: boolean;
}

const RESOLUTION_KINDS: ReadonlySet<unknown> = new Set(['team', 'pic', 'rename']);
const MAX_RESOLUTIONS = 500;

/** Admin decision for one unresolved PIC-column name (key of `resolutions`). */
export type PicResolutionInput = { as: 'team' | 'pic' | 'rename'; picName?: string };

const isResolution = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const { as, picName } = value as Record<string, unknown>;
    if (!RESOLUTION_KINDS.has(as)) return false;
    if (as !== 'rename') return picName === undefined || typeof picName === 'string';
    return typeof picName === 'string' && picName.trim().length >= 2 && picName.length <= NAME_MAX;
};

/** Keys are PIC names from the file; each value is `{ as }`, a rename also needs `picName`. */
@ValidatorConstraint({ name: 'csiTemplateResolutions', async: false })
class ResolutionMapConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const entries = Object.entries(value as Record<string, unknown>);
        return entries.length <= MAX_RESOLUTIONS && entries.every(([name, resolution]) => name.length <= NAME_MAX && isResolution(resolution));
    }

    defaultMessage(): string {
        return 'Resolusi PIC tidak valid';
    }
}

/** Multipart field `options` (JSON) of the template import. */
export class ImportOptionsDto {
    @IsOptional() @IsBoolean()
    commit?: boolean;

    @IsOptional() @Validate(ResolutionMapConstraint)
    resolutions?: Record<string, PicResolutionInput>;

    @IsOptional() @IsBoolean()
    prune?: boolean;

    @IsOptional() @IsBoolean()
    pruneConfirmed?: boolean;
}

export class CreatePeriodFromTemplateDto {
    @IsString() @Length(3, NAME_MAX, { message: 'Judul 3-150 karakter' })
    title: string;

    @IsDateString({ strict: true }, { message: 'Tanggal mulai tidak valid' }) @Matches(DATE_ONLY, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
    startDate: string;

    @IsDateString({ strict: true }, { message: 'Tanggal selesai tidak valid' }) @Matches(DATE_ONLY, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
    endDate: string;
}
