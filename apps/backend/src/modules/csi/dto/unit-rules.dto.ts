import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CsiOrgLocation } from '../org/csi-org.constants';

const TEXT_MAX = 150;
const RULES_MAX = 200;
const PICS_MAX = 500;

export class CsiUnitRuleDto {
    @IsString({ message: 'Divisi wajib diisi' })
    @MaxLength(TEXT_MAX)
    division: string;

    @IsOptional() @IsString() @MaxLength(TEXT_MAX)
    department?: string | null;

    @IsOptional() @IsString() @MaxLength(TEXT_MAX)
    bagian?: string | null;

    @IsOptional() @IsEnum(CsiOrgLocation, { message: 'Lokasi tidak valid' })
    location?: CsiOrgLocation | null;

    @IsString({ message: 'Layanan wajib diisi' })
    @MaxLength(10)
    serviceCode: string;

    @IsOptional() @IsString() @MaxLength(TEXT_MAX)
    picBagian?: string | null;

    @IsOptional() @IsArray() @ArrayMaxSize(PICS_MAX) @IsUUID('all', { each: true })
    picIds?: string[] | null;
}

export class SetUnitRulesDto {
    @IsArray({ message: 'Daftar aturan harus berupa array' })
    @ArrayMaxSize(RULES_MAX, { message: 'Maksimal 200 aturan' })
    @ValidateNested({ each: true })
    @Type(() => CsiUnitRuleDto)
    rules: CsiUnitRuleDto[];
}

export class SetRaterPicsDto {
    @IsArray({ message: 'Daftar PIC harus berupa array' })
    @ArrayMaxSize(PICS_MAX, { message: 'Maksimal 500 PIC' })
    @IsUUID('all', { each: true, message: 'ID PIC harus berupa UUID' })
    periodRateeIds: string[];
}
