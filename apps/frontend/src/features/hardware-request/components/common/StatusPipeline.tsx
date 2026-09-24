import { Check, X } from 'lucide-react';
import { REQUEST_PIPELINE, type RequestStatus } from '../../types';
import { STATUS_META, isTerminal } from '../../utils/status.util';
import { cn } from '@/lib/utils';

export const INSTALLATION_ONLY_PIPELINE: { status: RequestStatus; label: string }[] = [
    { status: 'SUBMITTED', label: 'Diajukan' },
    { status: 'INSTALLATION', label: 'Penjadwalan & Pemasangan' },
    { status: 'AWAITING_USER_CONFIRMATION', label: 'Konfirmasi' },
    { status: 'COMPLETED', label: 'Selesai' },
];

export const STANDARD_PIPELINE: { status: RequestStatus; label: string }[] = [
    { status: 'SUBMITTED', label: 'Diajukan' },
    { status: 'UNDER_REVIEW', label: 'Review' },
    { status: 'APPROVED', label: 'Disetujui' },
    { status: 'PROCUREMENT', label: 'SPP' },
    { status: 'AWAITING_DELIVERY', label: 'Pengiriman' },
    { status: 'INSTALLATION', label: 'Pemasangan' },
    { status: 'AWAITING_USER_CONFIRMATION', label: 'Konfirmasi' },
    { status: 'COMPLETED', label: 'Selesai' },
];

export function StatusPipeline({ current, isInstallationOnly }: { current: RequestStatus; isInstallationOnly?: boolean }) {
    const pipeline = isInstallationOnly ? INSTALLATION_ONLY_PIPELINE : STANDARD_PIPELINE;
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const isCompleted = current === 'COMPLETED';
    const currentIdx = pipeline.findIndex((p) => p.status === current);
    const activeIdx = currentIdx >= 0 ? currentIdx : (isInstallationOnly ? 1 : 0);

    return (
        <div role="group" aria-label="Status progress" className="w-full py-2">
            {/* Apple Minimalist Connected Stepper */}
            <div className="relative flex items-center justify-between">
                {/* Connecting background line */}
                <div className="absolute left-6 right-6 top-3.5 h-[2px] bg-slate-200/80 dark:bg-slate-800 -z-0" />

                {/* Connecting active progress line */}
                {!terminalBad && activeIdx > 0 && (
                    <div
                        className="absolute left-6 top-3.5 h-[2px] bg-primary transition-all duration-500 -z-0"
                        style={{
                            width: `${(activeIdx / (pipeline.length - 1)) * (100 - (100 / pipeline.length))}%`,
                        }}
                    />
                )}

                {pipeline.map((step, i) => {
                    const isDone = !terminalBad && (isCompleted ? i <= activeIdx : i < activeIdx);
                    const isActive = !terminalBad && i === activeIdx && !isCompleted;
                    const isStepCompleted = isDone || (isCompleted && i === activeIdx);

                    return (
                        <div key={step.status} className="flex flex-col items-center gap-1.5 z-10 px-1">
                            <div
                                className={cn(
                                    'size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                                    isStepCompleted
                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                        : isActive
                                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/15 shadow-xs'
                                        : 'bg-card border border-border text-muted-foreground'
                                )}
                            >
                                {isStepCompleted ? (
                                    <Check className="size-3.5 stroke-[3]" />
                                ) : (
                                    <span className="text-[11px] font-semibold">{i + 1}</span>
                                )}
                            </div>
                            <span
                                className={cn(
                                    'text-[11px] text-center tracking-tight transition-colors whitespace-nowrap',
                                    isActive || isStepCompleted
                                        ? 'font-bold text-foreground'
                                        : 'text-muted-foreground/70 font-medium'
                                )}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Terminal status banner */}
            {terminalBad && (
                <div className="mt-4 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold">
                    <X className="size-3.5 shrink-0" />
                    <span>Permintaan ini telah {current === 'REJECTED' ? 'ditolak' : 'dibatalkan'}</span>
                </div>
            )}
        </div>
    );
}
