import { RRuleUtil } from '../rrule.util';

describe('RRuleUtil', () => {
    describe('generateDates', () => {
        it('generates daily recurring dates', () => {
            const dates = RRuleUtil.generateDates('FREQ=DAILY;INTERVAL=1;COUNT=3', '2026-09-10');
            expect(dates).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
        });

        it('generates weekly recurring dates', () => {
            const dates = RRuleUtil.generateDates('FREQ=WEEKLY;INTERVAL=1;COUNT=3', '2026-09-10');
            expect(dates).toEqual(['2026-09-10', '2026-09-17', '2026-09-24']);
        });
    });

    describe('toZoomRecurrence', () => {
        it('converts daily RRULE with UNTIL to Zoom recurrence', () => {
            const zoomRecurrence = RRuleUtil.toZoomRecurrence(
                'FREQ=DAILY;INTERVAL=1;UNTIL=20260915T235959Z',
                '2026-09-10'
            );
            expect(zoomRecurrence.type).toBe(1);
            expect(zoomRecurrence.repeat_interval).toBe(1);
            expect(zoomRecurrence.end_date_time).toBe('2026-09-15T23:59:59Z');
        });

        it('converts weekly RRULE with specific days to Zoom recurrence', () => {
            // TU (Tuesday = 3 in Zoom), TH (Thursday = 5 in Zoom)
            const zoomRecurrence = RRuleUtil.toZoomRecurrence(
                'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=6',
                '2026-09-10'
            );
            expect(zoomRecurrence.type).toBe(2);
            expect(zoomRecurrence.repeat_interval).toBe(2);
            expect(zoomRecurrence.weekly_days).toBe('3,5');
            expect(zoomRecurrence.end_times).toBe(6);
        });

        it('derives weekly_days from start date if BYDAY is absent', () => {
            // 2026-09-10 is Thursday (5 in Zoom: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat)
            const zoomRecurrence = RRuleUtil.toZoomRecurrence(
                'FREQ=WEEKLY;INTERVAL=1',
                '2026-09-10'
            );
            expect(zoomRecurrence.type).toBe(2);
            expect(zoomRecurrence.repeat_interval).toBe(1);
            expect(zoomRecurrence.weekly_days).toBe('5');
            expect(zoomRecurrence.end_times).toBe(10);
        });

        it('converts monthly RRULE to Zoom recurrence', () => {
            const zoomRecurrence = RRuleUtil.toZoomRecurrence(
                'FREQ=MONTHLY;INTERVAL=1;COUNT=4',
                '2026-09-10'
            );
            expect(zoomRecurrence.type).toBe(3);
            expect(zoomRecurrence.repeat_interval).toBe(1);
            expect(zoomRecurrence.monthly_day).toBe(10);
            expect(zoomRecurrence.end_times).toBe(4);
        });
    });
});
