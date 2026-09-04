import React from 'react';
import {
    Clock,
    PlayCircle,
    PauseCircle,
    CheckCircle2,
    ShieldCheck,
    XCircle,
    Store,
    ArrowRight,
    UserCheck,
    AlertCircle,
    UserPlus,
    UserMinus,
    Share2,
    Calendar,
    Hourglass,
    Info,
    User as UserIcon,
    Pause,
    Sparkles,
    Paperclip,
    ZoomIn,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatDateTimeID } from '@/lib/utils/dateFormat';

interface SystemMessageEventProps {
    content: string;
    createdAt: string;
    attachments?: string[];
    onImageClick?: (url: string) => void;
    className?: string;
}

// Config for status badges with Indonesian labels & tailored colors
const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
    TODO: {
        label: 'Baru (TODO)',
        bg: 'bg-blue-50 dark:bg-blue-950/50',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800/70',
        dot: 'bg-blue-500',
        icon: Clock,
    },
    IN_PROGRESS: {
        label: 'Sedang Dikerjakan',
        bg: 'bg-indigo-50 dark:bg-indigo-950/50',
        text: 'text-indigo-700 dark:text-indigo-300',
        border: 'border-indigo-200 dark:border-indigo-800/70',
        dot: 'bg-indigo-500',
        icon: PlayCircle,
    },
    PENDING: {
        label: 'Tertunda',
        bg: 'bg-amber-50 dark:bg-amber-950/50',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800/70',
        dot: 'bg-amber-500',
        icon: PauseCircle,
    },
    WAITING_VENDOR: {
        label: 'Menunggu Vendor',
        bg: 'bg-orange-50 dark:bg-orange-950/50',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-200 dark:border-orange-800/70',
        dot: 'bg-orange-500',
        icon: Store,
    },
    RESOLVED: {
        label: 'Selesai',
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800/70',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
    },
    CLOSED: {
        label: 'Ditutup',
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
        icon: ShieldCheck,
    },
    CANCELLED: {
        label: 'Dibatalkan',
        bg: 'bg-rose-50 dark:bg-rose-950/50',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-800/70',
        dot: 'bg-rose-500',
        icon: XCircle,
    },
};

