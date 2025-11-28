import { IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { TicketPriority, TicketSource } from '../entities/ticket.entity';

export class CreateTicketDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    priority: TicketPriority;

    @IsString()
    @IsOptional()
    category?: string;

    @IsEnum(TicketSource)
    @IsOptional()
    source?: TicketSource;

    @IsString()
    @IsOptional()
    device?: string;

    @IsString()
    @IsOptional()
    software?: string;
}
