import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipantsDto {
    @ApiProperty({ description: 'List of User IDs to add as participants', type: [String] })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    userIds: string[];
}
