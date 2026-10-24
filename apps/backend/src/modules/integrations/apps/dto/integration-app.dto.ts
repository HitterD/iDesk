import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength,
} from 'class-validator';
import { Sanitize } from '../../../../shared/core/validators/input-sanitizer';
import { ALL_APP_PERMISSIONS, APP_CLIENT_ID_PATTERN, type AppPermission } from '../integration-app.constants';

const MAX_MODULES = 10;

export class UpdateIntegrationAppDto {
    @ApiPropertyOptional({ example: 'EBBK' })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    name?: string;

    @ApiPropertyOptional({ example: 'E-BBK: tiket Web Developer dari aplikasi bukti kas' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    @Sanitize({ removeHtml: true })
    description?: string | null;

    @ApiPropertyOptional({ example: ['web-developer'], description: 'Ticket module slugs this app may file into' })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_MODULES)
    @IsString({ each: true })
    modules?: string[];

    @ApiPropertyOptional({ example: ['tickets:create', 'tickets:read'], enum: ALL_APP_PERMISSIONS, isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsIn(ALL_APP_PERMISSIONS, { each: true })
    permissions?: AppPermission[];

    @ApiPropertyOptional({ example: 'https://ebbk.santos.co.id/api/idesk/webhook', description: 'Empty = no callbacks' })
    @IsOptional()
    @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false }, { message: 'webhookUrl must be an http(s) URL' })
    @MaxLength(500)
    webhookUrl?: string | null;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class CreateIntegrationAppDto extends UpdateIntegrationAppDto {
    @ApiProperty({ example: 'ebbk', description: 'Lower-case id sent in x-idesk-client-id (2-20 chars: a-z, 0-9, -)' })
    @IsString()
    @Matches(APP_CLIENT_ID_PATTERN, { message: 'clientId: 2-20 lower-case letters, digits or dashes, starting with a letter' })
    clientId: string;

    @ApiProperty({ example: 'EBBK' })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    declare name: string;

    @ApiProperty({ example: ['web-developer'] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_MODULES)
    @IsString({ each: true })
    declare modules: string[];

    @ApiProperty({ example: ['tickets:create', 'tickets:read', 'messages:read', 'messages:write'] })
    @IsArray()
    @ArrayMinSize(1)
    @IsIn(ALL_APP_PERMISSIONS, { each: true })
    declare permissions: AppPermission[];
}
