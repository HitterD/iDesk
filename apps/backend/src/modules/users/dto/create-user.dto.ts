import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'john.doe@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
    @IsEnum(UserRole)
    @IsNotEmpty()
    role: UserRole;

    @ApiProperty({ example: 'password123', required: false })
    @IsString()
    @IsOptional()
    @MinLength(6)
    password?: string;

    @ApiProperty({ example: 'dept-123', required: false })
    @IsString()
    @IsOptional()
    departmentId?: string;

    @ApiProperty({ example: true, description: 'If true, password field is ignored and a random password is generated.' })
    @IsOptional()
    autoGeneratePassword?: boolean;
}
