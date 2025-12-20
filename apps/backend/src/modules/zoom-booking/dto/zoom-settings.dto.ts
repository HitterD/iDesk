import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsBoolean,
    IsInt,
    Min,
    Max,
    IsArray,
    Matches,
} from 'class-validator';

export class UpdateZoomSettingsDto {
    @ApiPropertyOptional({ description: 'Default meeting duration in minutes' })
    @IsInt()
    @Min(15)
    @Max(480)
    @IsOptional()
    defaultDurationMinutes?: number;

    @ApiPropertyOptional({ description: 'Max days ahead for booking' })
    @IsInt()
    @Min(1)
    @Max(365)
    @IsOptional()
    advanceBookingDays?: number;

    @ApiPropertyOptional({ description: 'Business hours start (HH:mm or HH:mm:ss)', example: '08:00' })
    @IsString()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    @IsOptional()
    slotStartTime?: string;

    @ApiPropertyOptional({ description: 'Business hours end (HH:mm or HH:mm:ss)', example: '18:00' })
    @IsString()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    @IsOptional()
    slotEndTime?: string;

    @ApiPropertyOptional({ description: 'Slot interval in minutes' })
    @IsInt()
    @Min(15)
    @Max(120)
    @IsOptional()
    slotIntervalMinutes?: number;

    @ApiPropertyOptional({ description: 'Blocked dates (holidays)', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    blockedDates?: string[];

    @ApiPropertyOptional({ description: 'Working days (0-6)', type: [Number] })
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    workingDays?: number[];

    @ApiPropertyOptional({ description: 'Require description for booking' })
    @IsBoolean()
    @IsOptional()
    requireDescription?: boolean;

    @ApiPropertyOptional({ description: 'Max bookings per user per day' })
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    maxBookingPerUserPerDay?: number;

    @ApiPropertyOptional({ description: 'Allowed duration options in minutes', type: [Number] })
    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    allowedDurations?: number[];
}
