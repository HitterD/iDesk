import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAssignTicketsDto {
    @ApiProperty({ type: [String], description: 'Array of ticket IDs to assign' })
    @IsArray()
    @IsUUID(4, { each: true })
    @ArrayMaxSize(100, { message: 'At most 100 tickets per bulk request' })
    @ArrayUnique({ message: 'Duplicate ticket IDs are not allowed' })
    @Type(() => String)
    ticketIds: string[];

    @ApiProperty({ description: 'Target assignee user ID (required for bulk assign)' })
    @IsUUID()
    assigneeId: string;

    @ApiPropertyOptional({ maxLength: 500 })
    @IsOptional()
    @IsString()
    reason?: string;
}
