import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowRight,
    X,
    Loader2,
    AlertCircle,
    Info,
    ArrowLeftRight,
    ArrowUpRight,
    Smartphone,
    Database,
    Headphones,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ForwardTargetTeam = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'MOBILE_DEV' | 'WEB_DEV';

export interface ForwardTicketInfo {
    id: string;
    ticketNumber?: string;
    title?: string;
    handlingTeam?: ForwardTargetTeam | string;
}

interface TicketForwardDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: ForwardTicketInfo | null;
    onConfirm: (targetTeam: ForwardTargetTeam, reason: string) => Promise<void> | void;
    isLoading?: boolean;
}

interface TeamOption {
    value: ForwardTargetTeam;
    label: string;
    shortLabel: string;
    desc: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    dotColor: string;
    badgeBg: string;
    activeBorder: string;
}

const TEAM_OPTIONS: TeamOption[] = [
    {
        value: 'OPS_SUPPORT',
        label: 'IT Support / Ops Support',
        shortLabel: 'IT Support',
        desc: 'Masalah infrastruktur, jaringan, hardware, atau operasional — agent support.',
        icon: Headphones,
        dotColor: 'bg-emerald-500',
        badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        activeBorder: 'border-emerald-500',
    },
    {
        value: 'ORACLE_DEV',
        label: 'Oracle / K2 Developer',
        shortLabel: 'Oracle / K2',
        desc: 'Masalah aplikasi Oracle / K2 ERP & database backend — developer.',
        icon: Database,
        dotColor: 'bg-violet-500',
        badgeBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
        activeBorder: 'border-violet-500',
    },
    {
        value: 'WEB_DEV',
        label: 'Web Developer Team',
        shortLabel: 'Web Dev',
        desc: 'Masalah aplikasi Web, Portal, Frontend & integrasi web — developer.',
        icon: ArrowUpRight,
        dotColor: 'bg-blue-500',
        badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        activeBorder: 'border-blue-500',
    },
    {
        value: 'MOBILE_DEV',
        label: 'Mobile Developer Team',
        shortLabel: 'Mobile Dev',
        desc: 'Masalah aplikasi Mobile (iOS / Android) — developer.',
        icon: Smartphone,
        dotColor: 'bg-sky-500',
        badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        activeBorder: 'border-sky-500',
    },
];

const REASON_PRESETS = [
    { id: 'web_issue', label: 'Terkait aplikasi Web / Portal / Frontend', forTeam: 'WEB_DEV' },
    { id: 'mobile_issue', label: 'Terkait aplikasi Mobile (iOS / Android)', forTeam: 'MOBILE_DEV' },
    { id: 'oracle_issue', label: 'Terkait aplikasi Oracle / K2', forTeam: 'ORACLE_DEV' },
    { id: 'infra_issue', label: 'Masalah infrastruktur / perangkat / IT Support', forTeam: 'OPS_SUPPORT' },
    { id: 'needs_dev', label: 'Butuh kode / akses developer' },
    { id: 'misrouted', label: 'Salah routing awal' },
    { id: 'other', label: 'Lainnya' },
];

const getTeamName = (team?: string | null): string => {
    const found = TEAM_OPTIONS.find((t) => t.value === team);
    return found ? found.label : team === 'WEB_DEV' ? 'Web Developer Team' : 'IT Support / Ops Support';
};

