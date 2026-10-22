import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { invalidateSlaClock } from '@/lib/slaCountdown';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Clock, Save, RotateCcw, Plus, Trash2, Timer, Calendar, Briefcase, Sun, Moon, X, ChevronDown, ChevronUp, Info, Settings2, Zap, Check, Flame, AlertTriangle, ArrowDownCircle, Sparkles } from 'lucide-react';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { format, parseISO } from 'date-fns';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { SetHead } from '@/features/settings/components/SettingsParts';
import '@/features/admin/components/system-health/system-health.css';

// ==========================================
// Types & Interfaces
// ==========================================

interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
    /** False = counts around the clock (24/7), e.g. CRITICAL. */
    businessHoursOnly?: boolean;
}

interface TimeInput {
    days: number;
    hours: number;
    minutes: number;
}

interface BusinessHoursConfig {
    id: string;
    name: string;
    isDefault: boolean;
    workDays: number[];
    startTime: number;
    endTime: number;
    timezone: string;
    holidays: string[];
    startFormatted: string;
    endFormatted: string;
}

// ==========================================
// Priority Styling & Visual Hierarchy (iDesk Theme)
// ==========================================

interface PriorityTheme {
    label: string;
    levelText: string;
    icon: React.FC<{ className?: string }>;
    accentColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    cardBorder: string;
    cardHighlight: string;
    /** Mockup priority hue (Blocker red, Urgent orange, Normal blue, Low gray). */
    hue: string;
}

const PRIORITY_THEMES: Record<string, PriorityTheme> = {
    CRITICAL: {
        label: 'Blocker (Critical)',
        levelText: 'Tingkat Pemblokir Kritis • Penanganan Segera',
        icon: Flame,
        accentColor: 'sla-hue-text',
        badgeBg: 'sla-hue-bg',
        badgeText: 'sla-hue-ink',
        badgeBorder: 'sla-hue-border',
        dotColor: 'sla-hue-dot',
        cardBorder: 'sla-hue-hover',
        cardHighlight: '',
        hue: 'var(--dash-red)',
    },
    HIGH: {
        label: 'Urgent (Major Impact)',
        levelText: 'Tingkat Mendesak (Dampak Besar) • Respon Cepat',
        icon: AlertTriangle,
        accentColor: 'sla-hue-text',
        badgeBg: 'sla-hue-bg',
        badgeText: 'sla-hue-ink',
        badgeBorder: 'sla-hue-border',
        dotColor: 'sla-hue-dot',
        cardBorder: 'sla-hue-hover',
        cardHighlight: '',
        hue: 'var(--dash-orange)',
    },
    MEDIUM: {
        label: 'Normal (Moderate)',
        levelText: 'Tingkat Normal (Moderat) • Standar Operasional',
        icon: Clock,
        accentColor: 'sla-hue-text',
        badgeBg: 'sla-hue-bg',
        badgeText: 'sla-hue-ink',
        badgeBorder: 'sla-hue-border',
        dotColor: 'sla-hue-dot',
        cardBorder: 'sla-hue-hover',
        cardHighlight: '',
        hue: 'var(--dash-blue)',
    },
    LOW: {
        label: 'Low (Minor/Cosmetic)',
        levelText: 'Tingkat Rendah (Minor / Kosmetik) • Standar Normal',
        icon: ArrowDownCircle,
        accentColor: 'sla-hue-text',
        badgeBg: 'sla-hue-bg',
        badgeText: 'sla-hue-ink',
        badgeBorder: 'sla-hue-border',
        dotColor: 'sla-hue-dot',
        cardBorder: 'sla-hue-hover',
        cardHighlight: '',
        hue: 'var(--dash-gray)',
    },
};

const DEFAULT_CUSTOM_THEME: PriorityTheme = {
    label: 'Custom',
    levelText: 'Tingkat Kustom • Konfigurasi Tambahan',
    icon: Sparkles,
    accentColor: 'sla-hue-text',
    badgeBg: 'sla-hue-bg',
    badgeText: 'sla-hue-ink',
    badgeBorder: 'sla-hue-border',
    dotColor: 'sla-hue-dot',
    cardBorder: 'sla-hue-hover',
    cardHighlight: '',
    hue: 'var(--dash-teal)',
};

// ==========================================
// Constants
// ==========================================

const DAYS_OF_WEEK = [
    { value: 1, label: 'Senin', short: 'Sen' },
    { value: 2, label: 'Selasa', short: 'Sel' },
    { value: 3, label: 'Rabu', short: 'Rab' },
    { value: 4, label: 'Kamis', short: 'Kam' },
    { value: 5, label: 'Jumat', short: 'Jum' },
    { value: 6, label: 'Sabtu', short: 'Sab' },
    { value: 0, label: 'Minggu', short: 'Min' },
];

const TIMEZONES = [
    'Asia/Jakarta',
    'Asia/Makassar',
    'Asia/Jayapura',
    'Asia/Singapore',
    'UTC',
];

const DEFAULT_WORK_MINUTES_PER_DAY = 540; // 9 hours (08:00 - 17:00)

// ==========================================
// Time Helpers (Berbasis Jam Kerja Dinamis)
// ==========================================

