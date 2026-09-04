import {
    IsOptional,
    IsArray,
    IsDateString,
    IsEnum,
    IsIn,
    ArrayMinSize,
} from 'class-validator';
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

// Kunci section sesuai REPORT_SECTIONS di ManagerReportsPage.tsx.
export const MANAGER_REPORT_SECTIONS = [
    'summary',
    'tickets',
    'sla',
    'agents',
    'trends',
    'critical',
] as const;
export type ManagerReportSection = (typeof MANAGER_REPORT_SECTIONS)[number];

/** Normalisasi reportType dari UI (lowercase/kebab) ke enum backend. */
export function normalizeReportType(input?: string): ReportType {
    switch ((input || '').toLowerCase()) {
        case 'per-site':
            return ReportType.PER_SITE;
        case 'comparison':
            return ReportType.COMPARISON;
        default:
            return ReportType.CONSOLIDATED;
    }
}

// Format export yang didukung endpoint generate (Q2: PDF dan Excel).
export const MANAGER_EXPORT_FORMATS = ['pdf', 'excel'] as const;
export type ManagerExportFormat = (typeof MANAGER_EXPORT_FORMATS)[number];

export class GenerateManagerReportDto {
    @ApiPropertyOptional({ description: 'consolidated | per-site | comparison (dari UI)', default: 'consolidated' })
    @IsOptional()
    @IsIn(['consolidated', 'per-site', 'comparison'])
    reportType?: string;

    @ApiPropertyOptional({ description: 'Filter by site IDs', type: [String] })
    @IsOptional()
    @IsArray()
    siteIds?: string[];

    @ApiPropertyOptional({ description: 'Start date for report', example: '2026-08-01' })
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'End date for report', example: '2026-08-31' })
    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @ApiPropertyOptional({
        description: 'Sections to include in the generated file',
        type: [String],
        example: ['summary', 'tickets'],
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsIn(MANAGER_REPORT_SECTIONS, { each: true })
    sections: ManagerReportSection[];

    @ApiPropertyOptional({ description: 'pdf | excel', default: 'pdf' })
    @IsOptional()
    @IsIn(MANAGER_EXPORT_FORMATS)
    format?: string = 'pdf';
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
