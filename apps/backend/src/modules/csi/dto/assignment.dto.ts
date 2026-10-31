import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsUUID, ValidateNested } from 'class-validator';

export const CSI_PAIRS_MAX = 5000;

export class AssignmentPairDto {
    @IsUUID('all', { message: 'Penilai harus berupa UUID' })
    periodRaterId: string;

    @IsUUID('all', { message: 'Subjek harus berupa UUID' })
    periodRateeId: string;
}

export class SetAssignmentsDto {
    @IsArray({ message: 'Daftar pasangan harus berupa array' })
    @ArrayMaxSize(CSI_PAIRS_MAX, { message: 'Maksimal 5000 pasangan' })
    @ValidateNested({ each: true })
    @Type(() => AssignmentPairDto)
    pairs: AssignmentPairDto[];
}
