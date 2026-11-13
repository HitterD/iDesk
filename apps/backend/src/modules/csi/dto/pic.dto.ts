import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpdatePicDto {
    @IsOptional()
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;

    @ValidateIf((_dto, value) => value !== undefined && value !== null)
    @IsString({ message: 'Fungsi pelayanan harus berupa teks' })
    @MaxLength(150, { message: 'Fungsi pelayanan maksimal 150 karakter' })
    serviceFunction?: string | null;

    /** Linked iDesk account id; null unlinks the account. */
    @ValidateIf((_dto, value) => value !== undefined && value !== null)
    @IsUUID('all', { message: 'ID akun iDesk harus berupa UUID' })
    userId?: string | null;

    /** Renames the PIC master (template rows and draft survey snapshots follow; see CsiPicRenameService). */
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value))
    @IsString({ message: 'Nama PIC harus berupa teks' })
    @Length(2, 150, { message: 'Nama PIC harus terdiri dari 2–150 karakter' })
    fullName?: string;
}
