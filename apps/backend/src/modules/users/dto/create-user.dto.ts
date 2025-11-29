import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsBoolean, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize, NormalizeEmail } from '../../../shared/core/validators/input-sanitizer';

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

    @ApiPropertyOptional({ example: 'Password123!', minLength: 8, maxLength: 72 })
    @IsString()
    @IsOptional()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
    password?: string;

    @ApiPropertyOptional({ example: 'dept-uuid-here' })
    @IsUUID('4', { message: 'Department ID must be a valid UUID' })
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ example: true, description: 'If true, password field is ignored and a random password is generated.' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    autoGeneratePassword?: boolean;
}
