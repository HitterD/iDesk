import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
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

    // NOTE: `role` is deliberately absent. This endpoint is a public entrypoint
    // (docs/api-route-inventory.md), so a caller-supplied role would let anyone
    // mint an ADMIN account. Self-registration always yields UserRole.USER;
    // elevation goes through the admin-only POST /users and PATCH /users/:id/role.
    // `forbidNonWhitelisted` (main.ts:192) rejects the field outright if sent.
}
