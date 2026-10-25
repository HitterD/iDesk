import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { CsiRespondentMode } from '../csi.constants';

const TITLE_MAX_LENGTH = 150;
const TEXT_MAX_LENGTH = 2000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const isProvided = (_object: object, value: unknown) => value !== undefined;

class PeriodFieldsDto {
    @ValidateIf(isProvided)
    @Transform(trimString)
    @IsString({ message: 'Judul harus berupa teks' })
    @Length(1, TITLE_MAX_LENGTH, { message: 'Judul harus terdiri dari 1–150 karakter' })
    title?: string;

    @ValidateIf(isProvided)
    @IsString({ message: 'Kalimat intro harus berupa teks' })
    @MaxLength(TEXT_MAX_LENGTH, { message: 'Kalimat intro maksimal 2000 karakter' })
    intro?: string;

    @ValidateIf(isProvided)
    @IsString({ message: 'Kalimat terima kasih harus berupa teks' })
    @MaxLength(TEXT_MAX_LENGTH, { message: 'Kalimat terima kasih maksimal 2000 karakter' })
    thankYou?: string;

    @ValidateIf(isProvided)
    @IsEnum(CsiRespondentMode, { message: 'Mode responden tidak valid' })
    respondentMode?: CsiRespondentMode;
}

export class CreatePeriodDto extends PeriodFieldsDto {
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId: string;

    @IsDateString({ strict: true }, { message: 'Tanggal mulai tidak valid' })
    @Matches(DATE_ONLY, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
    startDate: string;

    @IsDateString({ strict: true }, { message: 'Tanggal selesai tidak valid' })
    @Matches(DATE_ONLY, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
    endDate: string;

    @ValidateIf(isProvided)
    @IsUUID('all', { message: 'Periode sumber harus berupa UUID' })
    copyFromPeriodId?: string;
}

export class UpdatePeriodDto extends PeriodFieldsDto {
    @ValidateIf(isProvided)
    @IsDateString({ strict: true }, { message: 'Tanggal mulai tidak valid' })
    @Matches(DATE_ONLY, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
    startDate?: string;

    @ValidateIf(isProvided)
    @IsDateString({ strict: true }, { message: 'Tanggal selesai tidak valid' })
    @Matches(DATE_ONLY, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
    endDate?: string;
}

export class RateeAssignmentDto {
    @IsUUID('all', { message: 'ID pengguna harus berupa UUID' })
    userId: string;

    @IsArray({ message: 'Daftar dimensi harus berupa array' })
    @ArrayMinSize(1, { message: 'Setiap orang yang dinilai wajib memiliki minimal satu dimensi' })
    @IsUUID('all', { each: true, message: 'ID dimensi harus berupa UUID' })
    dimensionIds: string[];
}

export class SetRateesDto {
    @IsArray({ message: 'Daftar orang yang dinilai harus berupa array' })
    @ValidateNested({ each: true })
    @Type(() => RateeAssignmentDto)
    ratees: RateeAssignmentDto[];
}

export class SetPeriodRatersDto {
    @IsArray({ message: 'Daftar pengguna harus berupa array' })
    @IsUUID('all', { each: true, message: 'ID pengguna harus berupa UUID' })
    userIds: string[];
}

export class PeriodListQueryDto {
    @ValidateIf(isProvided)
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId?: string;
}
