import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleInstallDto {
    @IsDateString() scheduledStart: string;
    @IsDateString() scheduledEnd: string;
    @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
