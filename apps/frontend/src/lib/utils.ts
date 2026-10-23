import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDateTime } from "./utils/dateFormat"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Generates a unique ID (UUID or random string fallback)
 * Safe for use in non-secure contexts (HTTP) where crypto.randomUUID is unavailable
 */
export function generateId(): string {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) {
        // Fallback to random string if crypto.randomUUID fails
    }
    
    // Fallback: random string (timestamp + random hex)
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}`;
}

/** Date + time to the second, in the app's Indonesian locale ("23 Okt 2026, 11.09.07"). */
export function formatDate(dateString: string | Date | undefined | null) {
    return formatDateTime(dateString, 'id-ID', { timeStyle: 'medium' });
}
