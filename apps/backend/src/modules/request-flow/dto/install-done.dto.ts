import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { HARDWARE_TICKET_LIMITS, PNG_DATA_URL } from './create-hardware-ticket.dto';

export const ASSET_CODE_MIN = 4;
export const ASSET_CODE_MAX = 128;
export const PHOTO_URL_MAX = 500;
/** A photo is an https URL or a file kept under this server's uploads (no `..`, no protocol-relative paths). */
export const PHOTO_URL = /^(https:\/\/[^\s]+|\/uploads\/(?!.*\.\.)[^\s]+)$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** The asset code (barcode / serial) of one installed unit. */
export class InstallAssetDto {
    @IsUUID()
    itemId: string;

    @Transform(trim) @IsString() @Length(ASSET_CODE_MIN, ASSET_CODE_MAX)
    @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Kode aset hanya boleh huruf, angka, - dan _' })
    code: string;
}

/** The technician's report: one asset code per unit, the technician's signature and, optionally, a photo of the result. */
export class InstallDoneDto {
    /** Empty only for a redo where every unit already has its asset; the service refuses an empty list on a first report. */
    @IsArray() @ArrayMaxSize(HARDWARE_TICKET_LIMITS.itemsMax * HARDWARE_TICKET_LIMITS.quantityMax)
    @ValidateNested({ each: true }) @Type(() => InstallAssetDto)
    assets: InstallAssetDto[];

    @IsString()
    @MaxLength(HARDWARE_TICKET_LIMITS.signatureMaxChars)
    @Matches(PNG_DATA_URL, { message: 'Tanda tangan harus gambar PNG' })
    signatureData: string;

    @IsOptional() @IsString() @MaxLength(PHOTO_URL_MAX) @Matches(PHOTO_URL, { message: 'Foto harus berupa URL https atau berkas di /uploads' })
    photoUrl?: string;
}
