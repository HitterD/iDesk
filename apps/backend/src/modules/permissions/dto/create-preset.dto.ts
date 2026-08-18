import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsIn, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';
import { PresetTargetRole } from '../entities/permission-preset.entity';

// Permission action type for individual feature permissions
interface FeaturePermission {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

// Valid target roles for presets
const VALID_TARGET_ROLES = ['USER', 'AGENT', 'MANAGER', 'ADMIN'] as const;

import { isValidPageKey } from '../../../shared/core/types/page-access.types';

const LEGACY_PAGE_KEY_ALIASES: Record<string, string> = {
    eform: 'eform_access',
    users: 'agents',
};

// Custom validator for pageAccess object
@ValidatorConstraint({ name: 'isValidPageAccess', async: false })
class IsValidPageAccessConstraint implements ValidatorConstraintInterface {
    validate(pageAccess: unknown, args: ValidationArguments): boolean {
        if (pageAccess === null || pageAccess === undefined) return true;
        if (typeof pageAccess !== 'object') return false;

        // Check all keys are valid and values are booleans
        for (const [key, value] of Object.entries(pageAccess as Record<string, unknown>)) {
            const normalizedKey = LEGACY_PAGE_KEY_ALIASES[key] || key;
            if (!isValidPageKey(normalizedKey) || typeof value !== 'boolean') {
                return false;
            }
        }
        return true;
    }

    defaultMessage(args: ValidationArguments): string {
        return `pageAccess contains invalid page keys or non-boolean values`;
    }
}

// Decorator factory for pageAccess validation
function IsValidPageAccess(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsValidPageAccessConstraint,
        });
    };
}

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

    // Target role for this preset with validation
    @IsOptional()
    @IsIn(VALID_TARGET_ROLES)
    targetRole?: PresetTargetRole;

    // Simple page access map with custom validation
    @IsOptional()
    @IsObject()
    @IsValidPageAccess({ message: 'pageAccess contains invalid page keys or non-boolean values' })
    pageAccess?: Record<string, boolean>;

    // Complex permissions (kept for backward compat)
    @IsOptional()
    @IsObject()
    permissions?: Record<string, FeaturePermission>;
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

    // Target role for this preset with validation
    @IsOptional()
    @IsIn(VALID_TARGET_ROLES)
    targetRole?: PresetTargetRole;

    // Simple page access map with custom validation
    @IsOptional()
    @IsObject()
    @IsValidPageAccess({ message: 'pageAccess contains invalid page keys or non-boolean values' })
    pageAccess?: Record<string, boolean>;

    // Complex permissions
    @IsOptional()
    @IsObject()
    permissions?: Record<string, FeaturePermission>;
}

