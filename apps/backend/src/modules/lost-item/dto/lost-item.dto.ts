import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLostItemDto {
    @IsString()
    itemType: string; // Laptop, HP, ID Card, Kunci, Tas, Lainnya

    @IsString()
    itemName: string;

    @IsOptional()
    @IsString()
    serialNumber?: string;

    @IsOptional()
    @IsString()
    assetTag?: string;

    @IsString()
    lastSeenLocation: string;

    @IsDateString()
    lastSeenDatetime: string;

    @IsString()
    circumstances: string;

    @IsOptional()
    @IsString()
    witnessContact?: string;

    @IsOptional()
    @IsBoolean()
    hasPoliceReport?: boolean;

    @IsOptional()
    @IsString()
    policeReportNumber?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    estimatedValue?: number;

    @IsOptional()
    @IsBoolean()
    finderRewardOffered?: boolean;

    // Ticket fields
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export class UpdateLostItemStatusDto {
    @IsString()
    status: string; // REPORTED, SEARCHING, FOUND, CLOSED_LOST

    @IsOptional()
    @IsString()
    foundLocation?: string;

    @IsOptional()
    @IsString()
    foundBy?: string;
}
