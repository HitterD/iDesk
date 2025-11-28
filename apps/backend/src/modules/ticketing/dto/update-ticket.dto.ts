import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTicketDto {
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
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
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
    @ApiProperty()
    @IsUUID()
    assigneeId: string;
}

export class CancelTicketDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reason?: string;
}