const PRIORITY_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
    LOW: { label: 'Low', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    MEDIUM: { label: 'Medium', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    HIGH: { label: 'High', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    CRITICAL: { label: 'Critical', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
};

export const SystemMessageEvent: React.FC<SystemMessageEventProps> = ({
    content,
    createdAt,
    attachments = [],
    onImageClick,
    className,
}) => {
    // 0. Detect Resolution Statement Notice
    const isResolvedStatement =
        content.includes('Tiket Dinyatakan Selesai') ||
        content.includes('Tiket Diselesaikan (Resolved)') ||
        (content.includes('Selesai (Resolved)') && (content.includes('Tindakan') || content.includes('Solusi')));

    if (isResolvedStatement) {
        const solutionTextMatch = content.match(/(?:Tindakan & Solusi|Solusi \/ Tindakan|Tindakan yang Dilakukan):\s*([\s\S]+)$/i);
        const solutionText = solutionTextMatch ? solutionTextMatch[1].trim() : content.replace(/^[^\n]+\n+/, '').trim();
        const actorMatch = content.match(/Diselesaikan oleh:\s*([^\n\r]+)/i) || content.match(/oleh:\s*([^\n\r]+)/i);

        return (
            <div className={cn("w-full flex justify-center my-3.5 px-2", className)}>
                <div className="w-full max-w-lg bg-gradient-to-b from-emerald-50/80 via-white to-emerald-50/30 dark:from-slate-900/95 dark:via-slate-900 dark:to-emerald-950/20 rounded-2xl border border-emerald-300/90 dark:border-emerald-800/70 shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden">
                    {/* Header Banner */}
                    <div className="bg-emerald-500/10 dark:bg-emerald-950/50 px-4 py-3 border-b border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                                <CheckCircle2 className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide flex items-center gap-1.5">
                                    Tiket Dinyatakan Selesai (Resolved)
                                </h4>
                                <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400">
                                    Pekerjaan &amp; solusi perbaikan telah diselesaikan
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded-full border border-emerald-200/80 dark:border-emerald-800/60">
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>

                    {/* Content Details */}
                    <div className="p-3.5 sm:p-4 space-y-3 text-xs text-slate-700 dark:text-slate-200">
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 shadow-2xs">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Tindakan &amp; Penjelasan Solusi:</span>
                            </div>
                            <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100 font-medium">
                                {solutionText || 'Tiket telah diselesaikan sesuai instruksi.'}
                            </p>
                        </div>

                        {/* Attachments / Bukti Foto */}
                        {attachments && attachments.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Bukti Foto / Lampiran Penyelesaian ({attachments.length}):</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {attachments.map((url, idx) => {
                                        const isPdf = typeof url === 'string' && url.toLowerCase().includes('.pdf');
                                        return (
                                            <div
                                                key={idx}
                                                className="group relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-2xs hover:shadow-md transition-all h-24"
                                                onClick={() => onImageClick && onImageClick(url)}
                                            >
                                                {isPdf ? (
                                                    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30">
                                                        <FileText className="w-6 h-6 mb-1" />
                                                        <span className="text-[10px] font-bold truncate max-w-full">Lihat PDF</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <img
                                                            src={url}
                                                            alt={`Bukti Penyelesaian #${idx + 1}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                                                            <ZoomIn className="w-3.5 h-3.5" />
                                                            <span>Perbesar</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        {actorMatch ? (
                            <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3 h-3 text-emerald-600" />
                                <span>Diselesaikan oleh <strong className="text-slate-800 dark:text-slate-200">{actorMatch[1].trim()}</strong></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Status Tiket: <strong>RESOLVED</strong></span>
                            </div>
                        )}
                        <span>{formatDateTimeID(createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 1. Detect Waiting Vendor Rich Structured Notice
    const isWaitingVendorNotice =
        content.includes('Waiting Vendor') ||
        content.includes('kunjungan vendor') ||
        content.includes('Jadwal vendor datang');

    if (isWaitingVendorNotice && (content.includes('Jadwal vendor') || content.includes('\n') || content.includes('Perkiraan kunjungan'))) {
        // Extract fields safely
        const descriptionMatch = content.match(/📋\s*([^\n\r]+)/i);
        const scheduleMatch = content.match(/Jadwal vendor datang:\s*([^\n\r]+)/i);
        const visitMatch = content.match(/Perkiraan kunjungan terdekat:\s*([^\n\r]+)/i);
        const waitMatch = content.match(/Estimasi waktu tunggu[^:]*:\s*([^\n\r]+)/i);
        const actorMatch = content.match(/Diubah oleh:\s*([^\n\r]+)/i);
        const isSlaPaused = content.includes('SLA Timer di-pause') || content.includes('pause');

        return (
            <div className={cn("w-full flex justify-center my-3.5 px-2", className)}>
                <div className="w-full max-w-lg bg-gradient-to-b from-orange-50/70 via-white to-orange-50/30 dark:from-slate-900/90 dark:via-slate-900 dark:to-orange-950/20 rounded-2xl border border-orange-200/90 dark:border-orange-800/60 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden">
                    {/* Header Banner */}
                    <div className="bg-orange-500/10 dark:bg-orange-950/40 px-4 py-2.5 border-b border-orange-200/80 dark:border-orange-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-xs">
                                <Store className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-orange-900 dark:text-orange-200 uppercase tracking-wide">
                                    Status: Menunggu Kunjungan Vendor
                                </h4>
                                <p className="text-[11px] text-orange-700/80 dark:text-orange-400">
                                    Tiket diteruskan ke jadwal penanganan vendor luar
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] text-orange-700 dark:text-orange-400 font-medium px-2 py-0.5 bg-orange-100/80 dark:bg-orange-900/50 rounded-full">
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>

                    {/* Content Details */}
                    <div className="p-3.5 sm:p-4 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                        {descriptionMatch && (
                            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400 pb-1">
                                <Info className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                                <span className="font-medium text-slate-800 dark:text-slate-200">{descriptionMatch[1].trim()}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {scheduleMatch && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                                    <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Jadwal Vendor</div>
                                        <div className="font-semibold text-slate-800 dark:text-slate-100">{scheduleMatch[1].trim()}</div>
                                    </div>
                                </div>
                            )}

                            {visitMatch && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                                    <Hourglass className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Perkiraan Kunjungan</div>
                                        <div className="font-bold text-orange-600 dark:text-orange-400">{visitMatch[1].trim()}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {waitMatch && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                <span>Estimasi waktu tunggu: <strong className="text-slate-700 dark:text-slate-300">{waitMatch[1].trim()}</strong></span>
                            </div>
                        )}

                        {isSlaPaused && (
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/60 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 font-medium text-[11px]">
                                <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Perhitungan waktu SLA di-pause sementara menunggu kehadiran vendor.</span>
                            </div>
                        )}
                    </div>

                    {/* Card Footer */}
                    <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        {actorMatch ? (
                            <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3 h-3 text-slate-400" />
                                <span>Diubah oleh <strong className="text-slate-700 dark:text-slate-200">{actorMatch[1].trim()}</strong></span>
                            </div>
                        ) : (
                            <span>Notifikasi Sistem</span>
                        )}
                        <span>{formatDateTimeID(createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Parse Status Change (e.g. "System: Status changed from TODO to WAITING_VENDOR by ANDREW ALFONSO SETIAWAN")
    const cleanContent = content.replace(/^System:\s*/i, '').trim();
    const statusMatch = cleanContent.match(/Status(?: changed)? from ([A-Z_]+) to ([A-Z_]+)(?:\s+by\s+([^,.]+))?/i) ||
        cleanContent.match(/Status:\s*([A-Z_]+)\s*→\s*([A-Z_]+)(?:\s+by\s+([^,.]+))?/i);

    if (statusMatch) {
        const fromKey = statusMatch[1].toUpperCase();
        const toKey = statusMatch[2].toUpperCase();
        const actor = statusMatch[3]?.trim();

        const fromConfig = STATUS_MAP[fromKey] || { label: fromKey, bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700', dot: 'bg-slate-400', icon: Clock };
        const toConfig = STATUS_MAP[toKey] || { label: toKey, bg: 'bg-blue-100 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-800', dot: 'bg-blue-500', icon: CheckCircle2 };
        const ToIcon = toConfig.icon;

        return (
            <div className={cn("flex flex-col items-center my-2.5 px-2", className)}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-xs transition-all">
                    <ToIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</span>

                    {/* From Badge */}
                    <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                        fromConfig.bg, fromConfig.text, fromConfig.border
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", fromConfig.dot)} />
                        {fromConfig.label}
                    </span>

                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />

                    {/* To Badge */}
                    <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs",
                        toConfig.bg, toConfig.text, toConfig.border
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", toConfig.dot)} />
                        {toConfig.label}
                    </span>
                </div>

                {/* Subtitle / Actor Info */}
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="text-slate-600 dark:text-slate-300 font-semibold">{actor}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatRelativeTime(createdAt)}</span>
                </div>
            </div>
        );
    }

    // 3. Parse Assignment Change (e.g. "System: Ticket assigned to BAGAS by ANDREW ALFONSO SETIAWAN")
    const assignMatch = cleanContent.match(/Ticket assigned to (.+?)(?:\s*\(was\s*(.+?)\))?(?:\s+by\s+([^,.]+))?$/i) ||
        cleanContent.match(/Assigned to:\s*([^,.]+)(?:\s+by\s+([^,.]+))?/i);

    if (assignMatch) {
        const to = assignMatch[1].trim();
        const from = assignMatch[2]?.trim();
        const actor = assignMatch[3]?.trim();

        return (
            <div className={cn("flex flex-col items-center my-2.5 px-2", className)}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 text-xs shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Penugasan Teknisi:</span>
                    {from && from.toLowerCase() !== 'none' && from.toLowerCase() !== 'unassigned' && (
                        <>
                            <span className="line-through text-purple-400 dark:text-purple-500 text-[11px]">{from}</span>
                            <ArrowRight className="w-3 h-3 text-purple-400 shrink-0" />
                        </>
                    )}
                    <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-700/60 shadow-2xs">
                        {to}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="text-slate-600 dark:text-slate-300 font-semibold">{actor}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatRelativeTime(createdAt)}</span>
                </div>
            </div>
        );
    }

    // 4. Parse Priority Change
    const priorityMatch = cleanContent.match(/Priority(?: changed)? from ([A-Z_]+) to ([A-Z_]+)(?:\s+by\s+([^,.]+))?/i);
    if (priorityMatch) {
        const fromP = priorityMatch[1].toUpperCase();
        const toP = priorityMatch[2].toUpperCase();
        const actor = priorityMatch[3]?.trim();

        const fromCfg = PRIORITY_MAP[fromP] || { label: fromP, bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' };
        const toCfg = PRIORITY_MAP[toP] || { label: toP, bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800' };

        return (
            <div className={cn("flex flex-col items-center my-2.5 px-2", className)}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium text-slate-500 dark:text-slate-400">Prioritas:</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-semibold border", fromCfg.bg, fromCfg.text, fromCfg.border)}>
                        {fromCfg.label}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-bold border shadow-2xs", toCfg.bg, toCfg.text, toCfg.border)}>
                        {toCfg.label}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="text-slate-600 dark:text-slate-300 font-semibold">{actor}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatRelativeTime(createdAt)}</span>
                </div>
            </div>
        );
    }

    // 5. Parse Ticket Forwarded
    const forwardMatch = cleanContent.match(/Ticket forwarded to (.+?)(?:\s+by\s+([^,.]+))?$/i);
    if (forwardMatch) {
        const target = forwardMatch[1].trim();
        const actor = forwardMatch[2]?.trim();

        return (
            <div className={cn("flex flex-col items-center my-2.5 px-2", className)}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs shadow-2xs">
                    <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Tiket Diteruskan ke:</span>
                    <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-700/60 shadow-2xs">
                        {target}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="text-slate-600 dark:text-slate-300 font-semibold">{actor}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatRelativeTime(createdAt)}</span>
                </div>
            </div>
        );
    }

    // 6. Generic Multiline System Message
    if (content.includes('\n')) {
        return (
            <div className={cn("w-full flex justify-center my-3 px-2", className)}>
                <div className="w-full max-w-md bg-slate-50 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-3.5 shadow-2xs text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-blue-500" />
                            Notifikasi Sistem
                        </span>
                        <span>{formatRelativeTime(createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{cleanContent}</p>
                </div>
            </div>
        );
    }

    // 7. Generic 1-line System Message Fallback
    const isAdd = cleanContent.toLowerCase().includes('added') || cleanContent.toLowerCase().includes('joined');
    const isRemove = cleanContent.toLowerCase().includes('removed') || cleanContent.toLowerCase().includes('left');

    return (
        <div className={cn("flex justify-center my-2 px-2", className)}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs">
                {isAdd ? (
                    <UserPlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : isRemove ? (
                    <UserMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ) : (
                    <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                )}
                <span>{cleanContent}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                    · {formatRelativeTime(createdAt)}
                </span>
            </div>
        </div>
    );
};

export default SystemMessageEvent;
