import { IsString, IsOptional, IsEnum, IsUUID, IsEmail, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'Email address' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'Full name' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ description: 'User role', enum: UserRole })
    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @ApiPropertyOptional({ description: 'Employee ID' })
    @IsString()
    @IsOptional()
    employeeId?: string;

    @ApiPropertyOptional({ description: 'Job title' })
    @IsString()
    @IsOptional()
    jobTitle?: string;

    @ApiPropertyOptional({ description: 'Phone number' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Department ID' })
    @IsUUID()
    @IsOptional()
    departmentId?: string;

    @ApiPropertyOptional({ description: 'Account active status' })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

