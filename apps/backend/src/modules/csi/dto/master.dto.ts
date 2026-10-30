import { Transform, Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min, ValidateIf, ValidateNested,
    ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, Validate,
} from 'class-validator';
import { CSI_OPTION_LABEL_MAX, CsiQuestionType } from '../csi.constants';
import { INVALID_OPTIONS_MESSAGE, optionsMatchType } from '../csi-question.util';

const NAME_MAX_LENGTH = 100;
const QUESTION_MAX_LENGTH = 300;
const DESCRIPTION_MAX_LENGTH = 300;
export const SHORT_LABEL_MAX_LENGTH = 40;
export const DEFAULT_USER_SEARCH_LIMIT = 20;
export const MAX_USER_SEARCH_LIMIT = 50;
const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const isProvided = (_object: unknown, value: unknown) => value !== undefined;

/**
 * Options must fit the question type. Create checks against the given type (options default to []); a partial
 * update only checks here when it carries a type, otherwise the service re-checks against the stored row.
 */
@ValidatorConstraint({ name: 'csiOptionsMatchType', async: false })
class OptionsMatchTypeConstraint implements ValidatorConstraintInterface {
    validate(options: unknown, args: ValidationArguments): boolean {
        const { type } = args.object as { type?: CsiQuestionType };
        if (type === undefined || !Object.values(CsiQuestionType).includes(type)) return true;
        return optionsMatchType(type, options ?? []);
    }

    defaultMessage(): string {
        return INVALID_OPTIONS_MESSAGE;
    }
}

export class CsiOptionDto {
    @Transform(trimString)
    @IsString({ message: 'Label pilihan harus berupa teks' })
    @Length(1, CSI_OPTION_LABEL_MAX, { message: 'Label pilihan harus terdiri dari 1–200 karakter' })
    label: string;

    @ValidateIf((_object, value) => value !== null)
    @IsInt({ message: 'Poin pilihan harus berupa bilangan bulat' })
    points: number | null;
}

export class CreateDepartmentDto {
    @Transform(trimString)
    @IsString({ message: 'Nama harus berupa teks' })
    @Length(1, NAME_MAX_LENGTH, { message: 'Nama harus terdiri dari 1–100 karakter' })
    name: string;

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;
}

export class UpdateDepartmentDto {
    @ValidateIf(isProvided)
    @Transform(trimString)
    @IsString({ message: 'Nama harus berupa teks' })
    @Length(1, NAME_MAX_LENGTH, { message: 'Nama harus terdiri dari 1–100 karakter' })
    name?: string;

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;
}

export class CreateDimensionDto {
    @Transform(trimString)
    @IsString({ message: 'Pertanyaan harus berupa teks' })
    @Length(1, QUESTION_MAX_LENGTH, { message: 'Pertanyaan harus terdiri dari 1–300 karakter' })
    name: string;

    @IsOptional()
    @IsString({ message: 'Deskripsi harus berupa teks' })
    @MaxLength(DESCRIPTION_MAX_LENGTH, { message: 'Deskripsi maksimal 300 karakter' })
    description?: string | null;

    /** Short label for reports; blank/null falls back to the full question text. */
    @IsOptional()
    @Transform(trimString)
    @IsString({ message: 'Label singkat harus berupa teks' })
    @MaxLength(SHORT_LABEL_MAX_LENGTH, { message: 'Label singkat maksimal 40 karakter' })
    shortLabel?: string | null;

    @IsEnum(CsiQuestionType, { message: 'Jenis pertanyaan tidak valid' })
    type: CsiQuestionType;

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Wajib diisi harus berupa boolean' })
    required?: boolean;

    // Omitted options mean "no options"; the type rule still applies (a SCALE without options is rejected).
    @Validate(OptionsMatchTypeConstraint)
    @IsArray({ message: INVALID_OPTIONS_MESSAGE })
    @ValidateNested({ each: true })
    @Type(() => CsiOptionDto)
    options?: CsiOptionDto[] = [];

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;
}

export class UpdateDimensionDto {
    @ValidateIf(isProvided)
    @Transform(trimString)
    @IsString({ message: 'Pertanyaan harus berupa teks' })
    @Length(1, QUESTION_MAX_LENGTH, { message: 'Pertanyaan harus terdiri dari 1–300 karakter' })
    name?: string;

    @IsOptional()
    @IsString({ message: 'Deskripsi harus berupa teks' })
    @MaxLength(DESCRIPTION_MAX_LENGTH, { message: 'Deskripsi maksimal 300 karakter' })
    description?: string | null;

    /** Short label for reports; blank/null falls back to the full question text. */
    @IsOptional()
    @Transform(trimString)
    @IsString({ message: 'Label singkat harus berupa teks' })
    @MaxLength(SHORT_LABEL_MAX_LENGTH, { message: 'Label singkat maksimal 40 karakter' })
    shortLabel?: string | null;

    @ValidateIf(isProvided)
    @IsEnum(CsiQuestionType, { message: 'Jenis pertanyaan tidak valid' })
    type?: CsiQuestionType;

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Wajib diisi harus berupa boolean' })
    required?: boolean;

    @Validate(OptionsMatchTypeConstraint)
    @ValidateIf(isProvided)
    @IsArray({ message: INVALID_OPTIONS_MESSAGE })
    @ValidateNested({ each: true })
    @Type(() => CsiOptionDto)
    options?: CsiOptionDto[];

    @ValidateIf(isProvided)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;
}

export class ReorderDto {
    @IsArray({ message: 'Urutan harus berupa array' })
    @IsUUID('all', { each: true, message: 'ID harus berupa UUID' })
    ids: string[];
}

export class AddRatersDto {
    @IsArray({ message: 'Daftar pengguna harus berupa array' })
    @IsUUID('all', { each: true, message: 'ID pengguna harus berupa UUID' })
    userIds: string[];
}

export class MasterListQueryDto {
    @ValidateIf(isProvided)
    @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
    @IsBoolean({ message: 'includeInactive harus berupa boolean' })
    includeInactive?: boolean;
}

export class UserSearchQueryDto {
    @ValidateIf(isProvided)
    @IsString({ message: 'Pencarian harus berupa teks' })
    search?: string;

    @ValidateIf(isProvided)
    @Transform(({ value }) => Math.min(Number(value), MAX_USER_SEARCH_LIMIT))
    @IsInt({ message: 'Batas hasil harus berupa bilangan bulat' })
    @Min(1, { message: 'Batas hasil minimal 1' })
    limit?: number;
}
