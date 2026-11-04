import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CSI_CANCEL_REASON_MAX, CSI_CANCEL_REASON_MIN, CsiPairMode, CsiRespondentMode } from '../csi.constants';
import { CSI_TAGLINE_MAX } from './subject.dto';

const TITLE_MAX_LENGTH = 150;
const TEXT_MAX_LENGTH = 2000;
const TEAM_LABEL_MAX_LENGTH = 100;
const SITES_MAX = 20;
const SLA_TARGET_MIN = 1;
const SLA_TARGET_MAX = 100;
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

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Penilaian tim harus berupa boolean' })
    teamEnabled?: boolean;

    @ValidateIf(isProvided)
    @Transform(trimString)
    @IsString({ message: 'Label tim harus berupa teks' })
    @Length(1, TEAM_LABEL_MAX_LENGTH, { message: 'Label tim harus terdiri dari 1–100 karakter' })
    teamLabel?: string;

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Penilaian per orang harus berupa boolean' })
    individualEnabled?: boolean;

    @ValidateIf(isProvided)
    @IsInt({ message: 'Target SLA harus berupa bilangan bulat' })
    @Min(SLA_TARGET_MIN, { message: 'Target SLA minimal 1' })
    @Max(SLA_TARGET_MAX, { message: 'Target SLA maksimal 100' })
    slaTargetPct?: number;
}

const siteIdsRules = (): PropertyDecorator => (target, key) => [
    IsArray({ message: 'Daftar site harus berupa array' }),
    ArrayMinSize(1, { message: 'Pilih minimal satu site' }),
    ArrayMaxSize(SITES_MAX, { message: 'Maksimal 20 site' }),
    ArrayUnique(undefined, { message: 'Site tidak boleh duplikat' }),
    IsUUID('all', { each: true, message: 'Site harus berupa UUID' }),
].forEach((decorator) => decorator(target, key));

export class CreatePeriodDto extends PeriodFieldsDto {
    // Optional only when copying: the sites then default to the source period's sites.
    @ValidateIf((object: CreatePeriodDto) => object.copyFromPeriodId === undefined || object.siteIds !== undefined)
    @siteIdsRules()
    siteIds?: string[];

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
    @siteIdsRules()
    siteIds?: string[];

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

export class SetTeamQuestionsDto {
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId: string;

    @IsArray({ message: 'Daftar pertanyaan harus berupa array' })
    @IsUUID('all', { each: true, message: 'ID pertanyaan harus berupa UUID' })
    questionIds: string[];
}

/** Per-period override of one ratee; null/'' tagline and null photoUrl reset to the master value. */
export class UpdatePeriodRateeDto {
    @ValidateIf(isProvided)
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId?: string;

    /** Only null (reset) is accepted: per-period photo upload is not part of this endpoint. */
    @ValidateIf(isProvided)
    @Equals(null, { message: 'Foto hanya bisa direset (null)' })
    photoUrl?: null;

    @ValidateIf((_object: object, value: unknown) => value !== undefined && value !== null)
    @Transform(trimString)
    @IsString({ message: 'Tagline harus berupa teks' })
    @MaxLength(CSI_TAGLINE_MAX, { message: 'Tagline maksimal 90 karakter' })
    tagline?: string | null;
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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const toList = ({ value }: { value: unknown }) => (Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',') : []);

/** Live date-clash check of the survey info form (`?siteIds=a,b&startDate=&endDate=&excludeId=`). */
export class PeriodOverlapQueryDto {
    @Transform(toList)
    @IsArray({ message: 'Site harus berupa daftar' })
    @IsUUID('all', { each: true, message: 'Site harus berupa UUID' })
    siteIds: string[];

    @Matches(DATE_ONLY_PATTERN, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
    startDate: string;

    @Matches(DATE_ONLY_PATTERN, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
    endDate: string;

    @IsOptional()
    @IsUUID('all', { message: 'ID survei harus berupa UUID' })
    excludeId?: string;
}

/** Double confirmation of cancel / permanent delete: the survey title retyped and a reason (audit log). */
export class ConfirmPeriodActionDto {
    @IsString({ message: 'Ketik ulang judul survei' })
    @MaxLength(300, { message: 'Judul terlalu panjang' })
    confirmTitle: string;

    @IsString({ message: 'Alasan wajib diisi' })
    @Length(CSI_CANCEL_REASON_MIN, CSI_CANCEL_REASON_MAX, { message: `Alasan harus ${CSI_CANCEL_REASON_MIN}–${CSI_CANCEL_REASON_MAX} karakter` })
    reason: string;
}

export class SetPairModeDto {
    @IsEnum(CsiPairMode, { message: 'Mode penilaian tidak valid' })
    mode: CsiPairMode;
}
