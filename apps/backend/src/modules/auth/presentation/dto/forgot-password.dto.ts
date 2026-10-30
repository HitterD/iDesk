import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const IDENTIFIER_MAX_LENGTH = 255;

export class ForgotPasswordDto {
    @ApiProperty({ description: 'NIK HRIS' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(IDENTIFIER_MAX_LENGTH)
    identifier: string;

    @ApiPropertyOptional({ description: 'Email registered on the account; must match the NIK' })
    @IsOptional()
    @IsEmail()
    @MaxLength(IDENTIFIER_MAX_LENGTH)
    email?: string;
}
