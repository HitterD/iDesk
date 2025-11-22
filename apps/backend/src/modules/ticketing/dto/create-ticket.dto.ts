import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { TicketPriority, TicketSource } from '../entities/ticket.entity';

export class CreateTicketDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsEnum(TicketPriority)
    @IsNotEmpty()
    priority: TicketPriority;

    @IsEnum(TicketSource)
    @IsNotEmpty()
    source: TicketSource;
}
