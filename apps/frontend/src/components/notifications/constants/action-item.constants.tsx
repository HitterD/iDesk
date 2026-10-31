import React from 'react';
import {
    Ticket, HardDrive, FileText, RotateCcw, Video,
    Zap, AlertTriangle, Clock,
} from 'lucide-react';
import { ActionItemEntityType, ActionItemUrgency, SnoozeDuration } from '../types/action-item.types';

export type Intensity = 'OFF' | 'GENTLE' | 'MODERATE' | 'ASSERTIVE';

export interface EntityConfig {
    icon: React.ReactNode;
    label: string;
    actionLabel: string;
}

export const ENTITY_CONFIG: Record<ActionItemEntityType, EntityConfig> = {
    TICKET_NOTE: {
        icon: <FileText className="w-4 h-4" />,
        label: 'Catatan Internal',
        actionLabel: 'Buka Diskusi',
    },
    TICKET: {
        icon: <Ticket className="w-4 h-4" />,
        label: 'Tiket',
        actionLabel: 'Buka Tiket',
    },
    HARDWARE_REQUEST: {
        icon: <HardDrive className="w-4 h-4" />,
        label: 'Hardware',
        actionLabel: 'Tinjau Request',
    },
    EFORM: {
        icon: <FileText className="w-4 h-4" />,
        label: 'E-Form',
        actionLabel: 'Tinjau E-Form',
    },
    RENEWAL: {
        icon: <RotateCcw className="w-4 h-4" />,
        label: 'Renewal',
        actionLabel: 'Cek Kontrak',
    },
    ZOOM: {
        icon: <Video className="w-4 h-4" />,
        label: 'Zoom',
        actionLabel: 'Buka Zoom',
    },
};

export interface UrgencyConfig {
    dot: string;
    label: string;
    textColor: string;
    badgeBg: string;
    icon: React.ReactNode;
}

export const URGENCY_CONFIG: Record<ActionItemUrgency, UrgencyConfig> = {
    CRITICAL: {
        dot: 'bg-red-500',
        label: 'Kritis',
        textColor: 'text-red-600 dark:text-red-400',
        badgeBg: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30',
        icon: <Zap className="w-3 h-3 text-red-500" />,
    },
    HIGH: {
        dot: 'bg-amber-500',
        label: 'Penting',
        textColor: 'text-amber-600 dark:text-amber-400',
        badgeBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30',
        icon: <AlertTriangle className="w-3 h-3 text-amber-500" />,
    },
    NORMAL: {
        dot: 'bg-slate-400 dark:bg-slate-500',
        label: 'Normal',
        textColor: 'text-slate-500 dark:text-slate-400',
        badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        icon: <Clock className="w-3 h-3 text-slate-400" />,
    },
};

export const INTENSITIES: { value: Intensity; label: string; interval: string }[] = [
    { value: 'OFF', label: 'Off', interval: '—' },
    { value: 'GENTLE', label: 'Santai', interval: '1 jam' },
    { value: 'MODERATE', label: 'Sedang', interval: '30 mnt' },
    { value: 'ASSERTIVE', label: 'Ketat', interval: '15 mnt' },
];

export const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration }[] = [
    { label: '30 menit', value: '30m' },
    { label: '2 jam', value: '2h' },
    { label: 'Besok pagi', value: 'tomorrow' },
];
