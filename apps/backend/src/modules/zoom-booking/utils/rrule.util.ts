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

            // Ensure count/until bounds to prevent infinite loops in rrule.all()
            const options = { ...rule.options, dtstart };
            if (!options.until && !options.count) {
                options.count = Math.min(maxOccurrences, 10); // Default to max 10 occurrences if unbounded
            } else if (options.count) {
                options.count = Math.min(options.count, maxOccurrences);
            }

            const finalRule = new RRule(options);

            // Get all dates up to maxOccurrences
            const dates = finalRule.all().slice(0, maxOccurrences);

            // Format back to YYYY-MM-DD
            return dates.map((d: Date) => {
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
