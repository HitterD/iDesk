import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MaxLength, IsEmail, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMailSettingsDto {
    @ApiPropertyOptional({ description: 'Master switch for outgoing email' })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiProperty({ example: 'mail.kapalapi.co.id' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    host?: string;

    @ApiPropertyOptional({ example: 465 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiPropertyOptional({ description: 'true = implicit TLS (465)' })
    @IsOptional()
    @IsBoolean()
    secure?: boolean;

    @ApiPropertyOptional({ description: 'false = relay without auth' })
    @IsOptional()
    @IsBoolean()
    authRequired?: boolean;

    @ApiPropertyOptional({ example: 'noreply@kapalapi.co.id' })
    @IsOptional()
    @IsString()
    @MaxLength(320)
    username?: string;

    @ApiPropertyOptional({ description: 'SMTP password; omit/empty keeps existing' })
    @IsOptional()
    @IsString()
    @MaxLength(1024)
    password?: string;

    @ApiPropertyOptional({ example: '"iDesk" <noreply@kapalapi.co.id>' })
    @IsOptional()
    @IsString()
    @MaxLength(320)
    fromAddress?: string;

    @ApiPropertyOptional({
        description: 'SMTP MAIL FROM when the relay only accepts the login mailbox; empty = use From',
        example: 'noreply@kapalapi.co.id',
    })
    @IsOptional()
    @IsString()
    @MaxLength(320)
    envelopeFrom?: string;

    @ApiPropertyOptional({ description: 'Skip TLS cert verification (self-signed relays)' })
    @IsOptional()
    @IsBoolean()
    allowSelfSignedCert?: boolean;
}

export class TestMailDto {
    @ApiProperty({ example: 'admin@kapalapi.co.id' })
    @IsEmail()
    to!: string;
}

export class VerifyMailDto {
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) host?: string;
    @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
    @IsOptional() @IsBoolean() secure?: boolean;
    @IsOptional() @IsBoolean() authRequired?: boolean;
    @IsOptional() @IsString() @MaxLength(320) username?: string;
    @IsOptional() @IsString() @MaxLength(1024) password?: string;
    @IsOptional() @IsBoolean() allowSelfSignedCert?: boolean;
}
