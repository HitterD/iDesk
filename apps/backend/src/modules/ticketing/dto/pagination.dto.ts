import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';

    @ApiPropertyOptional({ description: 'Filter by status' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Filter by priority' })
    @IsOptional()
    @IsString()
    priority?: string;

    @ApiPropertyOptional({ description: 'Filter by category' })
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({ description: 'Filter out specific category' })
    @IsOptional()
    @IsString()
    excludeCategory?: string;

    @ApiPropertyOptional({ description: 'Filter out specific ticket type' })
    @IsOptional()
    @IsString()
    excludeType?: string;

    @ApiPropertyOptional({ description: 'Filter by specific ticket type' })
    @IsOptional()
    @IsString()
    ticketType?: string;

    @ApiPropertyOptional({ description: 'Filter by start date' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: 'Filter by end date' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Search in title and description' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by site ID' })
    @IsOptional()
    @IsString()
    siteId?: string;

    @ApiPropertyOptional({ description: 'Filter by multiple site IDs (ADMIN/MANAGER only)', type: [String] })
    @IsOptional()
    @Transform(({ value }) => {
        // Query params can come as string (single) or array (multiple)
        if (!value) return undefined;
        if (Array.isArray(value)) return value;
        return [value]; // Convert single string to array
    })
    @IsString({ each: true })
    siteIds?: string[];
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}