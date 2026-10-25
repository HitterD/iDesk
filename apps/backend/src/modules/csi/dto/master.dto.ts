import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min, ValidateIf } from 'class-validator';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 300;
export const DEFAULT_USER_SEARCH_LIMIT = 20;
export const MAX_USER_SEARCH_LIMIT = 50;
const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateDepartmentDto {
    @Transform(trimString)
    @IsString({ message: 'Nama harus berupa teks' })
    @Length(1, NAME_MAX_LENGTH, { message: 'Nama harus terdiri dari 1–100 karakter' })
    name: string;

    @ValidateIf((_object, value) => value !== undefined)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;

    @ValidateIf((_object, value) => value !== undefined)
    @IsInt({ message: 'Urutan harus berupa bilangan bulat' })
    sortOrder?: number;
}

export class UpdateDepartmentDto {
    @ValidateIf((_object, value) => value !== undefined)
    @Transform(trimString)
    @IsString({ message: 'Nama harus berupa teks' })
    @Length(1, NAME_MAX_LENGTH, { message: 'Nama harus terdiri dari 1–100 karakter' })
    name?: string;

    @ValidateIf((_object, value) => value !== undefined)
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;

    @ValidateIf((_object, value) => value !== undefined)
    @IsInt({ message: 'Urutan harus berupa bilangan bulat' })
    sortOrder?: number;
}

export class CreateDimensionDto extends CreateDepartmentDto {
    @IsOptional()
    @IsString({ message: 'Deskripsi harus berupa teks' })
    @MaxLength(DESCRIPTION_MAX_LENGTH, { message: 'Deskripsi maksimal 300 karakter' })
    description?: string | null;
}

export class UpdateDimensionDto extends UpdateDepartmentDto {
    @IsOptional()
    @IsString({ message: 'Deskripsi harus berupa teks' })
    @MaxLength(DESCRIPTION_MAX_LENGTH, { message: 'Deskripsi maksimal 300 karakter' })
    description?: string | null;
}

export class AddRatersDto {
    @IsArray({ message: 'Daftar pengguna harus berupa array' })
    @IsUUID('all', { each: true, message: 'ID pengguna harus berupa UUID' })
    userIds: string[];
}

export class MasterListQueryDto {
    @ValidateIf((_object, value) => value !== undefined)
    @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
    @IsBoolean({ message: 'includeInactive harus berupa boolean' })
    includeInactive?: boolean;
}

export class UserSearchQueryDto {
    @ValidateIf((_object, value) => value !== undefined)
    @IsString({ message: 'Pencarian harus berupa teks' })
    search?: string;

    @ValidateIf((_object, value) => value !== undefined)
    @Transform(({ value }) => Math.min(Number(value), MAX_USER_SEARCH_LIMIT))
    @IsInt({ message: 'Batas hasil harus berupa bilangan bulat' })
    @Min(1, { message: 'Batas hasil minimal 1' })
    limit?: number;
}
