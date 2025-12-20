/**
 * Date Parser Utility - Shared date parsing logic for Indonesian/English dates
 */

const INDONESIAN_MONTHS: Record<string, string> = {
    'januari': 'January',
    'februari': 'February',
    'maret': 'March',
    'april': 'April',
    'mei': 'May',
    'juni': 'June',
    'juli': 'July',
    'agustus': 'August',
    'september': 'September',
    'oktober': 'October',
    'november': 'November',
    'desember': 'December',
};

/**
 * Parses an Indonesian date string to a JavaScript Date object
 * @param dateStr - Date string like "1 November 2024" or "1 oktober 2024"
 * @returns Date object or null if parsing fails
 */
export function parseIndonesianDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    let normalized = dateStr.toLowerCase().trim();

    // Replace Indonesian month names with English equivalents
    for (const [id, en] of Object.entries(INDONESIAN_MONTHS)) {
        normalized = normalized.replace(id, en);
    }

    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parses date in DD/MM/YYYY or DD-MM-YYYY format
 * @param dateStr - Date string like "01/12/2024" or "01-12-2024"
 * @returns Date object or null if parsing fails
 */
export function parseSlashDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (!match) return null;

    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

    return isNaN(date.getTime()) ? null : date;
}

/**
 * Attempts to parse a date string using multiple strategies
 * @param dateStr - Any date string
 * @returns Date object or null if all strategies fail
 */
export function parseFlexibleDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try Indonesian format first
    let result = parseIndonesianDate(dateStr);
    if (result) return result;

    // Try slash/dash format (DD/MM/YYYY)
    result = parseSlashDate(dateStr);
    if (result) return result;

    // Try standard Date parsing as fallback
    const standard = new Date(dateStr);
    return isNaN(standard.getTime()) ? null : standard;
}
