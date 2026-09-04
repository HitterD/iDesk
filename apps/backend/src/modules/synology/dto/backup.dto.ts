import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BackupType } from '../entities/backup-configuration.entity';


export class CreateBackupConfigDto {
    @IsString()
    name: string;

    @IsEnum(BackupType)
    backupType: BackupType;

    @IsString()
    synologyHost: string;

    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(65535)
    synologyPort: number;

    @IsString()
    synologyUsername: string;

    @IsString()
    synologyPassword: string;

    @IsString()
    destinationPath: string;

    @IsOptional()
    @IsString()
    scheduleTime?: string; // HH:mm format

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(365)
    retentionDays?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateBackupConfigDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(BackupType)
    backupType?: BackupType;

    @IsOptional()
    @IsString()
    synologyHost?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(65535)
    synologyPort?: number;

    @IsOptional()
    @IsString()
    synologyUsername?: string;

    @IsOptional()
    @IsString()
    synologyPassword?: string;

    @IsOptional()
    @IsString()
    destinationPath?: string;

    @IsOptional()
    @IsString()
    scheduleTime?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(365)
    retentionDays?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class TestConnectionDto {
    @IsString()
    synologyHost: string;

    @IsNumber()
    @Type(() => Number)
    synologyPort: number;

    @IsString()
    synologyUsername: string;

    @IsString()
    synologyPassword: string;

    @IsOptional()
    @IsString()
    destinationPath?: string;
}

export class ManualBackupDto {
    @IsOptional()
    @IsString()
    notes?: string;
}

export class ListFoldersDto {
    @IsString()
    synologyHost: string;

    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(65535)
    synologyPort: number;

    @IsString()
    synologyUsername: string;

    @IsString()
    synologyPassword: string;

    @IsOptional()
    @IsString()
    path?: string; // e.g. "/" or "/volume1" or "/volume1/iDesk-Backups"

    @IsOptional()
    @IsBoolean()
    includeFiles?: boolean;
}

export class RestoreFromHistoryDto {
    @IsOptional()
    @IsBoolean()
    createSnapshot?: boolean;
}

export class RestoreFromNasDto {
    @IsString()
    configId: string;

    @IsString()
    nasFilePath: string;

    @IsOptional()
    @IsBoolean()
    createSnapshot?: boolean;
}

export class RestoreUploadDto {
    @IsOptional()
    @IsBoolean()
    createSnapshot?: boolean;
}
