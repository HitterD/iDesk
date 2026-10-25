import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TicketStatus, TicketPriority, VENDOR_NOTE_MAX_LENGTH } from '../entities/ticket.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sanitize } from '../../../shared/core/validators/input-sanitizer';

export class UpdateTicketDto {
    @ApiPropertyOptional({ enum: TicketStatus })
    @IsOptional()
    @IsEnum(TicketStatus)
    status?: TicketStatus;

    @ApiPropertyOptional({ enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    category?: string;

    @ApiPropertyOptional({ maxLength: 100 })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    @Sanitize({ removeHtml: true })
    device?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    assigneeId?: string;
}

export class UpdateTicketStatusDto {
    @ApiProperty({ enum: TicketStatus })
    @IsEnum(TicketStatus)
    status: TicketStatus;

    @ApiPropertyOptional({ description: 'Confirm taking the ticket over from its current PIC (requires reason)' })
    @IsOptional()
    @IsBoolean()
    takeover?: boolean;

    @ApiPropertyOptional({ description: 'ADMIN/MANAGER only: change status but keep the current PIC' })
    @IsOptional()
    @IsBoolean()
    keepAssignee?: boolean;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Sanitize({ removeHtml: true })
    reason?: string;

    @ApiPropertyOptional({ description: 'WAITING_VENDOR only: agreed vendor visit time (ISO). Defaults to next Thursday 09:00 WIB.' })
    @IsOptional()
    @IsISO8601()
    vendorVisitAt?: string;

    @ApiPropertyOptional({ description: 'WAITING_VENDOR only: what the ticket waits on (e.g. "Menunggu spare part")', maxLength: VENDOR_NOTE_MAX_LENGTH })
    @IsOptional()
    @IsString()
    @MaxLength(VENDOR_NOTE_MAX_LENGTH)
    @Sanitize({ removeHtml: true })
    vendorNote?: string;
}

export class UpdateVendorVisitDto {
    @ApiProperty({ description: 'Agreed vendor visit time (ISO 8601)' })
    @IsISO8601()
    vendorVisitAt: string;

    @ApiPropertyOptional({ description: 'New vendor note; omit to keep the current one', maxLength: VENDOR_NOTE_MAX_LENGTH })
    @IsOptional()
    @IsString()
    @MaxLength(VENDOR_NOTE_MAX_LENGTH)
    @Sanitize({ removeHtml: true })
    vendorNote?: string;
}

export class UpdateTicketPriorityDto {
    @ApiProperty({ enum: TicketPriority })
    @IsEnum(TicketPriority)
    priority: TicketPriority;
}

export class UpdateTicketCategoryDto {
    @ApiProperty()
    @IsString()
    category: string;
}

export class UpdateTicketDeviceDto {
    @ApiProperty()
    @IsString()
    device: string;
}

export class AssignTicketDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    assigneeId?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Sanitize({ removeHtml: true })
    reason?: string;
}

export class CancelTicketDto {
    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    @Sanitize({ removeHtml: true })
    reason?: string;
}
