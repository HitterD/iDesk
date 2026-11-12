/** Client-side checks of a user import row (preview step of ImportUsersDialog). */
export interface ParsedRow {
    email: string;
    fullName: string;
    role: string;
    siteCode: string;
    departmentCode?: string;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    isActive?: string;
}

export interface RowValidation {
    row: ParsedRow;
    errors: string[];
    warnings: string[];
    isValid: boolean;
}

export const VALID_ROLES = ['USER', 'AGENT', 'MANAGER', 'ADMIN'];
/** Site codes accepted in an import file; keep in sync with the backend import template (IMPORT_SITE_CODES). */
export const VALID_SITES = ['SPJ', 'KRW', 'SKD', 'SMG', 'JTB'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate a single row
export const validateRow = (row: ParsedRow): RowValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field: email
    if (!row.email || !row.email.trim()) {
        errors.push('Email is required');
    } else if (!EMAIL_REGEX.test(row.email.trim())) {
        errors.push('Invalid email format');
    }

    // Required field: fullName
    if (!row.fullName || !row.fullName.trim()) {
        errors.push('Full name is required');
    }

    // Required field: role (with validation)
    if (!row.role || !row.role.trim()) {
        errors.push('Role is required');
    } else if (!VALID_ROLES.includes(row.role.toUpperCase().trim())) {
        errors.push(`Invalid role: ${row.role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Optional but validated: siteCode
    if (row.siteCode && row.siteCode.trim() && !VALID_SITES.includes(row.siteCode.toUpperCase().trim())) {
        warnings.push(`Unknown site: ${row.siteCode}`);
    }

    // Optional warnings
    if (!row.siteCode || !row.siteCode.trim()) {
        warnings.push('No site assigned');
    }

    return {
        row,
        errors,
        warnings,
        isValid: errors.length === 0
    };
};
