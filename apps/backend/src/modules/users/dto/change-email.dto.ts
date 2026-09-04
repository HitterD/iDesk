import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Changing an email means changing a login credential, so the current password
 * is required — a hijacked session alone must not be enough to take over the
 * account by moving its email.
 */
export class ChangeEmailDto {
    @ApiProperty({ description: 'New email address' })
    @IsEmail()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    newEmail: string;

    @ApiProperty({ description: 'Current password, for confirmation' })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;
}
