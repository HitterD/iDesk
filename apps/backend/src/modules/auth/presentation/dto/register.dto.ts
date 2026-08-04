import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../../users/enums/user-role.enum';
import { PASSWORD_POLICY } from '../../application/password-policy';

const { minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH } = PASSWORD_POLICY;

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(PASSWORD_MIN_LENGTH)
    @MaxLength(PASSWORD_MAX_LENGTH)
    password: string;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsEnum(UserRole)
    @IsNotEmpty()
    role: UserRole;
}
