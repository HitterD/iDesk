import { ArrayMaxSize, IsArray, IsInt, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CSI_ITEMS_MAX } from '../csi.constants';

/**
 * In-progress respondent draft stored before submission.
 * Shape mirrors the frontend form state; CsiDraftService validates and bounds every nested key/value
 * against the period's eligible ratees, dimensions, and active departments.
 */
export class SaveDraftDto {
    @IsOptional()
    @IsUUID('all', { message: 'Departemen harus berupa UUID' })
    departmentId?: string | null;

    @IsOptional()
    @IsInt({ message: 'Posisi langkah tidak valid' })
    @Min(0, { message: 'Posisi langkah tidak valid' })
    @Max(CSI_ITEMS_MAX, { message: 'Posisi langkah tidak valid' })
    position?: number;

    @IsOptional()
    @IsObject({ message: 'Format jawaban draft tidak valid' })
    answers?: Record<string, Record<string, number | string>>;

    @IsOptional()
    @IsObject({ message: 'Format komentar draft tidak valid' })
    comments?: Record<string, string>;

    @IsOptional()
    @IsArray({ message: 'Daftar PIC terpilih harus berupa array' })
    @ArrayMaxSize(CSI_ITEMS_MAX, { message: `Daftar PIC maksimal ${CSI_ITEMS_MAX}` })
    @IsUUID('all', { each: true, message: 'ID PIC terpilih harus berupa UUID' })
    picks?: string[] | null;
}
