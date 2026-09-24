import { RRule, rrulestr } from 'rrule';
import { ZoomRecurrenceRequest } from '../adapters/zoom-api.adapter';

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

            // Create options from string with dtstart
            const rule = rrulestr(rruleStr, { dtstart });

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

    /**
     * Convert an iCalendar RRULE string and start date to Zoom API recurrence payload.
     */
    static toZoomRecurrence(rruleStr: string, startDateStr: string, maxOccurrences: number = 50): ZoomRecurrenceRequest {
        try {
            const startDateParts = startDateStr.split('-');
            const year = parseInt(startDateParts[0], 10);
            const month = parseInt(startDateParts[1], 10) - 1;
            const day = parseInt(startDateParts[2], 10);
            const dtstart = new Date(Date.UTC(year, month, day, 0, 0, 0));

            const rule = rrulestr(rruleStr, { dtstart });
            const freq = rule.options.freq;

            let zoomType: 1 | 2 | 3 = 1;
            if (freq === RRule.DAILY) {
                zoomType = 1;
            } else if (freq === RRule.WEEKLY) {
                zoomType = 2;
            } else if (freq === RRule.MONTHLY) {
                zoomType = 3;
            }

            const repeat_interval = Math.max(1, rule.options.interval || 1);

            const result: ZoomRecurrenceRequest = {
                type: zoomType,
                repeat_interval,
            };

            if (zoomType === 2) {
                if (rruleStr.toUpperCase().includes('BYDAY') && rule.options.byweekday && rule.options.byweekday.length > 0) {
                    const days = rule.options.byweekday.map((w: any) => {
                        const dayNum = typeof w === 'number' ? w : w.weekday;
                        // rrule: 0=MO, 1=TU, 2=WE, 3=TH, 4=FR, 5=SA, 6=SU
                        // Zoom: 1=SU, 2=MO, 3=TU, 4=WE, 5=TH, 6=FR, 7=SA
                        return dayNum === 6 ? '1' : String(dayNum + 2);
                    });
                    result.weekly_days = Array.from(new Set(days)).sort().join(',');
                } else {
                    const jsDay = dtstart.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                    result.weekly_days = String(jsDay === 0 ? 1 : jsDay + 1);
                }
            } else if (zoomType === 3) {
                result.monthly_day = dtstart.getUTCDate();
            }

            if (rule.options.until) {
                result.end_date_time = rule.options.until.toISOString().replace(/\.\d{3}Z$/, 'Z');
            } else if (rule.options.count) {
                result.end_times = Math.min(rule.options.count, maxOccurrences);
            } else {
                result.end_times = Math.min(maxOccurrences, 10);
            }

            return result;
        } catch (error: any) {
            throw new Error(`Failed to convert recurrence pattern to Zoom format: ${error.message}`);
        }
    }
}

