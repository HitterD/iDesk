import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

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

export class CreatePeriodFromTemplateDto {
    @IsString() @Length(3, NAME_MAX, { message: 'Judul 3-150 karakter' })
    title: string;

    @IsDateString({ strict: true }, { message: 'Tanggal mulai tidak valid' }) @Matches(DATE_ONLY, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
    startDate: string;

    @IsDateString({ strict: true }, { message: 'Tanggal selesai tidak valid' }) @Matches(DATE_ONLY, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
    endDate: string;
}
