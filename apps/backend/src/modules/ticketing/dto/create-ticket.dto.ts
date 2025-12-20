import { IsEnum, IsNotEmpty, IsString, IsOptional, MaxLength, MinLength, IsBoolean, IsDateString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketSource } from '../entities/ticket.entity';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';
import { NoSqlInjection } from '../../../shared/core/validators/common.validators';

export class CreateTicketDto {
    @ApiProperty({ example: 'Cannot login to system', minLength: 5, maxLength: 200 })
    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: 'Title must be at least 5 characters' })
    @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
    @Sanitize({ removeHtml: true })
    @NoSqlInjection()
    title: string;

    @ApiProperty({ example: 'I am unable to login since this morning...', minLength: 3, maxLength: 5000 })
    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Description must be at least 3 characters' })
    @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
    @Sanitize()
    description: string;

    @ApiProperty({ enum: TicketPriority, example: 'MEDIUM' })
    @IsEnum(TicketPriority, { message: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL' })
    @IsNotEmpty()
    priority: TicketPriority;

    @ApiPropertyOptional({ example: 'Software', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    category?: string;

    @ApiPropertyOptional({ enum: TicketSource, example: 'WEB' })
    @IsEnum(TicketSource)
    @IsOptional()
    source?: TicketSource;

    @ApiPropertyOptional({ example: 'Laptop Dell XPS 15', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    device?: string;

    @ApiPropertyOptional({ example: 'Microsoft Office 365', maxLength: 100 })
    @IsString()
    @IsOptional()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    @Transform(({ value }) => value || undefined)
    software?: string;

    // === Hardware Installation Fields ===

    @ApiPropertyOptional({ example: false, description: 'Is this a hardware installation request?' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    isHardwareInstallation?: boolean;

    @ApiPropertyOptional({ example: '2025-01-15', description: 'Scheduled installation date (YYYY-MM-DD)' })
    @IsDateString()
    @IsOptional()
    scheduledDate?: string;

    @ApiPropertyOptional({ example: '09:00', description: 'Scheduled time slot (HH:mm)' })
    @IsString()
    @IsOptional()
    @Matches(/^(0[89]|1[0-1]|1[4-5]):00$/, {
        message: 'Time slot must be 08:00, 09:00, 10:00, 11:00, 14:00, or 15:00'
    })
    scheduledTime?: string;

    @ApiPropertyOptional({ example: 'PC', description: 'Hardware type: PC, IP_PHONE, PRINTER, or custom' })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    @Sanitize({ removeHtml: true })
    hardwareType?: string;

    @ApiPropertyOptional({ example: true, description: 'User acknowledges the 2-4 hour schedule block' })
    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    userAcknowledged?: boolean;

    // === Critical Priority Fields ===

    @ApiPropertyOptional({ example: 'Server produksi down, menghambat seluruh operasional', description: 'Required when priority is CRITICAL' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    @Sanitize()
    criticalReason?: string;
}

