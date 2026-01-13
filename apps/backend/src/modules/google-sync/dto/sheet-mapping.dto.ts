import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SyncDirection, SheetDataType } from '../entities/spreadsheet-sheet.entity';

export class ColumnMappingDto {
    @ApiProperty({ description: 'Field name in iDesk entity' })
    @IsString()
    @IsNotEmpty()
    iDeskField: string;

    @ApiProperty({ description: 'Column header in spreadsheet' })
    @IsString()
    @IsNotEmpty()
    sheetColumn: string;

    @ApiProperty({ enum: ['string', 'number', 'date', 'boolean'] })
    @IsString()
    type: 'string' | 'number' | 'date' | 'boolean';

    @ApiProperty({ description: 'Is this field required?' })
    @IsBoolean()
    required: boolean;
}

export class CreateSheetMappingDto {
    @ApiProperty({ description: 'Spreadsheet config ID' })
    @IsString()
    @IsNotEmpty()
    configId: string;

    @ApiProperty({ description: 'Sheet tab name' })
    @IsString()
    @IsNotEmpty()
    sheetName: string;

    @ApiPropertyOptional({ description: 'Google Sheet GID' })
    @IsOptional()
    @IsString()
    sheetGid?: string;

    @ApiProperty({ enum: SheetDataType, description: 'Type of data to sync' })
    @IsEnum(SheetDataType)
    dataType: SheetDataType;

    @ApiPropertyOptional({ enum: SyncDirection, description: 'Sync direction', default: SyncDirection.BOTH })
    @IsOptional()
    @IsEnum(SyncDirection)
    syncDirection?: SyncDirection;

    @ApiProperty({ type: [ColumnMappingDto], description: 'Column mappings' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ColumnMappingDto)
    columnMapping: ColumnMappingDto[];

    @ApiPropertyOptional({ description: 'Row number containing headers', default: 1 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    headerRow?: number;

    @ApiPropertyOptional({ description: 'Row number where data starts', default: 2 })
    @IsOptional()
    @IsNumber()
    @Min(2)
    dataStartRow?: number;

    @ApiPropertyOptional({ description: 'Sync interval in seconds', default: 30 })
    @IsOptional()
    @IsNumber()
    @Min(30)
    @Max(3600)
    syncIntervalSeconds?: number;
}

export class UpdateSheetMappingDto {
    @ApiPropertyOptional({ enum: SyncDirection })
    @IsOptional()
    @IsEnum(SyncDirection)
    syncDirection?: SyncDirection;

    @ApiPropertyOptional({ type: [ColumnMappingDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ColumnMappingDto)
    columnMapping?: ColumnMappingDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    @Min(30)
    @Max(3600)
    syncIntervalSeconds?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    syncEnabled?: boolean;
}
