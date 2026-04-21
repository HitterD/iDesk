import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDate, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VpnArea, VpnStatusCreate } from '../entities/vpn-access.entity';

export class CreateVpnAccessDto {
    @ApiProperty({ enum: VpnArea, description: 'Area/Site' })
    @IsEnum(VpnArea)
    area: VpnArea;

    @ApiProperty({ description: 'Full name' })
    @IsString()
    @IsNotEmpty()
    namaUser: string;

    @ApiPropertyOptional({ description: 'Email address' })
    @IsOptional()
    @IsString()
    emailUser?: string;

    @ApiProperty({ description: 'Access start date' })
    @Type(() => Date)
    @IsDate()
    tanggalAktif: Date;

    @ApiProperty({ description: 'Access end date' })
    @Type(() => Date)
    @IsDate()
    tanggalNonAktif: Date;

    @ApiProperty({ enum: VpnStatusCreate, description: 'Creation status' })
    @IsEnum(VpnStatusCreate)
    statusCreateVpn: VpnStatusCreate;

    @ApiPropertyOptional({ description: 'Non Aktif Keterangan' })
    @IsOptional()
    @IsString()
    keteranganNonAktifVpn?: string;
}

export class UpdateVpnAccessDto {
    @ApiPropertyOptional({ enum: VpnArea })
    @IsOptional()
    @IsEnum(VpnArea)
    area?: VpnArea;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    namaUser?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    emailUser?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    tanggalAktif?: Date;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Date)
    @IsDate()
    tanggalNonAktif?: Date;

    @ApiPropertyOptional({ enum: VpnStatusCreate })
    @IsOptional()
    @IsEnum(VpnStatusCreate)
    statusCreateVpn?: VpnStatusCreate;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    keteranganNonAktifVpn?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    statusUserH1?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    statusIctH1?: string;
}
