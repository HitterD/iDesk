import {
    registerDecorator,
    ValidationOptions,
    ValidationArguments,
} from 'class-validator';

/**
 * Validates that a string does not contain SQL injection patterns
 */
export function NoSqlInjection(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'noSqlInjection',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    if (typeof value !== 'string') return true;
                    
                    const sqlPatterns = [
                        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
                        /(--)|(\/\*)|(\*\/)/,
                        /(;|\||&&)/,
                        /(\bOR\b|\bAND\b)\s*['"]/i,
                    ];
                    
                    return !sqlPatterns.some(pattern => pattern.test(value));
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} contains potentially harmful content`;
                },
            },
        });
    };
}

/**
 * Validates that a string is a safe search query
 */
export function IsSafeSearch(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isSafeSearch',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    if (typeof value !== 'string') return true;
                    if (value.length > 500) return false;
                    
                    // Check for script injection
                    const dangerousPatterns = [
                        /<script/i,
                        /javascript:/i,
                        /on\w+=/i,
                        /data:/i,
                    ];
                    
                    return !dangerousPatterns.some(pattern => pattern.test(value));
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} contains invalid characters`;
                },
            },
        });
    };
}

/**
 * Validates UUID array
 */
export function IsUUIDArray(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isUUIDArray',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    if (!Array.isArray(value)) return false;
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    return value.every(item => typeof item === 'string' && uuidRegex.test(item));
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be an array of valid UUIDs`;
                },
            },
        });
    };
}

/**
 * Validates that number is within a safe range
 */
export function IsSafeInteger(min = 0, max = 1000000, validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isSafeInteger',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any) {
                    if (typeof value !== 'number') return false;
                    return Number.isInteger(value) && value >= min && value <= max;
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be an integer between ${min} and ${max}`;
                },
            },
        });
    };
}
