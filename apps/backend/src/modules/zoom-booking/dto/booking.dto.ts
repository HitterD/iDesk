import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsInt,
    Min,
    Max,
    IsArray,
    IsEmail,
    MaxLength,
    MinLength,
    Matches,
} from 'class-validator';

export class CreateBookingDto {
    @ApiProperty({ description: 'Zoom account ID' })
    @IsString()
    @IsNotEmpty()
    zoomAccountId: string;

    @ApiProperty({ description: 'Meeting title', minLength: 5, maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(100)
    title: string;

    @ApiPropertyOptional({ description: 'Meeting description', maxLength: 500 })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @ApiProperty({ description: 'Booking date (YYYY-MM-DD format)' })
    @IsDateString()
    @IsNotEmpty()
    bookingDate: string;

    @ApiProperty({ description: 'Start time (HH:mm format)', example: '09:00' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'startTime must be in HH:mm format',
    })
    startTime: string;

    @ApiProperty({ description: 'Duration in minutes', example: 60 })
    @Type(() => Number)
    @Transform(({ value }) => {
        if (typeof value === 'number') return value;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? 60 : parsed; // Default to 60 if parsing fails
    })
    @IsInt()
    @Min(30)
    @Max(240)
    durationMinutes: number;

    @ApiPropertyOptional({ description: 'Participant emails', type: [String] })
    @IsArray()
    @IsEmail({}, { each: true })
    @IsOptional()
    participantEmails?: string[];
}

export class CancelBookingDto {
    @ApiProperty({ description: 'Reason for cancellation' })
    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    @MaxLength(500)
    cancellationReason: string;
}

export class GetCalendarDto {
    @ApiProperty({ description: 'Zoom account ID' })
    @IsString()
    @IsNotEmpty()
    zoomAccountId: string;

    @ApiProperty({ description: 'Start date for calendar view (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @ApiProperty({ description: 'End date for calendar view (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    endDate: string;
}

export class RescheduleBookingDto {
    @ApiProperty({ description: 'New booking date (YYYY-MM-DD format)' })
    @IsDateString()
    @IsNotEmpty()
    bookingDate: string;

    @ApiProperty({ description: 'New start time (HH:mm format)', example: '09:00' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'startTime must be in HH:mm format',
    })
    startTime: string;

    @ApiPropertyOptional({ description: 'New duration in minutes', example: 60 })
    @Type(() => Number)
    @IsInt()
    @Min(30)
    @Max(240)
    @IsOptional()
    durationMinutes?: number;
}
