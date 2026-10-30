import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { cleanText } from '../services/csi-format.util';

const FIELD_MAX = 300;
const PARAGRAPH_MAX = 2000;
const PERIODS_MAX = 20;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const trimClean = ({ value }: { value: unknown }) => typeof value === 'string' ? cleanText(value).trim() : value;

export class MemoSignerDto {
    @Transform(trimClean)
    @IsString({ message: 'Nama penandatangan harus berupa teks' })
    @MaxLength(FIELD_MAX, { message: 'Nama penandatangan maksimal 300 karakter' })
    name: string;

    @Transform(trimClean)
    @IsString({ message: 'Jabatan penandatangan harus berupa teks' })
    @MaxLength(FIELD_MAX, { message: 'Jabatan penandatangan maksimal 300 karakter' })
    title: string;
}

export class MemoHeaderDto {
    @Transform(trimClean) @IsString({ message: 'Kepada harus berupa teks' }) @MaxLength(FIELD_MAX, { message: 'Kepada maksimal 300 karakter' })
    to: string;

    @Transform(trimClean) @IsString({ message: 'CC harus berupa teks' }) @MaxLength(FIELD_MAX, { message: 'CC maksimal 300 karakter' })
    cc: string;

    @Transform(trimClean) @IsString({ message: 'Nomor harus berupa teks' }) @MaxLength(FIELD_MAX, { message: 'Nomor maksimal 300 karakter' })
    number: string;

    @Transform(trimClean) @IsString({ message: 'Dari harus berupa teks' }) @MaxLength(FIELD_MAX, { message: 'Dari maksimal 300 karakter' })
    from: string;

    @Transform(trimClean) @IsString({ message: 'Perihal harus berupa teks' }) @MaxLength(FIELD_MAX, { message: 'Perihal maksimal 300 karakter' })
    subject: string;

    @IsDateString({ strict: true }, { message: 'Tanggal memo tidak valid' })
    @Matches(DATE_ONLY, { message: 'Tanggal memo harus berformat YYYY-MM-DD' })
    date: string;

    @Transform(trimClean) @IsString({ message: 'Paragraf pembuka harus berupa teks' }) @MaxLength(PARAGRAPH_MAX, { message: 'Paragraf pembuka maksimal 2000 karakter' })
    opening: string;

    @Transform(trimClean) @IsString({ message: 'Paragraf penutup harus berupa teks' }) @MaxLength(PARAGRAPH_MAX, { message: 'Paragraf penutup maksimal 2000 karakter' })
    closing: string;

    @ValidateNested() @Type(() => MemoSignerDto)
    signerLeft: MemoSignerDto;

    @ValidateNested() @Type(() => MemoSignerDto)
    signerRight: MemoSignerDto;
}

export class MemoRequestDto {
    @IsArray({ message: 'Daftar survei harus berupa array' })
    @ArrayMinSize(1, { message: 'Pilih minimal satu survei' })
    @ArrayMaxSize(PERIODS_MAX, { message: 'Maksimal 20 survei' })
    @ArrayUnique(undefined, { message: 'Survei tidak boleh duplikat' })
    @IsUUID('all', { each: true, message: 'ID survei harus berupa UUID' })
    periodIds: string[];

    @ValidateNested() @Type(() => MemoHeaderDto)
    header: MemoHeaderDto;
}
