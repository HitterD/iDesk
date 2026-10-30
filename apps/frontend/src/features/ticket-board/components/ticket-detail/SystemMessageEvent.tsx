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
    Truck,
    UserRoundCog,
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
import { STATUS_TONE_CLASSES } from '@/lib/constants/ticket.constants';
import { formatRelativeTime, formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatMessageTime, toDisplayName } from './messageThread';

interface SystemMessageEventProps {
    content: string;
    createdAt: string;
    attachments?: string[];
    onImageClick?: (url: string) => void;
    className?: string;
    /** Requester copy hides staff-only details (SLA pause note, actor). */
    audience?: 'staff' | 'requester';
}

// Config for status badges with Indonesian labels & tailored colors
const STATUS_MAP: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
    TODO: {
        label: 'Baru (TODO)',
        bg: STATUS_TONE_CLASSES.TODO.bg,
        text: STATUS_TONE_CLASSES.TODO.text,
        border: STATUS_TONE_CLASSES.TODO.border,
        dot: STATUS_TONE_CLASSES.TODO.dot,
        icon: Clock,
    },
    IN_PROGRESS: {
        label: 'Sedang Dikerjakan',
        bg: STATUS_TONE_CLASSES.IN_PROGRESS.bg,
        text: STATUS_TONE_CLASSES.IN_PROGRESS.text,
        border: STATUS_TONE_CLASSES.IN_PROGRESS.border,
        dot: STATUS_TONE_CLASSES.IN_PROGRESS.dot,
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

const PRIORITY_MAP: Record<string, { label: string; shortLabel?: string; bg: string; text: string; border: string }> = {
    LOW: { label: 'Low (Minor/Cosmetic)', shortLabel: 'Low', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    MEDIUM: { label: 'Normal (Moderate)', shortLabel: 'Normal', bg: 'bg-primary/10 dark:bg-primary/20', text: 'text-primary', border: 'border-primary/20 dark:border-primary/30' },
    HIGH: { label: 'Urgent (Major Impact)', shortLabel: 'Urgent', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    CRITICAL: { label: 'Blocker (Critical)', shortLabel: 'Blocker', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
};

export const SystemMessageEvent: React.FC<SystemMessageEventProps> = ({
    content,
    createdAt,
    attachments = [],
    onImageClick,
    className,
    audience = 'staff',
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
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06] overflow-hidden text-left">
                    {/* Header Banner */}
                    <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    Tiket Dinyatakan Selesai (Resolved)
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Pekerjaan &amp; solusi perbaikan telah diselesaikan
                                </p>
                            </div>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>

                    {/* Content Details */}
                    <div className="px-4 pb-3.5 space-y-3 text-xs text-slate-700 dark:text-slate-200">
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Tindakan &amp; Penjelasan Solusi:</span>
                            </div>
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                                {solutionText || 'Tiket telah diselesaikan sesuai instruksi.'}
                            </p>
                        </div>

                        {/* Attachments / Bukti Foto */}
                        {attachments && attachments.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Bukti Foto / Lampiran Penyelesaian ({attachments.length}):</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {attachments.map((url, idx) => {
                                        const isPdf = typeof url === 'string' && url.toLowerCase().includes('.pdf');
                                        return (
                                            <div
                                                key={idx}
                                                className="group relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer transition-all h-24"
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
                    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {actorMatch ? (
                            <div className="flex items-center gap-1.5">
                                <UserIcon className="w-3 h-3 text-emerald-600" />
                                <span>Diselesaikan oleh <strong className="font-medium text-slate-800 dark:text-slate-200">{toDisplayName(actorMatch[1].trim())}</strong></span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Status tiket: <strong className="font-medium">Resolved</strong></span>
                            </div>
                        )}
                        <span>{formatDateTimeID(createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 0.1 Detect SLA Extension Notice
    const isSlaExtensionNotice =
        content.includes('Target SLA Diperpanjang') ||
        content.includes('SLA Diperpanjang') ||
        (content.includes('Deadline Baru') && content.includes('Kategori'));

    if (isSlaExtensionNotice) {
        // Strip emojis and markdown asterisks for a clean Apple look
        const sanitize = (text: string) =>
            text
                .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
                .replace(/\*\*/g, '')
                .trim();

        const deadlineMatch = content.match(/(?:Deadline Baru|Target Baru):\s*([^\n\r]+)/i);
        const categoryMatch = content.match(/(?:Kategori Kendala|Kategori Alasan|Kategori):\s*([^\n\r]+)/i);
        const explanationMatch = content.match(/(?:Penjelasan|Alasan|Rincian):\s*([\s\S]+?)(?:\n\s*(?:Diperpanjang oleh|Diubah oleh|Oleh|$)|$)/i);
        const actorMatch = content.match(/(?:Diperpanjang oleh|Diubah oleh|Oleh):\s*([^\n\r]+)/i);

        const deadline = deadlineMatch ? sanitize(deadlineMatch[1]) : '';
        const category = categoryMatch ? sanitize(categoryMatch[1]) : '';
        const explanation = explanationMatch ? sanitize(explanationMatch[1]) : '';
        const actor = actorMatch ? sanitize(actorMatch[1]) : '';

        return (
            <div className={cn("w-full flex justify-center my-3.5 px-2", className)}>
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06] overflow-hidden text-left">
                    {/* Header (Apple Sheet Style) */}
                    <div className="px-4 pt-3.5 pb-1 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white">
                                    Target SLA Diperpanjang
                                </h4>
                            </div>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                            {formatRelativeTime(createdAt)}
                        </span>
                    </div>

                    {/* Body */}
                    <div className="p-3.5 space-y-2.5 text-xs">
                        {/* Target Deadline Baru & Kategori */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {deadline && (
                                <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] flex items-start gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                                            Target Baru
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                            {deadline}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {category && (
                                <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] flex items-start gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                                            Kategori Kendala
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate block">
                                            {category}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Penjelasan Alasan */}
                        {explanation && (
                            <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] space-y-1">
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                                    Rincian Kendala
                                </span>
                                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    "{explanation}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                        {actor ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">
                                    Diperpanjang oleh <strong className="font-medium">{toDisplayName(actor)}</strong>
                                </span>
                            </div>
                        ) : (
                            <span>Pembaruan SLA Otomatis</span>
                        )}
                        <span className="shrink-0">{formatDateTimeID(createdAt)}</span>
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
            <div className={cn('chat-event', className)}>
                <div className="chat-event-h">
                    <span className="chat-event-ic"><Truck aria-hidden="true" /></span>
                    <div className="min-w-0">
                        <b>Menunggu kunjungan vendor</b>
                        <small>
                            {audience === 'requester' ? 'Teknisi vendor akan datang ke lokasi Anda' : 'Ditambahkan ke jadwal vendor luar'}
                            {actorMatch && audience !== 'requester' && (
                                <> · oleh <strong className="font-medium">{toDisplayName(actorMatch[1].trim())}</strong></>
                            )}
                            {' · '}{formatMessageTime(createdAt)}
                        </small>
                    </div>
                </div>
                {descriptionMatch && <p className="chat-event-note m-0"><Info aria-hidden="true" />{descriptionMatch[1].trim()}</p>}
                {(scheduleMatch || visitMatch) && (
                    <div className="chat-event-kv">
                        {scheduleMatch && <div><small>Jadwal vendor</small><b>{scheduleMatch[1].trim()}</b></div>}
                        {visitMatch && <div><small>Perkiraan kunjungan</small><b>{visitMatch[1].trim()}</b></div>}
                    </div>
                )}
                {waitMatch && (
                    <p className="chat-event-note m-0"><Hourglass aria-hidden="true" />Estimasi waktu tunggu: <strong className="font-semibold">{waitMatch[1].trim()}</strong></p>
                )}
                {isSlaPaused && audience !== 'requester' && (
                    <p className="chat-event-note m-0"><Pause aria-hidden="true" />Perhitungan waktu SLA di-pause sampai vendor datang dan tiket dilanjutkan.</p>
                )}
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
        const toConfig = STATUS_MAP[toKey] || { label: toKey, bg: 'bg-primary/10 dark:bg-primary/20', text: 'text-primary', border: 'border-primary/20 dark:border-primary/30', dot: 'bg-primary', icon: CheckCircle2 };
        const ToIcon = toConfig.icon;

        return (
            <div className={cn("chat-sys", className)}>
                <span className="chat-sys-ic"><ToIcon aria-hidden="true" /></span>
                <div className="inline-flex max-w-xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</span>

                    {/* From Badge */}
                    <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium opacity-70",
                        fromConfig.bg, fromConfig.text
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", fromConfig.dot)} />
                        {fromConfig.label}
                    </span>

                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />

                    {/* To Badge */}
                    <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        toConfig.bg, toConfig.text
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", toConfig.dot)} />
                        {toConfig.label}
                    </span>
                </div>

                {/* Subtitle / Actor Info */}
                <small className="flex items-center gap-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="font-medium">{toDisplayName(actor)}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatMessageTime(createdAt)}</span>
                </small>
            </div>
        );
    }

    // 3. Parse Assignment Change, e.g. "Ticket reassigned to B (was A) by C. Alasan: ..." (status-takeover.ts)
    const assignMatch = cleanContent.match(/Ticket (?:re)?assigned to (.+?)(?:\s*\(was\s*(.+?)\))?(?:\s+by\s+(.+?))?(?:\.?\s*\(?Alasan:\s*(.+?)\)?)?$/i) ||
        cleanContent.match(/Assigned to:\s*([^,.]+)(?:\s+by\s+([^,.]+))?/i);

    if (assignMatch) {
        const to = assignMatch[1].trim();
        const rawFrom = assignMatch[2]?.trim();
        const from = rawFrom && !['none', 'unassigned'].includes(rawFrom.toLowerCase()) ? rawFrom : undefined;
        const actor = assignMatch[3]?.trim();
        const reason = assignMatch[4]?.trim();
        const requesterView = audience === 'requester';

        return (
            <div className={cn("chat-sys", className)}>
                <span className="chat-sys-ic"><UserRoundCog aria-hidden="true" /></span>
                <span>
                    {requesterView ? (
                        <>Tiket Anda sekarang ditangani <b>{toDisplayName(to)}</b></>
                    ) : from ? (
                        <>PIC dialihkan dari {toDisplayName(from)} ke <b>{toDisplayName(to)}</b>{reason && <> · Alasan: {reason}</>}</>
                    ) : (
                        <>Penugasan Teknisi: <b>{to}</b>{reason && <> · Alasan: {reason}</>}</>
                    )}
                </span>
                <small className="flex items-center gap-1">
                    {actor && !requesterView && (
                        <>
                            <span>oleh <strong className="font-medium">{toDisplayName(actor)}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatMessageTime(createdAt)}</span>
                </small>
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
            <div className={cn("chat-sys", className)}>
                <span className="chat-sys-ic"><AlertCircle aria-hidden="true" /></span>
                <div className="inline-flex max-w-xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Prioritas:</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium opacity-70", fromCfg.bg, fromCfg.text)}>
                        {fromCfg.label}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", toCfg.bg, toCfg.text)}>
                        {toCfg.label}
                    </span>
                </div>
                <small className="flex items-center gap-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="font-medium">{toDisplayName(actor)}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatMessageTime(createdAt)}</span>
                </small>
            </div>
        );
    }

    // 5. Parse Ticket Forwarded
    const forwardMatch = cleanContent.match(/Ticket forwarded to (.+?)(?:\s+by\s+([^,.]+))?$/i);
    if (forwardMatch) {
        const target = forwardMatch[1].trim();
        const actor = forwardMatch[2]?.trim();

        return (
            <div className={cn("chat-sys", className)}>
                <span className="chat-sys-ic"><Share2 aria-hidden="true" /></span>
                <div className="inline-flex max-w-xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed">
                    <span>Tiket Diteruskan ke:</span>
                    <b>{target}</b>
                </div>
                <small className="flex items-center gap-1">
                    {actor && (
                        <>
                            <span>oleh <strong className="font-medium">{toDisplayName(actor)}</strong></span>
                            <span>·</span>
                        </>
                    )}
                    <span>{formatMessageTime(createdAt)}</span>
                </small>
            </div>
        );
    }

    // 6. Generic Multiline System Message
    if (content.includes('\n')) {
        return (
            <div className={cn("w-full flex justify-center my-3 px-2", className)}>
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] text-[13px] text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" />
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
            <div className="inline-flex max-w-xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs leading-relaxed">
                {isAdd ? (
                    <UserPlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : isRemove ? (
                    <UserMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ) : (
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
                <span>{cleanContent}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                    · {formatMessageTime(createdAt)}
                </span>
            </div>
        </div>
    );
};

export default SystemMessageEvent;
