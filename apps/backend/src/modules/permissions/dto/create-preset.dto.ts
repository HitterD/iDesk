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

// Valid page keys that can be used in pageAccess
const VALID_PAGE_KEYS = [
    'dashboard',
    'tickets',
    'hardware_requests',
    'eform_access',
    'lost_items',
    'zoom_calendar',
    'knowledge_base',
    'notifications',
    'reports',
    'renewal',
    'agents',
    'workloads',
    'automation',
    'audit_logs',
    'system_health',
    'settings',
] as const;

// Custom validator for pageAccess object
@ValidatorConstraint({ name: 'isValidPageAccess', async: false })
class IsValidPageAccessConstraint implements ValidatorConstraintInterface {
    validate(pageAccess: unknown, args: ValidationArguments): boolean {
        if (pageAccess === null || pageAccess === undefined) return true;
        if (typeof pageAccess !== 'object') return false;

        // Check all keys are valid page keys and values are booleans
        for (const [key, value] of Object.entries(pageAccess as Record<string, unknown>)) {
            if (!VALID_PAGE_KEYS.includes(key as any)) {
                return false;
            }
            if (typeof value !== 'boolean') {
                return false;
            }
        }
        return true;
    }

    defaultMessage(args: ValidationArguments): string {
        return `pageAccess must only contain valid page keys (${VALID_PAGE_KEYS.join(', ')}) with boolean values`;
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

