import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActionItemEntityType } from './action-item.dto';

export class SnoozeActionItemDto {
    @ApiProperty({ enum: ActionItemEntityType })
    @IsEnum(ActionItemEntityType)
    entityType: ActionItemEntityType;

    @ApiProperty()
    @IsString()
    entityId: string;

    @ApiProperty({ enum: ['30m', '2h', 'tomorrow'] })
    @IsEnum(['30m', '2h', 'tomorrow'])
    duration: '30m' | '2h' | 'tomorrow';
}

export class UnsnoozeActionItemDto {
    @ApiProperty({ enum: ActionItemEntityType })
    @IsEnum(ActionItemEntityType)
    entityType: ActionItemEntityType;

    @ApiProperty()
    @IsString()
    entityId: string;
}
