import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, TicketPriority } from '../entities/ticket.entity';

export class BulkUpdateTicketsDto {
    @ApiProperty({ type: [String], description: 'Array of ticket IDs to update' })
    @IsArray()
    @IsUUID(4, { each: true })
    @ArrayMaxSize(100, { message: 'At most 100 tickets per bulk request' })
    @ArrayUnique({ message: 'Duplicate ticket IDs are not allowed' })
    @Type(() => String)
    ticketIds: string[];

    @ApiPropertyOptional({ enum: TicketStatus })
    @IsOptional()
    @IsEnum(TicketStatus)
    status?: TicketStatus;

    @ApiPropertyOptional({ enum: TicketPriority })
    @IsOptional()
    @IsEnum(TicketPriority)
    priority?: TicketPriority;

    @ApiPropertyOptional()
    @IsOptional()
    @IsUUID()
    assigneeId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class BulkDeleteTicketsDto {
    @ApiProperty({ type: [String], description: 'Array of ticket IDs to delete' })
    @IsArray()
    @IsUUID(4, { each: true })
    @ArrayMaxSize(100, { message: 'At most 100 tickets per bulk request' })
    @ArrayUnique({ message: 'Duplicate ticket IDs are not allowed' })
    @Type(() => String)
    ticketIds: string[];
}
