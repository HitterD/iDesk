import { IsArray, IsUUID, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MergeTicketsDto {
    @ApiProperty({ description: 'The primary ticket ID (tickets will be merged into this one)' })
    @IsUUID()
    primaryTicketId: string;

    @ApiProperty({ type: [String], description: 'Array of secondary ticket IDs to merge' })
    @IsArray()
    @IsUUID(4, { each: true })
    secondaryTicketIds: string[];

    @ApiPropertyOptional({ description: 'Optional reason for merging' })
    @IsOptional()
    @IsString()
    reason?: string;
}
