import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CSI_COMMENT_MAX, CSI_SCORE_MAX, CSI_SCORE_MIN } from '../csi.constants';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const isProvided = (_object: object, value: unknown) => value !== undefined;
const SCORE_MESSAGE = `Nilai harus berupa bilangan bulat ${CSI_SCORE_MIN}–${CSI_SCORE_MAX}`;

export class SubmitItemDto {
    @IsUUID('all', { message: 'ID dimensi penilaian harus berupa UUID' })
    periodRateeDimensionId: string;

    @IsInt({ message: SCORE_MESSAGE })
    @Min(CSI_SCORE_MIN, { message: SCORE_MESSAGE })
    @Max(CSI_SCORE_MAX, { message: SCORE_MESSAGE })
    score: number;
}

export class SubmitCommentDto {
    @IsUUID('all', { message: 'ID orang yang dinilai harus berupa UUID' })
    periodRateeId: string;

    @Transform(trimString)
    @IsString({ message: 'Komentar harus berupa teks' })
    @MaxLength(CSI_COMMENT_MAX, { message: `Komentar maksimal ${CSI_COMMENT_MAX} karakter` })
    comment: string;
}

export class SubmitResponseDto {
    @IsUUID('all', { message: 'Departemen harus berupa UUID' })
    departmentId: string;

    @IsArray({ message: 'Daftar nilai harus berupa array' })
    @ValidateNested({ each: true })
    @Type(() => SubmitItemDto)
    items: SubmitItemDto[];

    @ValidateIf(isProvided)
    @IsArray({ message: 'Daftar komentar harus berupa array' })
    @ValidateNested({ each: true })
    @Type(() => SubmitCommentDto)
    comments?: SubmitCommentDto[];
}
