import { Transform } from 'class-transformer';

/**
 * Sanitizes string input by trimming whitespace and optionally removing HTML
 */
export function Sanitize(options: { removeHtml?: boolean } = {}) {
    return Transform(({ value }) => {
        if (typeof value !== 'string') return value;
        
        let sanitized = value.trim();
        
        if (options.removeHtml) {
            // Remove HTML tags but preserve content
            sanitized = sanitized.replace(/<[^>]*>/g, '');
            // Decode common HTML entities
            sanitized = sanitized
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');
        }
        
        // Remove null bytes and control characters (except newlines and tabs)
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        return sanitized;
    });
}

/**
 * Normalizes email to lowercase and trims
 */
export function NormalizeEmail() {
    return Transform(({ value }) => {
        if (typeof value !== 'string') return value;
        return value.trim().toLowerCase();
    });
}

/**
 * Sanitizes filename to prevent path traversal
 */
export function SanitizeFilename() {
    return Transform(({ value }) => {
        if (typeof value !== 'string') return value;
        // Remove path separators and null bytes
        return value
            .replace(/[\/\\]/g, '')
            .replace(/\.\./g, '')
            .replace(/[\x00]/g, '')
            .trim();
    });
}

/**
 * Trim array of strings
 */
export function TrimArray() {
    return Transform(({ value }) => {
        if (!Array.isArray(value)) return value;
        return value.map(item => 
            typeof item === 'string' ? item.trim() : item
        ).filter(item => item !== '');
    });
}
