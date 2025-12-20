import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, MaxLength, MinLength } from 'class-validator';
import { IpWhitelistType, IpWhitelistScope } from '../entities/ip-whitelist.entity';

export class CreateIpWhitelistDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @IsString()
    @MinLength(1)
    @MaxLength(255)
    ipAddress: string;

    @IsOptional()
    @IsEnum(IpWhitelistType)
    type?: IpWhitelistType;

    @IsOptional()
    @IsEnum(IpWhitelistScope)
    scope?: IpWhitelistScope;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
