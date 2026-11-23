import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

/** The service checks the format and uniqueness; this only bounds the input. */
export class DocumentNumberDto {
    @IsString() @MaxLength(100)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    value: string;
}
