import { IsDateString, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallStatus } from '../domain/enums/install-status.enum';

export class CalendarQueryDto {
    @IsDateString() from: string;
    @IsDateString() to: string;
    @IsOptional() @IsArray() @IsUUID('4', { each: true })
    @Type(() => String) technicianIds?: string[];
    @IsOptional() @IsArray() @IsEnum(InstallStatus, { each: true })
    status?: InstallStatus[];

    @IsOptional() @IsUUID()
    requesterId?: string;
}
