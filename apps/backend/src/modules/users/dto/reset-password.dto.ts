import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_POLICY } from '../../auth/application/password-policy';

const { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH } = PASSWORD_POLICY;

export class ResetPasswordDto {
    @ApiProperty({ example: 'Str0ng-Passw0rd', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
    @IsString()
    @IsNotEmpty()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
    @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters` })
    newPassword: string;
}
