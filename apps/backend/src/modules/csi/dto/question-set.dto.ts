import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, Length } from 'class-validator';

const NAME_MAX_LENGTH = 100;
const QUESTIONS_MAX = 100;
const trimString = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class QuestionSetDto {
    @Transform(trimString)
    @IsString({ message: 'Nama set harus berupa teks' })
    @Length(1, NAME_MAX_LENGTH, { message: 'Nama set harus terdiri dari 1–100 karakter' })
    name: string;

    @IsArray({ message: 'Daftar pertanyaan harus berupa array' })
    @ArrayMinSize(1, { message: 'Pilih minimal satu pertanyaan' })
    @ArrayMaxSize(QUESTIONS_MAX, { message: `Maksimal ${QUESTIONS_MAX} pertanyaan` })
    @IsUUID('all', { each: true, message: 'ID pertanyaan harus berupa UUID' })
    dimensionIds: string[];
}
