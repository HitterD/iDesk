import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ description: 'New password', minLength: 8 })
    @IsString()
    @MinLength(8)
    newPassword: string;
}
