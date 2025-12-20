import { IsString, IsOptional, IsBoolean, IsNumber, IsObject } from 'class-validator';
import { PermissionSet } from '../entities/permission-preset.entity';

export class CreatePresetDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @IsObject()
    permissions: Record<string, PermissionSet>;
}

export class UpdatePresetDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @IsOptional()
    @IsObject()
    permissions?: Record<string, PermissionSet>;
}
