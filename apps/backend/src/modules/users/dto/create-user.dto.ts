import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsBoolean, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize, NormalizeEmail } from '../../../shared/core/validators/input-sanitizer';
import { PASSWORD_POLICY } from '../../auth/application/password-policy';

const { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH } = PASSWORD_POLICY;

export class CreateUserDto {
    @ApiProperty({ example: 'john.doe@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty()
    @MaxLength(255)
    @NormalizeEmail()
    email: string;

    @ApiProperty({ example: 'John Doe', minLength: 2, maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MinLength(2, { message: 'Full name must be at least 2 characters' })
    @MaxLength(100, { message: 'Full name cannot exceed 100 characters' })
    @Sanitize({ removeHtml: true })
    @Matches(/^[a-zA-Z\s\-'\.]+$/, { message: 'Full name can only contain letters, spaces, hyphens, apostrophes and periods' })
    fullName: string;

    @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
    @IsEnum(UserRole, { message: 'Role must be ADMIN, AGENT, or USER' })
    @IsNotEmpty()
    role: UserRole;

    @ApiPropertyOptional({ example: 'Password123!', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    @IsString()
    @IsOptional()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
    @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters` })
    password?: string;

    @ApiPropertyOptional({ example: 'dept-uuid-here' })
    @IsUUID('4', { message: 'Department ID must be a valid UUID' })
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ example: 'site-uuid-here', description: 'Site/Location ID' })
    @IsUUID('4', { message: 'Site ID must be a valid UUID' })
    @IsOptional()
    siteId?: string;

    @ApiPropertyOptional({ example: 'preset-uuid-here', description: 'Permission preset ID' })
    @IsUUID('4', { message: 'Preset ID must be a valid UUID' })
    @IsOptional()
    presetId?: string;

    @ApiPropertyOptional({ example: true, description: 'If true, password field is ignored and a random password is generated.' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    autoGeneratePassword?: boolean;
}
