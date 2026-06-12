import { RRule, rrulestr } from 'rrule';

export class RRuleUtil {
    /**
     * Generate an array of ISO date strings (YYYY-MM-DD) based on a recurrence rule.
     * Limits the output to maxOccurrences to prevent infinite loops.
     */
    static generateDates(rruleStr: string, startDateStr: string, maxOccurrences: number = 50): string[] {
        try {
            // Parse start date
            const startDateParts = startDateStr.split('-');
            if (startDateParts.length !== 3) {
                throw new Error('Start date must be in YYYY-MM-DD format');
            }
            
            // RRule uses UTC dates
            const year = parseInt(startDateParts[0], 10);
            const month = parseInt(startDateParts[1], 10) - 1;
            const day = parseInt(startDateParts[2], 10);
            const dtstart = new Date(Date.UTC(year, month, day, 0, 0, 0));

            // Create options from string
            const rule = rrulestr(rruleStr);
            
            // Merge options with dtstart
            const options = { ...rule.options, dtstart };
            const finalRule = new RRule(options);

            // Get all dates up to maxOccurrences
            const dates = finalRule.all((d, i) => i < maxOccurrences);
            
            // Format back to YYYY-MM-DD
            return dates.map(d => {
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                const d2 = String(d.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d2}`;
            });
        } catch (error: any) {
            throw new Error(`Failed to generate recurring dates: ${error.message}`);
        }
    }
}
