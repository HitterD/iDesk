import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEmail, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class SendReminderDto {
    @ApiPropertyOptional({ description: 'Target email recipient (defaults to bookedByUser email or current user email)', example: 'user@company.com' })
    @IsOptional()
    @IsEmail()
    recipientEmail?: string;

    @ApiPropertyOptional({ description: 'Minutes before meeting to trigger scheduled reminder (e.g. 15, 30, 60)', example: 15 })
    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(1440)
    minutesBefore?: number;

    @ApiPropertyOptional({ description: 'Whether to send an instant reminder email immediately', example: true, default: true })
    @IsOptional()
    @IsBoolean()
    sendNow?: boolean;
}
