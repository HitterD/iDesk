import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';

/** Codes are stored uppercase alphanumeric, so they can go straight into ticket numbers (`DDMMYY-CODE-0001`). */
export const DEPARTMENT_CODE_PATTERN = /^[A-Z0-9]{2,5}$/;

export class CreateDepartmentDto {
    @ApiProperty({ example: 'Information Technology' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    name: string;

    @ApiProperty({ example: 'IT', description: '2-5 letters/digits; spaces and symbols are stripped, letters uppercased' })
    @IsString()
    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : value))
    @Matches(DEPARTMENT_CODE_PATTERN, { message: 'Code must be 2-5 letters or digits' })
    code: string;
}
