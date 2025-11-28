import { IsOptional, IsString, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContractDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    poNumber?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    vendorName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(0)
    contractValue?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
