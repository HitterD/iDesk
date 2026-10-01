import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationCategory } from '../entities/notification.entity';

/** Exactly one target is used, in this order: ticketId, referenceId, category. */
export class MarkReadByTargetDto {
    @ApiPropertyOptional({ description: 'Ticket the user opened' })
    @IsOptional()
    @IsUUID()
    ticketId?: string;

    @ApiPropertyOptional({ description: 'Item the user opened (hardware request, e-form, ...)' })
    @IsOptional()
    @IsUUID()
    referenceId?: string;

    @ApiPropertyOptional({ enum: NotificationCategory, description: 'Category page the user opened' })
    @IsOptional()
    @IsEnum(NotificationCategory)
    category?: NotificationCategory;
}
