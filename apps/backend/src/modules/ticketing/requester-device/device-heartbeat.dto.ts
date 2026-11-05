import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { HOSTNAME_MAX, HOSTNAME_PATTERN } from './requester-device.constants';

/** Sent by the desktop app on sign-in and then periodically; see docs/integrations/device-heartbeat.md. */
export class DeviceHeartbeatDto {
    @ApiProperty({ example: 'SJA-FIN-PC012', maxLength: HOSTNAME_MAX })
    @IsString()
    @Sanitize()
    @MaxLength(HOSTNAME_MAX)
    @Matches(HOSTNAME_PATTERN, { message: 'hostname hanya boleh huruf, angka, titik dan tanda minus' })
    hostname: string;

    @ApiPropertyOptional({ example: '10.10.6.45', description: 'LAN IPv4/IPv6 of the active adapter' })
    @IsOptional()
    @IsIP()
    lanIp?: string;

    @ApiPropertyOptional({ example: 'SJA\\ervina', maxLength: 100 })
    @IsOptional()
    @IsString()
    @Sanitize({ removeHtml: true })
    @MaxLength(100)
    windowsUser?: string;

    @ApiPropertyOptional({ example: 'Windows 11 Pro 23H2 (10.0.22631)', maxLength: 100 })
    @IsOptional()
    @IsString()
    @Sanitize({ removeHtml: true })
    @MaxLength(100)
    osVersion?: string;

    @ApiPropertyOptional({ example: '2.4.0', maxLength: 30 })
    @IsOptional()
    @IsString()
    @Sanitize({ removeHtml: true })
    @MaxLength(30)
    appVersion?: string;
}
