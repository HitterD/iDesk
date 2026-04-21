import { IsUUID, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class ScheduleInstallDto {
    @IsOptional() @IsUUID() technicianId?: string; // wajib bila proposer bukan TECH
    @IsDateString() scheduledStart: string;
    @IsDateString() scheduledEnd: string;
    @IsOptional() @IsString() @MaxLength(500) locationDetail?: string;
}
