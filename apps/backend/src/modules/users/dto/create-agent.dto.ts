import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_POLICY } from '../../auth/application/password-policy';

const { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH } = PASSWORD_POLICY;

export class CreateAgentDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` })
    @MaxLength(PASSWORD_MAX_LENGTH, { message: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters` })
    password: string;
}
