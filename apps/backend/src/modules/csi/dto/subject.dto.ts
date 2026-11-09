import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length, MaxLength, ValidateIf } from 'class-validator';

export const CSI_TAGLINE_MAX = 90;
export const CSI_JOB_TITLE_MAX = 150;
export const CSI_TEAM_NAME_MAX = 100;

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
/** Optional + nullable: validate only when a non-null value is sent (null clears the field). */
const isSet = (_object: object, value: unknown) => value !== undefined && value !== null;

export class UpdateSubjectDto {
    @ValidateIf(isSet)
    @Transform(trimString)
    @IsString({ message: 'Tagline harus berupa teks' })
    @MaxLength(CSI_TAGLINE_MAX, { message: 'Tagline maksimal 90 karakter' })
    tagline?: string | null;

    @ValidateIf(isSet)
    @Transform(trimString)
    @IsString({ message: 'Jabatan harus berupa teks' })
    @MaxLength(CSI_JOB_TITLE_MAX, { message: 'Jabatan maksimal 150 karakter' })
    jobTitle?: string | null;

    @ValidateIf(isSet)
    @Transform(trimString)
    @IsString({ message: 'Fungsi pelayanan harus berupa teks' })
    @MaxLength(CSI_JOB_TITLE_MAX, { message: 'Fungsi pelayanan maksimal 150 karakter' })
    serviceFunction?: string | null;

    /** Team subjects only. */
    @ValidateIf((_object: object, value: unknown) => value !== undefined)
    @Transform(trimString)
    @IsString({ message: 'Nama tim harus berupa teks' })
    @Length(1, CSI_TEAM_NAME_MAX, { message: 'Nama tim harus terdiri dari 1–100 karakter' })
    name?: string;
}

export class CreateTeamDto {
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId: string;
}
