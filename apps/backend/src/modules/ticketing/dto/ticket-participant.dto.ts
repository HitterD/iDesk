import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipantsDto {
    @ApiProperty({ description: 'List of User IDs to add as participants', type: [String] })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('all', { each: true })
    userIds: string[];
}
