import { IsString, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePriorityWeightDto {
    @IsNumber()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    points: number;

    @IsOptional()
    @IsString()
    description?: string;
}

export class AssignTicketDto {
    @IsUUID()
    ticketId: string;

    @IsOptional()
    @IsUUID()
    agentId?: string; // If not provided, will auto-assign
}

export class GetWorkloadDto {
    @IsOptional()
    @IsUUID()
    siteId?: string;

    @IsOptional()
    @IsString()
    date?: string; // YYYY-MM-DD format
}
