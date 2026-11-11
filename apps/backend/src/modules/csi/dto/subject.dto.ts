import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { CsiTeamKind } from '../csi.constants';

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

/** Custom team and member names use the full csi_teams / csi_team_members column (150). */
export const CSI_CUSTOM_TEAM_NAME_MAX = 150;
export const CSI_TEAM_MEMBERS_MAX = 200;
const HC_SERVICE_CODES = ['HCD', 'HCC', 'HCS'];
const SERVICE_CODE_MESSAGE = 'Layanan harus HCD, HCC atau HCS';
const TEAM_NAME_MESSAGE = 'Nama tim harus terdiri dari 1–150 karakter';

/** SITE (default, idempotent per site) or CUSTOM (HC only; name + serviceCode required, checked in the service). */
export class CreateTeamDto {
    @IsUUID('all', { message: 'Site harus berupa UUID' })
    siteId: string;

    @IsOptional()
    @IsIn(Object.values(CsiTeamKind), { message: 'Jenis tim harus SITE atau CUSTOM' })
    kind?: CsiTeamKind;

    @IsOptional()
    @Transform(trimString)
    @IsString({ message: 'Nama tim harus berupa teks' })
    @Length(1, CSI_CUSTOM_TEAM_NAME_MAX, { message: TEAM_NAME_MESSAGE })
    name?: string;

    @IsOptional()
    @IsIn(HC_SERVICE_CODES, { message: SERVICE_CODE_MESSAGE })
    serviceCode?: string;
}

export class UpdateTeamDto {
    @IsOptional()
    @Transform(trimString)
    @IsString({ message: 'Nama tim harus berupa teks' })
    @Length(1, CSI_CUSTOM_TEAM_NAME_MAX, { message: TEAM_NAME_MESSAGE })
    name?: string;

    @IsOptional()
    @IsIn(HC_SERVICE_CODES, { message: SERVICE_CODE_MESSAGE })
    serviceCode?: string;
}

/** An account member (userId) or a named member without account (name). */
export class TeamMemberDto {
    @IsOptional()
    @IsUUID('all', { message: 'ID pengguna harus berupa UUID' })
    userId?: string;

    @IsOptional()
    @Transform(trimString)
    @IsString({ message: 'Nama anggota harus berupa teks' })
    @Length(1, CSI_CUSTOM_TEAM_NAME_MAX, { message: 'Nama anggota harus terdiri dari 1–150 karakter' })
    name?: string;
}

export class SetTeamMembersDto {
    @IsArray({ message: 'Daftar anggota harus berupa array' })
    @ArrayMaxSize(CSI_TEAM_MEMBERS_MAX, { message: 'Maksimal 200 anggota' })
    @ValidateNested({ each: true })
    @Type(() => TeamMemberDto)
    members: TeamMemberDto[];
}
