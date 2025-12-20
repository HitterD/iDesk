import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserPaginationDto {
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

    @ApiPropertyOptional({ description: 'Search by name or email' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by site code (e.g., SPJ, SMG)' })
    @IsOptional()
    @IsString()
    siteCode?: string;

    @ApiPropertyOptional({ description: 'Filter by role', enum: ['ADMIN', 'AGENT', 'USER'] })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiPropertyOptional({ description: 'Sort field', default: 'fullName' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'fullName';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
