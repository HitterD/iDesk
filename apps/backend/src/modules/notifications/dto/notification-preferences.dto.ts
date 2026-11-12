import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DigestFrequency, ReminderIntensity } from '../entities/notification-preference.entity';
import { NotificationType } from '../entities/notification.entity';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The preference fields a user may change; anything else (userId, id, pushTokens, emailAddress) is rejected. */
export class UpdatePreferencesDto {
    @IsOptional() @IsBoolean() inAppEnabled?: boolean;
    @IsOptional() @IsBoolean() emailEnabled?: boolean;
    @IsOptional() @IsBoolean() pushEnabled?: boolean;
    @IsOptional() @IsBoolean() digestEnabled?: boolean;
    @IsOptional() @IsEnum(DigestFrequency) digestFrequency?: DigestFrequency;
    @IsOptional() @Matches(HH_MM) digestTime?: string;
    @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
    @IsOptional() @Matches(HH_MM) quietHoursStart?: string;
    @IsOptional() @Matches(HH_MM) quietHoursEnd?: string;
    @IsOptional() @IsString() @IsIn(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']) timezone?: string;
    /** Ignored: email always goes to the account address. Accepted so older clients that echo it back still save. */
    @IsOptional() @IsString() emailAddress?: string;
    @IsOptional() @IsEnum(ReminderIntensity) reminderIntensity?: ReminderIntensity;
}

export class TypeChannelsDto {
    @IsOptional() @IsBoolean() inApp?: boolean;
    @IsOptional() @IsBoolean() email?: boolean;
    @IsOptional() @IsBoolean() push?: boolean;
}

export class UpdateTypePreferenceDto {
    @IsEnum(NotificationType) notificationType: NotificationType;
    @IsObject() @ValidateNested() @Type(() => TypeChannelsDto) channels: TypeChannelsDto;
}
