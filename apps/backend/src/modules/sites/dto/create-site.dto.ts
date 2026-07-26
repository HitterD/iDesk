import { IsString, IsOptional, IsBoolean, Length, IsIP, Matches } from 'class-validator';

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

    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closingTime harus format HH:mm, contoh 17:00' })
    closingTime?: string | null;
}
