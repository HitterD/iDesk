import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdatePicDto {
    @IsOptional()
    @IsBoolean({ message: 'Status aktif harus berupa boolean' })
    isActive?: boolean;

    @ValidateIf((_dto, value) => value !== undefined && value !== null)
    @IsString({ message: 'Fungsi pelayanan harus berupa teks' })
    @MaxLength(150, { message: 'Fungsi pelayanan maksimal 150 karakter' })
    serviceFunction?: string | null;
}
