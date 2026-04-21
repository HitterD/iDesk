import { IsString, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FeaturePermissionDto {
    @IsString()
    featureKey: string;

    @IsBoolean()
    @IsOptional()
    canView?: boolean;

    @IsBoolean()
    @IsOptional()
    canCreate?: boolean;

    @IsBoolean()
    @IsOptional()
    canEdit?: boolean;

    @IsBoolean()
    @IsOptional()
    canDelete?: boolean;
}

export class UpdateUserPermissionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FeaturePermissionDto)
    permissions: FeaturePermissionDto[];
}

export class BulkUpdatePermissionsDto {
    @IsArray()
    @IsString({ each: true })
    userIds: string[];

    @IsString()
    presetId: string;
}
