import { IsOptional, IsArray, IsDateString, IsEnum, IsUUID, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeDto {
    @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
    @IsDateString()
    start: string;

    @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
    @IsDateString()
    end: string;
}

export type SearchScope = 'tickets' | 'users' | 'articles';

export class SearchFilterDto {
    @ApiPropertyOptional({ description: 'Search scopes to include', enum: ['tickets', 'users', 'articles'], isArray: true })
    @IsOptional()
    @IsArray()
    scope?: SearchScope[];

    @ApiPropertyOptional({ description: 'Date range filter', type: DateRangeDto })
    @IsOptional()
    @Type(() => DateRangeDto)
    dateRange?: DateRangeDto;

    @ApiPropertyOptional({ description: 'Filter by ticket status', isArray: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    status?: string[];

    @ApiPropertyOptional({ description: 'Filter by ticket priority', isArray: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    priority?: string[];

    @ApiPropertyOptional({ description: 'Filter by assigned agent ID' })
    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @ApiPropertyOptional({ description: 'Filter by department ID' })
    @IsOptional()
    @IsUUID()
    department?: string;

    @ApiPropertyOptional({ description: 'Filter by tags', isArray: true })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiPropertyOptional({ description: 'Filter by category' })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({ description: 'Filter by ticket source (WEB, TELEGRAM, EMAIL)' })
    @IsOptional()
    @IsString()
    source?: string;
}

export class SearchQueryDto extends SearchFilterDto {
    @ApiPropertyOptional({ description: 'Search query string' })
    @IsOptional()
    @IsString()
    q?: string;

    @ApiPropertyOptional({ description: 'Number of results per page', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;
}
