import { IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportType {
    CONSOLIDATED = 'CONSOLIDATED',
    PER_SITE = 'PER_SITE',
    COMPARISON = 'COMPARISON',
}

export enum ReportPeriod {
    DAILY = 'DAILY',
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY',
    CUSTOM = 'CUSTOM',
}

export class DashboardQueryDto {
    @ApiPropertyOptional({ description: 'Filter by site IDs', type: [String] })
    @IsOptional()
    @IsArray()
    siteIds?: string[];

    @ApiPropertyOptional({ description: 'Start date for stats', example: '2025-01-01' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: 'End date for stats', example: '2025-01-31' })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class ReportQueryDto {
    @ApiPropertyOptional({ enum: ReportType, default: 'CONSOLIDATED' })
    @IsOptional()
    @IsEnum(ReportType)
    reportType?: ReportType = ReportType.CONSOLIDATED;

    @ApiPropertyOptional({ enum: ReportPeriod, default: 'MONTHLY' })
    @IsOptional()
    @IsEnum(ReportPeriod)
    period?: ReportPeriod = ReportPeriod.MONTHLY;

    @ApiPropertyOptional({ description: 'Filter by site IDs', type: [String] })
    @IsOptional()
    @IsArray()
    siteIds?: string[];

    @ApiPropertyOptional({ description: 'Start date for report', example: '2025-01-01' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({ description: 'End date for report', example: '2025-01-31' })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ description: 'Include ticket statistics', default: true })
    @IsOptional()
    includeTicketStats?: boolean = true;

    @ApiPropertyOptional({ description: 'Include agent performance', default: true })
    @IsOptional()
    includeAgentPerformance?: boolean = true;

    @ApiPropertyOptional({ description: 'Include SLA metrics', default: true })
    @IsOptional()
    includeSlaMetrics?: boolean = true;
}
