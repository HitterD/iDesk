/**
 * Date range presets for reports and filters
 */

export interface DatePreset {
    label: string;
    getValue: () => { startDate: string; endDate: string };
}

const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const DATE_PRESETS: DatePreset[] = [
    {
        label: 'Today',
        getValue: () => {
            const today = new Date();
            return {
                startDate: formatDate(today),
                endDate: formatDate(today),
            };
        },
    },
    {
        label: 'Yesterday',
        getValue: () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                startDate: formatDate(yesterday),
                endDate: formatDate(yesterday),
            };
        },
    },
    {
        label: 'Last 7 days',
        getValue: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);
            return {
                startDate: formatDate(start),
                endDate: formatDate(end),
            };
        },
    },
    {
        label: 'Last 30 days',
        getValue: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);
            return {
                startDate: formatDate(start),
                endDate: formatDate(end),
            };
        },
    },
    {
        label: 'Last 90 days',
        getValue: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 90);
            return {
                startDate: formatDate(start),
                endDate: formatDate(end),
            };
        },
    },
    {
        label: 'This month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return {
                startDate: formatDate(start),
                endDate: formatDate(now),
            };
        },
    },
    {
        label: 'Last month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return {
                startDate: formatDate(start),
                endDate: formatDate(end),
            };
        },
    },
    {
        label: 'This year',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            return {
                startDate: formatDate(start),
                endDate: formatDate(now),
            };
        },
    },
];

export const getDefaultDateRange = () => DATE_PRESETS[3].getValue(); // Last 30 days

export default DATE_PRESETS;