export const TicketForwardDialog: React.FC<TicketForwardDialogProps> = ({
    isOpen,
    onClose,
    ticket,
    onConfirm,
    isLoading = false,
}) => {
    const [selectedTeam, setSelectedTeam] = useState<ForwardTargetTeam>('ORACLE_DEV');
    const [selectedPreset, setSelectedPreset] = useState<string>('oracle_issue');
    const [customReason, setCustomReason] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        if (isOpen && ticket) {
            const current = ticket.handlingTeam;
            let defaultTeam: ForwardTargetTeam = 'ORACLE_DEV';

            if (current === 'ORACLE_DEV') {
                defaultTeam = 'WEB_DEV';
            } else if (current === 'WEB_DEV') {
                defaultTeam = 'MOBILE_DEV';
            } else if (current === 'MOBILE_DEV') {
                defaultTeam = 'ORACLE_DEV';
            } else {
                defaultTeam = 'ORACLE_DEV';
            }

            setSelectedTeam(defaultTeam);
            setSelectedPreset(
                defaultTeam === 'WEB_DEV'
                    ? 'web_issue'
                    : defaultTeam === 'MOBILE_DEV'
                    ? 'mobile_issue'
                    : defaultTeam === 'ORACLE_DEV'
                    ? 'oracle_issue'
                    : 'infra_issue'
            );
            setCustomReason('');
            setError(null);
            setEntered(false);

            const t = window.setTimeout(() => setEntered(true), 20);
            return () => window.clearTimeout(t);
        }
    }, [isOpen, ticket]);

    if (!isOpen || !ticket) return null;

    const currentTeam = ticket.handlingTeam || 'OPS_SUPPORT';

    const handleSelectTeam = (team: ForwardTargetTeam) => {
        setSelectedTeam(team);
        setError(null);
        if (team === 'WEB_DEV') {
            setSelectedPreset('web_issue');
        } else if (team === 'MOBILE_DEV') {
            setSelectedPreset('mobile_issue');
        } else if (team === 'ORACLE_DEV') {
            setSelectedPreset('oracle_issue');
        } else if (team === 'OPS_SUPPORT') {
            setSelectedPreset('infra_issue');
        }
    };

    const handleConfirm = async () => {
        const presetObj = REASON_PRESETS.find((p) => p.id === selectedPreset);
        const presetLabel = presetObj ? presetObj.label : selectedPreset;

        if (selectedPreset === 'other' && !customReason.trim()) {
            setError('Mohon tuliskan alasan pengalihan pada kolom catatan.');
            return;
        }

        let finalReason = '';
        if (selectedPreset === 'other') {
            finalReason = customReason.trim();
        } else if (customReason.trim()) {
            finalReason = `${presetLabel}: ${customReason.trim()}`;
        } else {
            finalReason = presetLabel;
        }

        try {
            setError(null);
            await onConfirm(selectedTeam, finalReason);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Gagal meneruskan tiket');
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-300"
            onClick={() => {
                if (!isLoading) onClose();
            }}
        >
            <div
                className="relative w-full max-w-2xl overflow-hidden bg-card text-card-foreground border border-border/80 shadow-2xl rounded-[2rem] animate-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Outer shell (Double-Bezel) */}
                <div className="p-1.5 bg-black/[0.03] dark:bg-white/[0.03] ring-1 ring-black/5 dark:ring-white/10 rounded-[calc(2rem-0.375rem)]">
                    <div className="bg-card rounded-[calc(2rem-0.75rem)] border border-border/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] overflow-hidden">
                        {/* Header */}
                        <div
                            className={cn(
                                'flex items-start justify-between p-5 border-b border-border bg-muted/30 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
                                    <ArrowLeftRight className="w-4.5 h-4.5" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        Teruskan Tiket ke Tim Lain
                                    </h3>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)} — {ticket.title || 'Support Request'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all duration-300 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                <X className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                        </div>

                        {/* Content */}
                        <div
                            className={cn(
                                'p-5 space-y-4 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                            )}
                            style={{ transitionDelay: entered ? '80ms' : '0ms' }}
                        >
                            {/* Team switch comparison */}
                            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/70 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                                        <ArrowLeftRight className="w-4 h-4" strokeWidth={1.5} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                            Tim Saat Ini
                                        </div>
                                        <div className="text-xs font-semibold text-foreground truncate">
                                            {getTeamName(currentTeam)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border shadow-2xs shrink-0 text-muted-foreground">
                                    <ArrowRight className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                                </div>

                                <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end text-right">
                                    <div className="min-w-0">
                                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                            Tim Tujuan
                                        </div>
                                        <div className="text-xs font-semibold text-primary truncate">
                                            {getTeamName(selectedTeam)}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                                        <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                                    </div>
                                </div>
                            </div>

                            {/* Team choose cards */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Pilih Tim Tujuan</span>
                                    <span className="text-[11px] font-normal text-muted-foreground">
                                        Pilih salah satu dari 4 tim penanganan
                                    </span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {TEAM_OPTIONS.map((opt) => {
                                        const isSelected = selectedTeam === opt.value;
                                        const isCurrent = currentTeam === opt.value;
                                        const Icon = opt.icon;

                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleSelectTeam(opt.value)}
                                                className={cn(
                                                    'relative p-3 rounded-2xl text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer border flex flex-col justify-between',
                                                    'hover:-translate-y-0.5 active:scale-[0.98]',
                                                    isSelected
                                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                                                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                                                )}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div
                                                            className={cn(
                                                                'w-7 h-7 rounded-lg flex items-center justify-center border transition-colors',
                                                                isSelected
                                                                    ? 'bg-white/15 text-white border-white/20'
                                                                    : 'bg-muted text-foreground border-border'
                                                            )}
                                                        >
                                                            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                                                        </div>
                                                        <span
                                                            className={cn(
                                                                'w-2 h-2 rounded-full shrink-0',
                                                                isSelected ? 'bg-white ring-2 ring-white/30' : opt.dotColor
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="text-xs font-bold leading-tight">
                                                        {opt.label}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'text-[11px] mt-1 leading-relaxed line-clamp-2',
                                                            isSelected
                                                                ? 'text-primary-foreground/80'
                                                                : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        {opt.desc}
                                                    </div>
                                                </div>
                                                {isCurrent && (
                                                    <div className="mt-2 text-[10px] uppercase font-bold tracking-wider opacity-70">
                                                        (Tim Saat Ini)
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Reason presets */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Alasan Penerusan</span>
                                    <span className="text-[11px] font-normal text-muted-foreground">
                                        Tercatat pada timeline tiket
                                    </span>
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {REASON_PRESETS.map((preset) => {
                                        const isSelected = selectedPreset === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPreset(preset.id);
                                                    setError(null);
                                                }}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer border',
                                                    isSelected
                                                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                                                )}
                                            >
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Note */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>
                                        Keterangan Tambahan{' '}
                                        {selectedPreset === 'other' ? (
                                            <span className="text-destructive font-normal">*Wajib</span>
                                        ) : (
                                            <span className="text-muted-foreground font-normal">(Opsional)</span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {customReason.length}/500
                                    </span>
                                </label>
                                <textarea
                                    value={customReason}
                                    onChange={(e) => {
                                        setCustomReason(e.target.value.slice(0, 500));
                                        if (error) setError(null);
                                    }}
                                    placeholder={
                                        selectedPreset === 'other'
                                            ? 'Jelaskan alasan mengapa tiket ini diteruskan...'
                                            : 'Tambahkan catatan spesifik jika diperlukan (misal: butuh akses developer/mobile)...'
                                    }
                                    rows={3}
                                    className={cn(
                                        'w-full px-3 py-2 text-xs bg-background border rounded-xl outline-none transition-all resize-none',
                                        'focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground',
                                        error
                                            ? 'border-destructive focus:ring-destructive'
                                            : 'border-border'
                                    )}
                                />
                                {error && (
                                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                                        <span>{error}</span>
                                    </p>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] flex items-start gap-2">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                                <div className="space-y-0.5">
                                    <p className="font-semibold">Auditable Handover</p>
                                    <p className="opacity-90 leading-relaxed">
                                        Penerusan tiket dan alasan ini akan ditulis ke timeline riwayat tiket dan dapat dilihat kedua tim.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div
                            className={cn(
                                'flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-muted/30 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                            )}
                            style={{ transitionDelay: entered ? '140ms' : '0ms' }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-full transition-colors disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isLoading || (selectedPreset === 'other' && !customReason.trim())}
                                className="group inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-full shadow-xs transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>Teruskan Tiket</span>
                                <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
