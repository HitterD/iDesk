import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function formatDate(dateString: string | Date | undefined | null) {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Jakarta'
    }).format(new Date(dateString));
}
