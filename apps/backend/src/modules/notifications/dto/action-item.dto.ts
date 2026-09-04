import { ApiProperty } from '@nestjs/swagger';

export enum ActionItemUrgency {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    NORMAL = 'NORMAL',
}

export enum ActionItemEntityType {
    TICKET = 'TICKET',
    HARDWARE_REQUEST = 'HARDWARE_REQUEST',
    EFORM = 'EFORM',
    RENEWAL = 'RENEWAL',
    ZOOM = 'ZOOM',
}

export class ActionItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ActionItemEntityType })
    entityType: ActionItemEntityType;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty({ enum: ActionItemUrgency })
    urgency: ActionItemUrgency;

    @ApiProperty()
    entityId: string;

    @ApiProperty()
    link: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    isSnoozed: boolean;

    @ApiProperty({ required: false })
    snoozeUntil?: string;
}

export class ActionItemsResponseDto {
    @ApiProperty({ type: [ActionItemDto] })
    items: ActionItemDto[];

    @ApiProperty()
    counts: {
        critical: number;
        high: number;
        normal: number;
        total: number;
    };
}
