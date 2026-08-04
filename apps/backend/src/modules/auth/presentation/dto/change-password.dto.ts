import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_POLICY } from '../../application/password-policy';

const { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH } = PASSWORD_POLICY;

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ description: 'New password', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    @IsString()
    @MinLength(PASSWORD_MIN_LENGTH)
    @MaxLength(PASSWORD_MAX_LENGTH)
    newPassword: string;
}
