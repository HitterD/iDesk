import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationEventType, normalizeNotificationEventType } from '../entities/notification-sound.entity';

export class CreateSoundDto {
    @Transform(({ value }) => normalizeNotificationEventType(value))
    @IsEnum(NotificationEventType)
    eventType: NotificationEventType;

    @IsString()
    name: string;

    @IsString()
    soundUrl: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateSoundDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    soundUrl?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class SetActiveSoundDto {
    @IsUUID()
    soundId: string;
}
