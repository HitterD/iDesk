export interface DurationOption {
    value: number;
    label: string;
}

export const formatDurationOptionLabel = (minutes: number): string => {
    const hours = minutes / 60;
    const hoursFormatted = Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
    return `${minutes} menit (${hoursFormatted} jam)`;
};

export const ZOOM_DURATION_OPTIONS: DurationOption[] = [
    { value: 30,  label: '30 menit (0.5 jam)' },
    { value: 60,  label: '60 menit (1 jam)' },
    { value: 90,  label: '90 menit (1.5 jam)' },
    { value: 120, label: '120 menit (2 jam)' },
    { value: 180, label: '180 menit (3 jam)' },
    { value: 240, label: '240 menit (4 jam)' },
    { value: 300, label: '300 menit (5 jam)' },
    { value: 360, label: '360 menit (6 jam)' },
    { value: 420, label: '420 menit (7 jam)' },
    { value: 480, label: '480 menit (8 jam)' },
    { value: 540, label: '540 menit (9 jam)' },
    { value: 600, label: '600 menit (10 jam)' },
    { value: 660, label: '660 menit (11 jam)' },
    { value: 720, label: '720 menit (12 jam)' },
];
