import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDate, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VpnType, VpnStatus } from '../entities/vpn-access.entity';

export class CreateVpnAccessDto {
    @ApiProperty({ description: 'VPN/AD username' })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ description: 'Full name' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsOptional()
    @IsString()
    email?: string;

    @ApiPropertyOptional({ description: 'Department' })
    @IsOptional()
    @IsString()
    department?: string;

    @ApiPropertyOptional({ description: 'Site code' })
    @IsOptional()
    @IsString()
    site?: string;

    @ApiProperty({ enum: VpnType, description: 'VPN connection type' })
    @IsEnum(VpnType)
    vpnType: VpnType;

    @ApiPropertyOptional({ description: 'WatchGuard profile name' })
    @IsOptional()
    @IsString()
    vpnProfile?: string;

    @ApiProperty({ description: 'Access start date' })
    @Type(() => Date)
    @IsDate()
    validFrom: Date;

    @ApiProperty({ description: 'Access end date' })
    @Type(() => Date)
    @IsDate()
    validUntil: Date;

    @ApiPropertyOptional({ description: 'Purpose/reason for access' })
    @IsOptional()
    @IsString()
    purpose?: string;

    @ApiPropertyOptional({ description: 'Reminder days (comma-separated)', default: '60,30,7,1' })
    @IsOptional()
    @IsString()
    reminderDays?: string;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateVpnAccessDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    email?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    department?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    site?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEnum(VpnType)
    vpnType?: VpnType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    vpnProfile?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    validFrom?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    validUntil?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEnum(VpnStatus)
    status?: VpnStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    purpose?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reminderDays?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;
}
