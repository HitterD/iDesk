import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CSI_ANSWER_TEXT_MAX, CSI_COMMENT_MAX, CSI_ITEMS_MAX, CSI_OPTIONS_MAX, CSI_RESPONDENT_NAME_MAX, CSI_RESPONDENT_NAME_MIN, CSI_SCORE_MAX, CSI_SCORE_MIN } from '../csi.constants';

const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const isProvided = (_object: object, value: unknown) => value !== undefined;
const SCORE_MESSAGE = `Nilai harus berupa bilangan bulat ${CSI_SCORE_MIN}–${CSI_SCORE_MAX}`;
const NAME_MESSAGE = `Nama harus ${CSI_RESPONDENT_NAME_MIN}–${CSI_RESPONDENT_NAME_MAX} karakter`;

/**
 * One answer. Which of score/optionIndex/text applies depends on the question type, which is only known
 * from the period snapshot, so the service enforces the per-type shape; the DTO only bounds each field.
 */
export class SubmitItemDto {
    @IsUUID('all', { message: 'ID dimensi penilaian harus berupa UUID' })
    periodRateeDimensionId: string;

    @IsOptional()
    @IsInt({ message: SCORE_MESSAGE })
    @Min(CSI_SCORE_MIN, { message: SCORE_MESSAGE })
    @Max(CSI_SCORE_MAX, { message: SCORE_MESSAGE })
    score?: number;

    @IsOptional()
    @IsInt({ message: 'Pilihan jawaban tidak valid' })
    @Min(0, { message: 'Pilihan jawaban tidak valid' })
    @Max(CSI_OPTIONS_MAX - 1, { message: 'Pilihan jawaban tidak valid' })
    optionIndex?: number;

    @IsOptional()
    @IsString({ message: 'Jawaban teks harus berupa teks' })
    @MaxLength(CSI_ANSWER_TEXT_MAX * 2, { message: `Jawaban teks maksimal ${CSI_ANSWER_TEXT_MAX} karakter` })
    text?: string;
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
    /** Ignored by the server (identity is the account's name); still bounded for older clients that send it. */
    @IsOptional()
    @Transform(trimString)
    @IsString({ message: NAME_MESSAGE })
    @Length(CSI_RESPONDENT_NAME_MIN, CSI_RESPONDENT_NAME_MAX, { message: NAME_MESSAGE })
    respondentName?: string;

    @IsUUID('all', { message: 'Departemen harus berupa UUID' })
    departmentId: string;

    @IsArray({ message: 'Daftar nilai harus berupa array' })
    @ArrayMaxSize(CSI_ITEMS_MAX, { message: `Daftar jawaban maksimal ${CSI_ITEMS_MAX}` })
    @ValidateNested({ each: true })
    @Type(() => SubmitItemDto)
    items: SubmitItemDto[];

    @ValidateIf(isProvided)
    @IsArray({ message: 'Daftar komentar harus berupa array' })
    @ValidateNested({ each: true })
    @Type(() => SubmitCommentDto)
    comments?: SubmitCommentDto[];
}
