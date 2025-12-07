import { IsBoolean, IsNumber, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RetentionSettingsDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(3650) // Max 10 years
    retentionDays?: number;

    @IsOptional()
    @IsBoolean()
    onlyResolvedTickets?: boolean;
}

export class UpdateStorageSettingsDto {
    @IsOptional()
    @IsBoolean()
    autoCleanupEnabled?: boolean;

    @IsOptional()
    @Type(() => RetentionSettingsDto)
    attachments?: RetentionSettingsDto;

    @IsOptional()
    @Type(() => RetentionSettingsDto)
    notes?: RetentionSettingsDto;

    @IsOptional()
    @Type(() => RetentionSettingsDto)
    discussions?: RetentionSettingsDto;
}

export class ManualCleanupDto {
    @IsDateString()
    fromDate: string;

    @IsDateString()
    toDate: string;

    @IsBoolean()
    deleteAttachments: boolean;

    @IsBoolean()
    deleteNotes: boolean;

    @IsBoolean()
    deleteDiscussions: boolean;

    @IsOptional()
    @IsBoolean()
    onlyResolvedTickets?: boolean;
}

export class CleanupPreviewDto {
    @IsDateString()
    fromDate: string;

    @IsDateString()
    toDate: string;

    @IsOptional()
    @IsBoolean()
    deleteAttachments?: boolean;

    @IsOptional()
    @IsBoolean()
    deleteNotes?: boolean;

    @IsOptional()
    @IsBoolean()
    deleteDiscussions?: boolean;

    @IsOptional()
    @IsBoolean()
    onlyResolvedTickets?: boolean;
}
