import React from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PriorityGuideline {
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    label: string;
    sublabel: string;
    color: {
        dot: string;
        badgeBg: string;
        badgeText: string;
        border: string;
    };
    kapanDipakai: string;
    contoh: string[];
    slaDefault: string;
    requiresJustification?: boolean;
}

export const PRIORITY_GUIDELINES: Record<string, PriorityGuideline> = {
    LOW: {
        priority: 'LOW',
        label: 'Low',
        sublabel: 'Rendah / Tidak Mendesak',
        color: {
            dot: 'bg-blue-500',
            badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
            badgeText: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800/60',
        },
        kapanDipakai: 'Gangguan minor atau pertanyaan umum yang tidak menghentikan pekerjaan utama (ada solusi sementara).',
        contoh: [
            'Pertanyaan/konsultasi fitur software',
            'Tampilan aplikasi kurang rapi / font kecil',
            'Permintaan mouse cadangan / aksesoris non-urgen',
        ],
        slaDefault: '24 - 48 Jam',
    },
    MEDIUM: {
        priority: 'MEDIUM',
        label: 'Medium',
        sublabel: 'Sedang / Normal',
        color: {
            dot: 'bg-yellow-500',
            badgeBg: 'bg-yellow-50 dark:bg-yellow-950/60',
            badgeText: 'text-yellow-600 dark:text-yellow-400',
            border: 'border-yellow-200 dark:border-yellow-800/60',
        },
        kapanDipakai: 'Gangguan fungsi kerja satu staf, namun pekerjaan masih bisa berlanjut dengan cara lain.',
        contoh: [
            'Printer lokal macet / tidak merespons',
            'Satu aplikasi lambat atau force-close sesekali',
            'Permintaan reset password / setup akun standar',
        ],
        slaDefault: '8 - 12 Jam',
    },
    HIGH: {
        priority: 'HIGH',
        label: 'High',
        sublabel: 'Tinggi / Mendesak',
        color: {
            dot: 'bg-orange-500',
            badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
            badgeText: 'text-orange-600 dark:text-orange-400',
            border: 'border-orange-200 dark:border-orange-800/60',
        },
        kapanDipakai: 'Gangguan signifikan yang memengaruhi deadline mendesak atau sekelompok staf / satu divisi.',
        contoh: [
            'Email perusahaan tidak bisa kirim/terima',
            'Jaringan internet satu ruangan/departemen putus',
            'Sistem operasional inti (ERP/POS) error parah',
        ],
        slaDefault: '2 - 4 Jam',
    },
    CRITICAL: {
        priority: 'CRITICAL',
        label: 'Critical',
        sublabel: 'Kritis / Darurat Bisnis',
        color: {
            dot: 'bg-red-500',
            badgeBg: 'bg-red-50 dark:bg-red-950/60',
            badgeText: 'text-red-600 dark:text-red-400',
            border: 'border-red-200 dark:border-red-800/60',
        },
        kapanDipakai: 'Sistem inti mati total yang menghentikan operasional bisnis tanpa alternatif (Wajib justifikasi).',
        contoh: [
            'Seluruh jaringan & internet kantor mati total',
            'Server utama / database pusat down',
            'Sistem transaksi keuangan / billing berhenti',
        ],
        slaDefault: '30 - 60 Menit',
        requiresJustification: true,
    },
};

interface PriorityHoverTipProps {
    priority: string;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    slaTimeText?: string;
    delayDuration?: number;
}

export const PriorityHoverTip: React.FC<PriorityHoverTipProps> = ({
    priority,
    children,
    side = 'top',
    align = 'center',
    slaTimeText,
    delayDuration = 100,
}) => {
    const guideline = PRIORITY_GUIDELINES[priority];
    if (!guideline) {
        return <>{children}</>;
    }

    return (
        <TooltipProvider delayDuration={delayDuration}>
            <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent
                    side={side}
                    align={align}
                    sideOffset={8}
                    className="z-50 w-72 md:w-80 p-3.5 bg-slate-900 text-white border border-slate-700/80 rounded-2xl shadow-2xl space-y-2.5 text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                >
                    {/* Header: Badge + SLA */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                            <span className={cn('w-2 h-2 rounded-full', guideline.color.dot, guideline.priority === 'CRITICAL' && 'animate-ping')} />
                            <span className="font-bold text-xs uppercase tracking-wider text-slate-100">
                                {guideline.label} Priority
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">({guideline.sublabel})</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold bg-slate-800/90 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{slaTimeText || guideline.slaDefault}</span>
                        </div>
                    </div>

                    {/* Kapan Digunakan */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 flex items-center gap-1">
                            <Info className="w-3 h-3 text-cyan-400" />
                            Kapan Digunakan:
                        </p>
                        <p className="text-xs text-slate-200 leading-relaxed font-normal">
                            {guideline.kapanDipakai}
                        </p>
                    </div>

                    {/* Contoh Kasus */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Contoh Kasus:
                        </p>
                        <ul className="text-[11px] text-slate-300/90 space-y-1 pl-1">
                            {guideline.contoh.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                                    <span className="text-cyan-400 text-xs mt-0.5">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Justification Warning for Critical */}
                    {guideline.requiresJustification && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-red-500/20 text-[10px] font-bold text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span>Wajib sertakan alasan/justifikasi urgensi saat memilih.</span>
                        </div>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
