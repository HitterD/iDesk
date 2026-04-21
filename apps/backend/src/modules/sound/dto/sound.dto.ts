import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { NotificationEventType } from '../entities/notification-sound.entity';

export class CreateSoundDto {
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
