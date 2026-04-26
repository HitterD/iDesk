import { IsString, IsOptional, IsDateString, IsUUID, IsArray } from 'class-validator';

export class CreateFoundClaimDto {
    @IsOptional()
    @IsUUID()
    lostItemReportId?: string;

    @IsString()
    locationFound: string;

    @IsDateString()
    foundAt: string;

    @IsString()
    description: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    photoUrls?: string[];
}

export class MatchFoundClaimDto {
    @IsOptional()
    @IsUUID()
    lostItemReportId?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class RejectFoundClaimDto {
    @IsString()
    notes: string;
}
