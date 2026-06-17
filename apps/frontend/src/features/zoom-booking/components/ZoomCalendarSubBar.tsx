import { Zap, FileText, Settings, Keyboard, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZoomViewSwitcher } from './ZoomViewSwitcher';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { CalendarView } from '../hooks/useCalendarView';

export interface ZoomCalendarSubBarProps {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    onBook1Hour: () => void;
    onBookCustom: () => void;
    onOpenShortcuts: () => void;
    onOpenSettings: () => void;
    isLive: boolean;
    lastSyncAt: Date | null;
    className?: string;
}

export function ZoomCalendarSubBar({
    view,
    onViewChange,
    onBook1Hour,
    onBookCustom,
    onOpenShortcuts,
    onOpenSettings,
    isLive,
    lastSyncAt,
    className,
}: ZoomCalendarSubBarProps) {
    return (
        <div
            data-testid="zoom-subbar"
            className={`h-9 flex items-center px-4 gap-3 ${className ?? ''}`}
        >
            <ZoomViewSwitcher view={view} onViewChange={onViewChange} />

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Quick:
            </span>

            <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onBook1Hour}
                aria-label="1 hour"
            >
                <Zap className="h-3 w-3" aria-hidden="true" /> 1 hour
            </Button>

            <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1.5"
                onClick={onBookCustom}
            >
                <FileText className="h-3 w-3" aria-hidden="true" /> Custom…
            </Button>

            <div className="ml-auto flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Legend:
                </span>
                <LegendChip color="linear-gradient(135deg, #3b82f6, #2563eb)" label="Saya" />
                <LegendChip color="linear-gradient(135deg, #fbbf24, #f59e0b)" label="Tim" />
                <LegendChip color="#cbd5e1" label="External" />
                <LegendChip color="linear-gradient(135deg, #ef4444, #dc2626)" label="Blokir" />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                <div className="flex items-center gap-1 text-[11px]">
                    <CircleDot
                        className={`h-3 w-3 ${isLive ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'}`}
                        aria-hidden="true"
                    />
                    <span
                        className="text-slate-600 dark:text-slate-400"
                        title={lastSyncAt?.toLocaleString()}
                    >
                        {isLive && lastSyncAt
                            ? `Live · ${formatDistanceToNow(lastSyncAt, { locale: idLocale, addSuffix: true })}`
                            : 'Offline'}
                    </span>
                </div>

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={onOpenShortcuts}
                    aria-label="Keyboard shortcuts"
                >
                    <Keyboard className="h-3.5 w-3.5 text-slate-500" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={onOpenSettings}
                    aria-label="Settings"
                >
                    <Settings className="h-3.5 w-3.5 text-slate-500" />
                </Button>
            </div>
        </div>
    );
}

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
            <span
                className="w-2.5 h-2.5 rounded-sm border-l-2"
                style={{ background: color, borderLeftColor: 'rgba(255,255,255,0.4)' }}
                aria-hidden="true"
            />
            {label}
        </span>
    );
}
