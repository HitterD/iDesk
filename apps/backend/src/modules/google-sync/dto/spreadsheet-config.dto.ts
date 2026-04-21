import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpreadsheetConfigDto {
    @ApiProperty({ description: 'Display name for this spreadsheet' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Google Spreadsheet ID (from URL)' })
    @IsString()
    @IsNotEmpty()
    spreadsheetId: string;

    @ApiPropertyOptional({ description: 'Full spreadsheet URL for reference' })
    @IsOptional()
    @IsString()
    spreadsheetUrl?: string;

    @ApiPropertyOptional({ description: 'Default sync interval in seconds', default: 30 })
    @IsOptional()
    @IsNumber()
    @Min(30)
    @Max(3600)
    defaultSyncIntervalSeconds?: number;
}

export class UpdateSpreadsheetConfigDto {
    @ApiPropertyOptional({ description: 'Display name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Enable/disable sync' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Default sync interval in seconds' })
    @IsOptional()
    @IsNumber()
    @Min(30)
    @Max(3600)
    defaultSyncIntervalSeconds?: number;
}
