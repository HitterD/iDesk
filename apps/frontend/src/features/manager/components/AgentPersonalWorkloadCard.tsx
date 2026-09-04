import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { AgentWorkloadDto } from '@/lib/api/workload.api';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Activity,
    Ticket,
    Award,
    Clock,
    ArrowUpRight,
    CheckCircle2,
    ShieldCheck,
} from 'lucide-react';

interface AgentPersonalWorkloadCardProps {
    workload: AgentWorkloadDto | null;
    siteName?: string;
    loading?: boolean;
}

export const AgentPersonalWorkloadCard: React.FC<AgentPersonalWorkloadCardProps> = ({
    workload,
    siteName,
    loading = false,
}) => {
    const navigate = useNavigate();

    const points = workload?.totalPoints || 0;
    const tickets = workload?.activeTickets || [];

    const getWorkloadStatus = (pts: number) => {
        if (pts === 0) {
            return {
                label: 'Standby',
                description: 'Siap & prioritas utama menerima tiket baru berikutnya',
                color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60',
                dotColor: 'bg-emerald-500',
                progressColor: 'bg-emerald-500',
                percentage: 0,
            };
        }
        if (pts <= 3) {
            return {
                label: 'Optimal',
                description: 'Beban kerja seimbang dan dalam ritme penanganan ideal',
                color: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/60',
                dotColor: 'bg-blue-500',
                progressColor: 'bg-blue-500',
                percentage: Math.min(100, Math.round((pts / 8) * 100)),
            };
        }
        if (pts <= 6) {
            return {
                label: 'Padat',
                description: 'Beban cukup tinggi, fokus selesaikan tiket prioritas',
                color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60',
                dotColor: 'bg-amber-500',
                progressColor: 'bg-amber-500',
                percentage: Math.min(100, Math.round((pts / 8) * 100)),
            };
        }
        return {
            label: 'Kapasitas Penuh',
            description: 'Kapasitas maksimal, tiket baru dialihkan ke rekan lain',
            color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60',
            dotColor: 'bg-rose-500',
            progressColor: 'bg-rose-500',
            percentage: 100,
        };
    };

    const status = getWorkloadStatus(points);

    const getPriorityDot = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'CRITICAL':
                return 'bg-red-500 ring-2 ring-red-200 dark:ring-red-950';
            case 'HIGH':
                return 'bg-orange-500 ring-2 ring-orange-200 dark:ring-orange-950';
            case 'MEDIUM':
                return 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-950';
            default:
                return 'bg-slate-400 ring-2 ring-slate-200 dark:ring-slate-800';
        }
    };

    if (loading) {
        return (
            <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xs animate-pulse">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-32 bg-slate-100 dark:bg-slate-850 rounded" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-850" />
                    <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-850" />
                    <div className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-850" />
                </div>
            </div>
        );
    }

    if (!workload) {
        return null;
    }

    return (
        <div className="relative overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-gradient-to-b from-white/90 via-white to-slate-50/50 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-slate-950/80 p-6 md:p-7 shadow-sm transition-all duration-200">
            {/* Ambient Background Accent */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

            <div className="relative z-10 space-y-6">
                {/* Header Profile & Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[hsl(var(--border))]/70">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <UserAvatar
                                user={{
                                    id: workload.agentId,
                                    fullName: workload.agentName,
                                }}
                                size="lg"
                                className="ring-2 ring-primary/20 shadow-xs"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--card))]">
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                    {workload.agentName}
                                </h2>
                                <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs font-semibold px-2 py-0.5"
                                >
                                    <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                                    Agent Operational Support
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>{workload.email}</span>
                                {(workload.siteName || siteName) && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                        <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            {workload.siteName || siteName} ({workload.siteCode || 'SITE'})
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${status.color}`}>
                            <span className={`w-2 h-2 rounded-full ${status.dotColor}`} />
                            <span>{status.label}</span>
                        </div>
                    </div>
                </div>

                {/* Main Bento Row: Capacity Meter & Stats + Active Tickets */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Capacity Meter & Key Indicators (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50/60 dark:bg-slate-800/30 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <Activity className="w-3.5 h-3.5 text-primary" />
                                    Indikator Beban Kerja
                                </div>
                                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Target Maks: 8 pts
                                </span>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-4xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                                    {points}
                                </span>
                                <span className="text-sm font-semibold text-slate-400">Poin Akumulasi</span>
                            </div>

                            {/* Progress Capacity Bar */}
                            <div className="space-y-1.5">
                                <div className="w-full bg-slate-200/70 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${status.progressColor}`}
                                        style={{ width: `${Math.max(points === 0 ? 4 : 8, status.percentage)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {status.description}
                                </p>
                            </div>
                        </div>

                        {/* Secondary Stats Strip */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50/40 dark:bg-slate-800/20 p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                                    <Award className="w-3.5 h-3.5 text-amber-500" />
                                    Poin Appraisal
                                </div>
                                <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                                    {workload.appraisalPoints || 0}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50/40 dark:bg-slate-800/20 p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                    Penugasan Terakhir
                                </div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                                    {workload.lastAssignedAt ? (
                                        formatDistanceToNow(new Date(workload.lastAssignedAt), {
                                            addSuffix: true,
                                            locale: idLocale,
                                        })
                                    ) : (
                                        <span className="text-slate-400 font-normal">Belum ada</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: My Active Tickets Queue (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col rounded-2xl border border-[hsl(var(--border))] bg-slate-50/60 dark:bg-slate-800/30 p-5">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[hsl(var(--border))]/60">
                            <div className="flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Tiket Sedang Ditangani ({tickets.length})
                                </h3>
                            </div>
                            {tickets.length > 0 && (
                                <button
                                    onClick={() => navigate('/tickets')}
                                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                                >
                                    Buka Tiket Saya
                                    <ArrowUpRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {tickets.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                                    Antrean Kosong / Bebas Tugas
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                                    Saat ini Anda tidak memiliki tiket yang sedang diproses. Sistem siap menugaskan tiket baru ke Anda secara otomatis.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                                {tickets.map((t) => (
                                    <div
                                        key={t.id}
                                        onClick={() => navigate(`/tickets/${t.id}`)}
                                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-primary/50 hover:shadow-xs transition-all duration-150 cursor-pointer"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${getPriorityDot(t.priority)}`} />
                                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                                    {t.ticketNumber}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] uppercase font-semibold px-1.5 py-0 h-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                                >
                                                    {t.priority}
                                                </Badge>
                                                {t.category && (
                                                    <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                                                        • {t.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-1 group-hover:text-primary transition-colors">
                                                {t.title}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                                            >
                                                {t.status}
                                            </Badge>
                                            <span className="text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all">
                                                <ArrowUpRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentPersonalWorkloadCard;
