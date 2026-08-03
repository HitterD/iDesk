import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({ example: 'Str0ng-Passw0rd', minLength: 8, maxLength: 72 })
    @IsString()
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
    newPassword: string;
}
