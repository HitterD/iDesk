import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const IDENTIFIER_MAX_LENGTH = 255;

export class ForgotPasswordDto {
    @ApiProperty({ description: 'NIK HRIS, or the registered email when the NIK is forgotten' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(IDENTIFIER_MAX_LENGTH)
    identifier: string;

    @ApiPropertyOptional({ description: 'Email that receives the temporary password (required when identifier is a NIK)' })
    @IsOptional()
    @IsEmail()
    @MaxLength(IDENTIFIER_MAX_LENGTH)
    email?: string;
}