const minutesToTimeInput = (totalMinutes: number, workMinutesPerDay: number = DEFAULT_WORK_MINUTES_PER_DAY): TimeInput => {
    const validWorkMinutes = Math.max(60, workMinutesPerDay);
    const days = Math.floor(totalMinutes / validWorkMinutes);
    const rem = totalMinutes % validWorkMinutes;
    const hours = Math.floor(rem / 60);
    const minutes = rem % 60;
    return { days, hours, minutes };
};

const timeInputToMinutes = (time: TimeInput, workMinutesPerDay: number = DEFAULT_WORK_MINUTES_PER_DAY): number => {
    const validWorkMinutes = Math.max(60, workMinutesPerDay);
    return (time.days * validWorkMinutes) + (time.hours * 60) + time.minutes;
};

const formatWorkingDurationText = (totalMinutes: number, workMinutesPerDay: number = DEFAULT_WORK_MINUTES_PER_DAY): string => {
    if (totalMinutes === 0) return '0 menit';
    const { days, hours, minutes } = minutesToTimeInput(totalMinutes, workMinutesPerDay);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} hari kerja`);
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0) parts.push(`${minutes} mnt`);
    return parts.join(' ');
};

// ==========================================
// Component: Duration Input Group (Elegan & Intuitif)
// ==========================================

interface DurationInputGroupProps {
    label: string;
    description: string;
    icon: React.ReactNode;
    iconBgClass?: string;
    value: TimeInput;
    onChange: (value: TimeInput) => void;
    workHoursPerDay: number;
    workMinutesPerDay: number;
    presets?: { label: string; days: number; hours: number; minutes: number }[];
}

const DurationInputGroup: React.FC<DurationInputGroupProps> = ({
    label,
    description,
    icon,
    iconBgClass = 'bg-brand/10 text-brand',
    value,
    onChange,
    workHoursPerDay,
    workMinutesPerDay,
    presets,
}) => {
    const totalMinutes = timeInputToMinutes(value, workMinutesPerDay);
    const maxHoursAllowed = Math.max(1, Math.floor(workHoursPerDay) - 1);

    return (
        <div className="p-4 bg-fill rounded-2xl border border-line space-y-3.5">
            {/* Header & Live Formatted Badge */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs", iconBgClass)}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-ink block truncate">
                            {label}
                        </span>
                        <span className="text-[11px] text-ink-2 block leading-tight">
                            {description}
                        </span>
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <span className="inline-block text-xs font-bold font-mono text-ink bg-surface px-3 py-1 rounded-full border border-line shadow-2xs whitespace-nowrap">
                        {formatWorkingDurationText(totalMinutes, workMinutesPerDay)}
                    </span>
                </div>
            </div>

            {/* Inputs Group: Hari Kerja, Jam Kerja, Menit */}
            <div className="grid grid-cols-3 gap-2.5">
                {/* Hari Kerja */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between px-0.5">
                        <label className="text-[10px] font-bold text-ink-2 uppercase tracking-wider">
                            Hari Kerja
                        </label>
                        <span className="text-[9px] font-mono text-ink-3">
                            @{workHoursPerDay}j
                        </span>
                    </div>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            min="0"
                            value={value.days === 0 ? '' : value.days}
                            placeholder="0"
                            onChange={(e) => onChange({ ...value, days: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full pl-3 pr-8 py-2 bg-surface border border-line rounded-xl text-xs font-mono font-semibold text-ink focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all shadow-2xs"
                        />
                        <span className="absolute right-2.5 text-[11px] font-bold text-ink-3 select-none pointer-events-none">
                            hk
                        </span>
                    </div>
                </div>

                {/* Jam Kerja */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between px-0.5">
                        <label className="text-[10px] font-bold text-ink-2 uppercase tracking-wider">
                            Jam Kerja
                        </label>
                        <span className="text-[9px] font-mono text-ink-3">
                            0-{maxHoursAllowed}j
                        </span>
                    </div>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            min="0"
                            max={maxHoursAllowed}
                            value={value.hours === 0 ? '' : value.hours}
                            placeholder="0"
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                onChange({ ...value, hours: Math.min(maxHoursAllowed, Math.max(0, val)) });
                            }}
                            className="w-full pl-3 pr-9 py-2 bg-surface border border-line rounded-xl text-xs font-mono font-semibold text-ink focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all shadow-2xs"
                        />
                        <span className="absolute right-2.5 text-[11px] font-bold text-ink-3 select-none pointer-events-none">
                            jam
                        </span>
                    </div>
                </div>

                {/* Menit */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between px-0.5">
                        <label className="text-[10px] font-bold text-ink-2 uppercase tracking-wider">
                            Menit
                        </label>
                        <span className="text-[9px] font-mono text-ink-3">
                            0-59m
                        </span>
                    </div>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={value.minutes === 0 ? '' : value.minutes}
                            placeholder="0"
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                onChange({ ...value, minutes: Math.min(59, Math.max(0, val)) });
                            }}
                            className="w-full pl-3 pr-9 py-2 bg-surface border border-line rounded-xl text-xs font-mono font-semibold text-ink focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all shadow-2xs"
                        />
                        <span className="absolute right-2.5 text-[11px] font-bold text-ink-3 select-none pointer-events-none">
                            mnt
                        </span>
                    </div>
                </div>
            </div>

            {/* Presets Chips */}
            {presets && presets.length > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-ink-3 mr-0.5">
                        Preset:
                    </span>
                    {presets.map((preset) => {
                        const isCurrent =
                            value.days === preset.days &&
                            value.hours === preset.hours &&
                            value.minutes === preset.minutes;

                        return (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => onChange({
                                    days: preset.days,
                                    hours: preset.hours,
                                    minutes: preset.minutes,
                                })}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 whitespace-nowrap active:scale-95",
                                    isCurrent
                                        ? "bg-brand text-white font-semibold shadow-2xs"
                                        : "bg-surface text-ink-2 hover:text-ink border border-line hover:border-line-strong"
                                )}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ==========================================
// Component: SlaCard (Berkarakter & Elegan)
// ==========================================

interface SlaCardProps {
    config: SlaConfig;
    workHoursPerDay: number;
    workMinutesPerDay: number;
    onUpdate: (id: string, data: { resolutionTimeMinutes: number; responseTimeMinutes: number; businessHoursOnly: boolean }) => void;
    onDelete: (id: string) => void;
    isPending: boolean;
}

const SlaCard: React.FC<SlaCardProps> = ({
    config,
    workHoursPerDay,
    workMinutesPerDay,
    onUpdate,
    onDelete,
    isPending,
}) => {
    const [resolutionTime, setResolutionTime] = useState<TimeInput>(() =>
        minutesToTimeInput(config.resolutionTimeMinutes, workMinutesPerDay)
    );
    const [responseTime, setResponseTime] = useState<TimeInput>(() =>
        minutesToTimeInput(config.responseTimeMinutes, workMinutesPerDay)
    );
    const [businessHoursOnly, setBusinessHoursOnly] = useState(config.businessHoursOnly !== false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setResolutionTime(minutesToTimeInput(config.resolutionTimeMinutes, workMinutesPerDay));
        setResponseTime(minutesToTimeInput(config.responseTimeMinutes, workMinutesPerDay));
        setBusinessHoursOnly(config.businessHoursOnly !== false);
    }, [config.resolutionTimeMinutes, config.responseTimeMinutes, config.businessHoursOnly, workMinutesPerDay]);

    useEffect(() => {
        const newResolution = timeInputToMinutes(resolutionTime, workMinutesPerDay);
        const newResponse = timeInputToMinutes(responseTime, workMinutesPerDay);
        setHasChanges(
            newResolution !== config.resolutionTimeMinutes ||
            newResponse !== config.responseTimeMinutes ||
            businessHoursOnly !== (config.businessHoursOnly !== false)
        );
    }, [resolutionTime, responseTime, businessHoursOnly, config, workMinutesPerDay]);

    const handleSave = () => {
        onUpdate(config.id, {
            resolutionTimeMinutes: timeInputToMinutes(resolutionTime, workMinutesPerDay),
            responseTimeMinutes: timeInputToMinutes(responseTime, workMinutesPerDay),
            businessHoursOnly,
        });
    };

    const handleRevert = () => {
        setResolutionTime(minutesToTimeInput(config.resolutionTimeMinutes, workMinutesPerDay));
        setResponseTime(minutesToTimeInput(config.responseTimeMinutes, workMinutesPerDay));
        setBusinessHoursOnly(config.businessHoursOnly !== false);
    };

    const theme = PRIORITY_THEMES[config.priority] || DEFAULT_CUSTOM_THEME;
    const PriorityIcon = theme.icon;
    const isDefault = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(config.priority);

    // Opsi preset dinamis berbasis jam kerja
    const resolutionPresets = useMemo(() => [
        { label: '2 Jam', days: 0, hours: 2, minutes: 0 },
        { label: '4 Jam', days: 0, hours: 4, minutes: 0 },
        { label: `1 Hari Kerja (${workHoursPerDay}j)`, days: 1, hours: 0, minutes: 0 },
        { label: '2 Hari Kerja', days: 2, hours: 0, minutes: 0 },
        { label: '3 Hari Kerja', days: 3, hours: 0, minutes: 0 },
        { label: '5 Hari Kerja', days: 5, hours: 0, minutes: 0 },
    ], [workHoursPerDay]);

    const responsePresets = useMemo(() => [
        { label: '15 Menit', days: 0, hours: 0, minutes: 15 },
        { label: '30 Menit', days: 0, hours: 0, minutes: 30 },
        { label: '1 Jam', days: 0, hours: 1, minutes: 0 },
        { label: '2 Jam', days: 0, hours: 2, minutes: 0 },
        { label: '4 Jam', days: 0, hours: 4, minutes: 0 },
        { label: '1 Hari Kerja', days: 1, hours: 0, minutes: 0 },
    ], []);

    return (
        <div style={{ ['--c' as string]: theme.hue }} className={cn(
            "bg-surface border rounded-3xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden",
            theme.cardHighlight,
            theme.cardBorder,
            hasChanges
                ? "border-brand ring-2 ring-brand/20"
                : "border-line"
        )}>
            {/* Priority Header: Distinctive Badge, Hierarchy Subtitle, and Actions */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-line">
                <div className="flex items-center gap-3">
                    {/* Priority Badge with Icon & Glowing Dot */}
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold tracking-wide shadow-2xs",
                        theme.badgeBg,
                        theme.badgeText,
                        theme.badgeBorder
                    )}>
                        <PriorityIcon className={cn("w-3.5 h-3.5", theme.accentColor)} />
                        <span>{theme.label || config.priority}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full ml-0.5", theme.dotColor)} />
                    </div>

                    <div>
                        <span className="text-[11px] font-medium text-ink-2 block">
                            {theme.levelText}
                        </span>
                    </div>
                </div>

                {/* Card Top Actions */}
                <div className="flex items-center gap-1.5">
                    {hasChanges ? (
                        <>
                            <button
                                type="button"
                                onClick={handleRevert}
                                title="Batal ubah"
                                className="p-1.5 text-ink-3 hover:text-ink-2 rounded-lg hover:bg-fill transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <Button variant="primary"
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex"
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>Simpan</span>
                            </Button>
                        </>
                    ) : (
                        <span className="text-[11px] font-medium text-ink-3 flex items-center gap-1 px-2 py-1">
                            <Check className="w-3.5 h-3.5 text-ok" />
                            Tersimpan
                        </span>
                    )}

                    {!isDefault && (
                        <button
                            type="button"
                            onClick={() => onDelete(config.id)}
                            title="Hapus prioritas ini"
                            className="p-1.5 text-ink-3 hover:text-bad-ink rounded-lg hover:bg-bad/10 transition-colors ml-0.5"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Input Sections */}
            <div className="space-y-3.5">
                {/* Resolution Time */}
                <DurationInputGroup
                    label="Target Waktu Penyelesaian (Resolution SLA)"
                    description={`Batas maksimal tiket diselesaikan (1 HK = ${workHoursPerDay} jam kerja)`}
                    icon={<Timer className="w-4 h-4" />}
                    iconBgClass="bg-brand/10 text-brand"
                    value={resolutionTime}
                    onChange={setResolutionTime}
                    workHoursPerDay={workHoursPerDay}
                    workMinutesPerDay={workMinutesPerDay}
                    presets={resolutionPresets}
                />

                {/* First Response Time */}
                <DurationInputGroup
                    label="Target Respon Awal (First Response SLA)"
                    description="Batas maksimal respon pertama oleh teknisi/agen"
                    icon={<Zap className="w-4 h-4" />}
                    iconBgClass="bg-warn/10 text-warn-ink"
                    value={responseTime}
                    onChange={setResponseTime}
                    workHoursPerDay={workHoursPerDay}
                    workMinutesPerDay={workMinutesPerDay}
                    presets={responsePresets}
                />

                {/* Counting mode */}
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-line cursor-pointer hover:bg-fill transition-colors">
                    <input
                        type="checkbox"
                        checked={businessHoursOnly}
                        onChange={(e) => setBusinessHoursOnly(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
                    />
                    <span>
                        <span className="block text-xs font-semibold text-ink">Hanya jam kerja</span>
                        <span className="block text-[11px] text-ink-2">
                            {businessHoursOnly
                                ? 'SLA berhenti di luar jam kerja, akhir pekan, dan hari libur.'
                                : 'SLA berjalan 24/7 termasuk malam, akhir pekan, dan hari libur.'}
                        </span>
                    </span>
                </label>
            </div>
        </div>
    );
};

// ==========================================
// Component: Guidance Banner (Elegan)
// ==========================================

interface SlaGuidanceBannerProps {
    workHoursPerDay: number;
    startFormatted: string;
    endFormatted: string;
}

const SlaGuidanceBanner: React.FC<SlaGuidanceBannerProps> = ({
    workHoursPerDay,
    startFormatted,
    endFormatted,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-line p-4 shadow-xs">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 shadow-2xs">
                        <Info className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                            Aturan Perhitungan SLA
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/15 text-brand">
                                1 HK = {workHoursPerDay} Jam ({startFormatted} – {endFormatted})
                            </span>
                        </h3>
                        <p className="text-[11px] text-ink-2">
                            Timer SLA hanya aktif pada jam operasional kerja (akhir pekan dan hari libur nasional otomatis tidak dihitung).
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-xs font-semibold text-brand hover:text-brand flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-brand/10 transition-colors shrink-0 ml-2"
                >
                    <span>{isOpen ? 'Sembunyikan' : 'Lihat Detail Aturan'}</span>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {isOpen && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3.5 mt-3 border-t border-line text-xs animate-in fade-in-50 duration-200">
                    <div className="p-3 bg-fill rounded-xl border border-line space-y-1">
                        <div className="flex items-center gap-1.5 text-ink font-bold">
                            <Timer className="w-3.5 h-3.5 text-brand" />
                            <span>Resolution SLA ({workHoursPerDay}j/HK)</span>
                        </div>
                        <p className="text-[11px] text-ink-2 leading-relaxed">
                            Batas waktu tiket harus diselesaikan secara penuh oleh teknisi/agen. Dihitung murni saat jam operasional aktif.
                        </p>
                    </div>

                    <div className="p-3 bg-fill rounded-xl border border-line space-y-1">
                        <div className="flex items-center gap-1.5 text-ink font-bold">
                            <Zap className="w-3.5 h-3.5 text-warn" />
                            <span>First Response SLA</span>
                        </div>
                        <p className="text-[11px] text-ink-2 leading-relaxed">
                            Target respon awal tiket. Timer SLA otomatis <strong>dijeda</strong> saat tiket berstatus <em>Waiting Vendor</em>.
                        </p>
                    </div>

                    <div className="p-3 bg-fill rounded-xl border border-line space-y-1">
                        <div className="flex items-center gap-1.5 text-ink font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-brand" />
                            <span>Hardware Installation SLA</span>
                        </div>
                        <p className="text-[11px] text-ink-2 leading-relaxed">
                            Target otomatis dihitung dari <strong>Tanggal Terjadwal + 1 Hari Kerja (H+1)</strong> tanpa First Response SLA.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// Main Page Component: BentoSlaSettingsPage
// ==========================================

export const BentoSlaSettingsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('priority');
    const [isAdding, setIsAdding] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'reset' | 'holiday'; id?: string } | null>(null);

    // Queries
    const { data: configs = [], isLoading } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
    });

    const { data: businessHours, isLoading: loadingBusinessHours } = useQuery<BusinessHoursConfig>({
        queryKey: ['business-hours'],
        queryFn: async () => {
            const res = await api.get('/business-hours');
            return res.data;
        },
    });

    // Hitung jam & menit kerja per hari dari businessHours
    const { workHoursPerDay, workMinutesPerDay } = useMemo(() => {
        if (!businessHours || !businessHours.startTime || !businessHours.endTime) {
            return { workHoursPerDay: 9, workMinutesPerDay: DEFAULT_WORK_MINUTES_PER_DAY };
        }
        const diff = Math.max(60, businessHours.endTime - businessHours.startTime);
        const hours = Math.round((diff / 60) * 10) / 10;
        return { workHoursPerDay: hours, workMinutesPerDay: diff };
    }, [businessHours]);

    // Add Form State
    const [newPriority, setNewPriority] = useState('');
    const [newResolutionTime, setNewResolutionTime] = useState<TimeInput>({ days: 1, hours: 0, minutes: 0 });
    const [newResponseTime, setNewResponseTime] = useState<TimeInput>({ days: 0, hours: 2, minutes: 0 });

    // Holiday Form State
    const [newHoliday, setNewHoliday] = useState('');
    const [isAddingHoliday, setIsAddingHoliday] = useState(false);

    // Mutations
    const updateBusinessHoursMutation = useMutation({
        mutationFn: async (data: Partial<BusinessHoursConfig>) => {
            await api.put('/business-hours', data);
        },
        onSuccess: () => {
            toast.success('Jam kerja operasional berhasil diperbarui');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            invalidateSlaClock();
        },
        onError: () => toast.error('Gagal memperbarui jam kerja operasional'),
    });

    const addHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            await api.post('/business-hours/holidays', { date });
        },
        onSuccess: () => {
            toast.success('Hari libur berhasil ditambahkan');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            invalidateSlaClock();
            setNewHoliday('');
            setIsAddingHoliday(false);
        },
        onError: () => toast.error('Gagal menambahkan hari libur'),
    });

    const removeHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            await api.delete(`/business-hours/holidays/${date}`);
        },
        onSuccess: () => {
            toast.success('Hari libur berhasil dihapus');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            invalidateSlaClock();
        },
        onError: () => toast.error('Gagal menghapus hari libur'),
    });

    const updateSlaMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: { resolutionTimeMinutes: number; responseTimeMinutes: number; businessHoursOnly: boolean } }) => {
            await api.patch(`/sla-config/${id}`, data);
        },
        onSuccess: () => {
            toast.success('Konfigurasi SLA berhasil diperbarui');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            invalidateSlaClock();
        },
        onError: () => toast.error('Gagal memperbarui konfigurasi SLA'),
    });

    const createSlaMutation = useMutation({
        mutationFn: async (data: { priority: string; resolutionTimeMinutes: number; responseTimeMinutes: number }) => {
            await api.post('/sla-config', data);
        },
        onSuccess: () => {
            toast.success('Prioritas SLA baru berhasil ditambahkan');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            invalidateSlaClock();
            setIsAdding(false);
            setNewPriority('');
            setNewResolutionTime({ days: 1, hours: 0, minutes: 0 });
            setNewResponseTime({ days: 0, hours: 2, minutes: 0 });
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Gagal menambahkan prioritas SLA'),
    });

    const deleteSlaMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/sla-config/${id}`);
        },
        onSuccess: () => {
            toast.success('Konfigurasi SLA berhasil dihapus');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            invalidateSlaClock();
        },
        onError: () => toast.error('Gagal menghapus konfigurasi SLA'),
    });

    const resetSlaMutation = useMutation({
        mutationFn: async () => {
            await api.post('/sla-config/reset');
        },
        onSuccess: () => {
            toast.success('Konfigurasi SLA berhasil direset ke default');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            invalidateSlaClock();
        },
        onError: () => toast.error('Gagal mereset konfigurasi SLA'),
    });

    const handleAdd = () => {
        if (!newPriority.trim()) {
            toast.error('Nama tingkat prioritas wajib diisi');
            return;
        }

        const resMinutes = timeInputToMinutes(newResolutionTime, workMinutesPerDay);
        const respMinutes = timeInputToMinutes(newResponseTime, workMinutesPerDay);

        if (resMinutes === 0) {
            toast.error('Target waktu resolusi harus lebih dari 0 menit');
            return;
        }

        createSlaMutation.mutate({
            priority: newPriority.trim().toUpperCase(),
            resolutionTimeMinutes: resMinutes,
            responseTimeMinutes: respMinutes,
        });
    };

    const handleUpdate = (id: string, data: { resolutionTimeMinutes: number; responseTimeMinutes: number; businessHoursOnly: boolean }) => {
        updateSlaMutation.mutate({ id, data });
    };

    const handleDelete = (id: string) => {
        setConfirmAction({ type: 'delete', id });
    };

    const handleReset = () => {
        setConfirmAction({ type: 'reset' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-ink-3">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-xs">Memuat data SLA...</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 max-w-5xl">
            {/* Header Area (mockup settings.html "SLA Settings") */}
            <SetHead title="SLA Settings" sub={`Target respon dan penyelesaian per prioritas, dihitung dalam jam kerja (${workHoursPerDay} jam/hari).`}
                actions={<span className="hl-live"><i />{configs.length} level prioritas aktif</span>} />

            {/* Guidance Banner */}
            <SlaGuidanceBanner
                workHoursPerDay={workHoursPerDay}
                startFormatted={businessHours?.startFormatted || '08:00'}
                endFormatted={businessHours?.endFormatted || '17:00'}
            />

            {/* Navigation Tabs & Toolbar */}
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                    {/* Modern Tabs List */}
                    <Tabs.List className="flex gap-1.5 p-1.5 bg-fill rounded-2xl w-full sm:w-fit border border-line">
                        <Tabs.Trigger
                            value="priority"
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 outline-none",
                                "data-[state=active]:bg-surface  data-[state=active]:text-brand  data-[state=active]:shadow-xs",
                                "text-ink-2 hover:text-ink"
                            )}
                        >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span>Prioritas SLA</span>
                            <span className="text-[10px] bg-fill-2 text-ink px-1.5 py-0.2 rounded-full font-mono">
                                {configs.length}
                            </span>
                        </Tabs.Trigger>

                        <Tabs.Trigger
                            value="hours"
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 outline-none",
                                "data-[state=active]:bg-surface  data-[state=active]:text-brand  data-[state=active]:shadow-xs",
                                "text-ink-2 hover:text-ink"
                            )}
                        >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>Jam Kerja ({workHoursPerDay}j/hari)</span>
                        </Tabs.Trigger>

                        <Tabs.Trigger
                            value="holidays"
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 outline-none",
                                "data-[state=active]:bg-surface  data-[state=active]:text-brand  data-[state=active]:shadow-xs",
                                "text-ink-2 hover:text-ink"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Hari Libur</span>
                            {businessHours?.holidays?.length ? (
                                <span className="text-[10px] bg-bad/15 text-bad-ink px-1.5 py-0.2 rounded-full font-mono font-bold">
                                    {businessHours.holidays.length}
                                </span>
                            ) : null}
                        </Tabs.Trigger>
                    </Tabs.List>

                    {/* Toolbar Actions */}
                    {activeTab === 'priority' && (
                        <div className="flex items-center gap-2 justify-end">
                            <Button
                                onClick={handleReset}
                                variant="soft"
                                size="sm"
                                disabled={resetSlaMutation.isPending}
                                className="text-ink-2"
                            >
                                <RotateCcw className={cn("w-3.5 h-3.5 mr-1.5", resetSlaMutation.isPending && "animate-spin")} />
                                Reset Default
                            </Button>

                            <Button variant="primary"
                                onClick={() => setIsAdding(!isAdding)}
                                size="sm"
                                className="flex"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {isAdding ? 'Tutup Form' : 'Tambah Prioritas'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* ========================================== */}
                {/* TAB 1: Priority SLA */}
                {/* ========================================== */}
                <Tabs.Content value="priority" className="pt-4 space-y-4 outline-none animate-in fade-in-50 duration-150">
                    {/* Add Custom Form */}
                    {isAdding && (
                        <div className="bg-surface rounded-3xl p-5 md:p-6 border-2 border-dashed border-brand/30 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between pb-3 border-b border-line">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-brand/15 text-brand flex items-center justify-center">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-ink">
                                            Tambah Tingkat Prioritas SLA Baru
                                        </h3>
                                        <p className="text-xs text-ink-2">
                                            Konfigurasi target penyelesaian dan respon awal berbasis jam operasional aktif.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="p-1.5 text-ink-3 hover:text-ink-2 rounded-lg hover:bg-fill"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-ink block mb-1.5">
                                        Nama Prioritas <span className="text-bad">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Contoh: URGENT, VIP, BLOCKER"
                                        value={newPriority}
                                        onChange={(e) => setNewPriority(e.target.value.toUpperCase())}
                                        className="w-full max-w-md px-3.5 py-2 bg-fill border border-line rounded-xl text-xs font-mono font-bold uppercase text-ink focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DurationInputGroup
                                        label="Target Waktu Penyelesaian"
                                        description={`Batas waktu penyelesaian (1 HK = ${workHoursPerDay} jam kerja)`}
                                        icon={<Timer className="w-4 h-4" />}
                                        iconBgClass="bg-brand/10 text-brand"
                                        value={newResolutionTime}
                                        onChange={setNewResolutionTime}
                                        workHoursPerDay={workHoursPerDay}
                                        workMinutesPerDay={workMinutesPerDay}
                                        presets={[
                                            { label: '2 Jam', days: 0, hours: 2, minutes: 0 },
                                            { label: '4 Jam', days: 0, hours: 4, minutes: 0 },
                                            { label: '1 Hari Kerja', days: 1, hours: 0, minutes: 0 },
                                            { label: '2 Hari Kerja', days: 2, hours: 0, minutes: 0 },
                                        ]}
                                    />

                                    <DurationInputGroup
                                        label="Target Respon Awal"
                                        description="Batas waktu respon pertama teknisi"
                                        icon={<Zap className="w-4 h-4" />}
                                        iconBgClass="bg-warn/10 text-warn-ink"
                                        value={newResponseTime}
                                        onChange={setNewResponseTime}
                                        workHoursPerDay={workHoursPerDay}
                                        workMinutesPerDay={workMinutesPerDay}
                                        presets={[
                                            { label: '15 Menit', days: 0, hours: 0, minutes: 15 },
                                            { label: '30 Menit', days: 0, hours: 0, minutes: 30 },
                                            { label: '1 Jam', days: 0, hours: 1, minutes: 0 },
                                            { label: '2 Jam', days: 0, hours: 2, minutes: 0 },
                                        ]}
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-1">
                                    <Button
                                        type="button"
                                        variant="soft"
                                        size="sm"
                                        onClick={() => setIsAdding(false)}
                                       
                                    >
                                        Batal
                                    </Button>
                                    <Button variant="primary"
                                        type="button"
                                        size="sm"
                                        onClick={handleAdd}
                                        disabled={createSlaMutation.isPending}
                                       
                                    >
                                        Simpan Prioritas
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Priority Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {configs.map((config) => (
                            <SlaCard
                                key={config.id}
                                config={config}
                                workHoursPerDay={workHoursPerDay}
                                workMinutesPerDay={workMinutesPerDay}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                isPending={updateSlaMutation.isPending}
                            />
                        ))}
                    </div>

                    {configs.length === 0 && (
                        <div className="text-center py-12 bg-surface border border-line rounded-3xl space-y-3">
                            <Clock className="w-10 h-10 text-ink-3 mx-auto" />
                            <p className="text-xs text-ink-2">Belum ada konfigurasi SLA.</p>
                            <Button variant="primary"
                                onClick={handleReset}
                                size="sm"
                               
                            >
                                Reset ke Default
                            </Button>
                        </div>
                    )}
                </Tabs.Content>

                {/* ========================================== */}
                {/* TAB 2: Business Hours */}
                {/* ========================================== */}
                <Tabs.Content value="hours" className="pt-4 space-y-4 outline-none animate-in fade-in-50 duration-150">
                    {loadingBusinessHours ? (
                        <div className="flex justify-center py-12 text-ink-3">
                            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : businessHours ? (
                        <div className="bg-surface rounded-3xl p-6 border border-line space-y-6 shadow-xs">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-line">
                                <div>
                                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                                        <Briefcase className="w-4 h-4 text-brand" />
                                        Jadwal & Jam Kerja Operasional
                                    </h3>
                                    <p className="text-xs text-ink-2 mt-0.5">
                                        Waktu di luar jam kerja aktif tidak dihitung ke dalam penalti timer SLA.
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-brand bg-brand/10 border border-brand/30 px-3 py-1 rounded-xl shadow-2xs">
                                    {workHoursPerDay} jam / hari kerja
                                </span>
                            </div>

                            {/* Work Days Toggle */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-bold text-ink block">
                                    Hari Kerja Aktif
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const isSelected = businessHours.workDays?.includes(day.value);
                                        return (
                                            <button
                                                key={day.value}
                                                type="button"
                                                onClick={() => {
                                                    const newDays = isSelected
                                                        ? businessHours.workDays.filter(d => d !== day.value)
                                                        : [...businessHours.workDays, day.value].sort();
                                                    updateBusinessHoursMutation.mutate({ workDays: newDays });
                                                }}
                                                disabled={updateBusinessHoursMutation.isPending}
                                                className={cn(
                                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 shadow-2xs",
                                                    isSelected
                                                        ? "bg-brand text-white shadow-xs ring-2 ring-brand/20"
                                                        : "bg-fill text-ink-2 hover:bg-fill-2 border border-line"
                                                )}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Working Hours Time Pickers */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-fill rounded-2xl border border-line space-y-2">
                                    <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                                        <Sun className="w-4 h-4 text-warn" />
                                        Jam Mulai Operasional
                                    </label>
                                    <input
                                        type="time"
                                        value={businessHours.startFormatted || '08:00'}
                                        onChange={(e) => {
                                            const [hours, mins] = e.target.value.split(':').map(Number);
                                            updateBusinessHoursMutation.mutate({ startTime: hours * 60 + mins });
                                        }}
                                        className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-xl font-mono text-xs font-bold text-ink focus:ring-2 focus:ring-brand/20 outline-none"
                                    />
                                </div>

                                <div className="p-4 bg-fill rounded-2xl border border-line space-y-2">
                                    <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                                        <Moon className="w-4 h-4 text-brand" />
                                        Jam Selesai Operasional
                                    </label>
                                    <input
                                        type="time"
                                        value={businessHours.endFormatted || '17:00'}
                                        onChange={(e) => {
                                            const [hours, mins] = e.target.value.split(':').map(Number);
                                            updateBusinessHoursMutation.mutate({ endTime: hours * 60 + mins });
                                        }}
                                        className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-xl font-mono text-xs font-bold text-ink focus:ring-2 focus:ring-brand/20 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Timezone */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-ink block">
                                    Zona Waktu (Timezone)
                                </label>
                                <select
                                    value={businessHours.timezone || 'Asia/Jakarta'}
                                    onChange={(e) => updateBusinessHoursMutation.mutate({ timezone: e.target.value })}
                                    className="w-full max-w-xs px-3.5 py-2.5 bg-surface border border-line rounded-xl text-xs font-semibold text-ink focus:ring-2 focus:ring-brand/20 outline-none"
                                >
                                    {TIMEZONES.map((tz) => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : null}
                </Tabs.Content>

                {/* ========================================== */}
                {/* TAB 3: Holidays */}
                {/* ========================================== */}
                <Tabs.Content value="holidays" className="pt-4 space-y-4 outline-none animate-in fade-in-50 duration-150">
                    <div className="bg-surface rounded-3xl p-6 border border-line space-y-5 shadow-xs">
                        {/* Header & Add Button */}
                        <div className="flex items-center justify-between pb-4 border-b border-line">
                            <div>
                                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-bad" />
                                    Daftar Hari Libur ({businessHours?.holidays?.length || 0})
                                </h3>
                                <p className="text-xs text-ink-2 mt-0.5">
                                    Timer SLA tiket otomatis dijeda pada tanggal hari libur terdaftar.
                                </p>
                            </div>

                            <Button variant="primary"
                                onClick={() => setIsAddingHoliday(!isAddingHoliday)}
                                size="sm"
                                className="flex"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {isAddingHoliday ? 'Batal' : 'Tambah Hari Libur'}
                            </Button>
                        </div>

                        {/* Add Holiday Form */}
                        {isAddingHoliday && (
                            <div className="p-4 bg-bad/10 border border-bad/30 rounded-2xl space-y-2.5">
                                <label className="text-xs font-bold text-ink block">
                                    Pilih Tanggal Hari Libur
                                </label>
                                <div className="flex items-center gap-2.5">
                                    <ModernDatePicker
                                        value={newHoliday ? parseISO(newHoliday) : undefined}
                                        onChange={(date) => setNewHoliday(format(date, 'yyyy-MM-dd'))}
                                        placeholder="Pilih tanggal hari libur"
                                        minDate={new Date()}
                                        triggerClassName="flex-1 bg-surface rounded-xl"
                                    />
                                    <Button variant="primary"
                                        onClick={() => newHoliday && addHolidayMutation.mutate(newHoliday)}
                                        size="sm"
                                        disabled={!newHoliday || addHolidayMutation.isPending}
                                       
                                    >
                                        Simpan
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAddingHoliday(false); setNewHoliday(''); }}
                                        className="p-2 text-ink-3 hover:text-ink-2 rounded-xl"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Holidays Grid */}
                        {businessHours?.holidays && businessHours.holidays.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-custom">
                                {businessHours.holidays.slice().sort().map((holiday) => {
                                    const date = new Date(holiday + 'T00:00:00');
                                    const isPast = date < new Date();

                                    return (
                                        <div
                                            key={holiday}
                                            className={cn(
                                                "flex items-center justify-between p-3.5 rounded-2xl border transition-all",
                                                isPast
                                                    ? "bg-fill border-line opacity-60"
                                                    : "bg-surface border-line shadow-2xs hover:border-bad/30"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-bad/10 text-bad flex items-center justify-center shrink-0">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-xs text-ink">
                                                        {date.toLocaleDateString('id-ID', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </p>
                                                    <span className="text-[10px] text-ink-3 font-medium">
                                                        {isPast ? 'Telah lewat' : 'Mendatang'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setConfirmAction({ type: 'holiday', id: holiday })}
                                                className="p-1.5 text-ink-3 hover:text-bad-ink rounded-lg hover:bg-bad/10 transition-colors"
                                                title="Hapus hari libur"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-ink-3">
                                <p className="text-xs">Belum ada hari libur yang dikonfigurasi.</p>
                            </div>
                        )}
                    </div>
                </Tabs.Content>
            </Tabs.Root>

            {/* Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={confirmAction !== null}
                title={
                    confirmAction?.type === 'delete' ? 'Hapus Konfigurasi SLA' :
                    confirmAction?.type === 'reset' ? 'Reset Konfigurasi SLA ke Default' :
                    'Hapus Hari Libur'
                }
                description={
                    confirmAction?.type === 'delete' ? 'Apakah Anda yakin ingin menghapus konfigurasi SLA ini? Tindakan ini tidak dapat dibatalkan.' :
                    confirmAction?.type === 'reset' ? 'Reset semua konfigurasi SLA ke nilai default sistem? Perubahan kustom Anda akan dikembalikan.' :
                    `Hapus tanggal libur ${confirmAction?.id ?? ''}?`
                }
                confirmText={
                    confirmAction?.type === 'reset' ? 'Reset ke Default' : 'Hapus'
                }
                variant="destructive"
                onConfirm={() => {
                    if (confirmAction?.type === 'delete' && confirmAction.id) {
                        deleteSlaMutation.mutate(confirmAction.id);
                    } else if (confirmAction?.type === 'reset') {
                        resetSlaMutation.mutate();
                    } else if (confirmAction?.type === 'holiday' && confirmAction.id) {
                        removeHolidayMutation.mutate(confirmAction.id);
                    }
                    setConfirmAction(null);
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};

export default BentoSlaSettingsPage;
