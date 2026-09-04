import { IsString, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Fields a user may change on their own profile.
 *
 * Deliberately narrower than UpdateUserDto: with the global ValidationPipe
 * running `forbidNonWhitelisted`, anything absent here is rejected with 400
 * rather than reaching the repository. That is what stops a user from
 * self-assigning `role`, `siteId` or `isActive` through PATCH /users/me.
 *
 * Email is NOT here — it is a login credential and changes through
 * PATCH /users/me/email, which requires the current password.
 */
export class UpdateProfileDto {
    @ApiPropertyOptional({ description: 'Full name' })
    @IsString()
    @IsOptional()
    fullName?: string;

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
    @Transform(({ value }) => (value === '' ? null : value))
    departmentId?: string | null;
}
