import { IsString, IsOptional, IsBoolean, Length, IsIP } from 'class-validator';

export class CreateSiteDto {
    @IsString()
    @Length(2, 10)
    code: string;

    @IsString()
    @Length(1, 100)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    vpnIpRange?: string;

    @IsOptional()
    @IsString()
    localGateway?: string;

    @IsOptional()
    @IsString()
    timezone?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    isServerHost?: boolean;
}
