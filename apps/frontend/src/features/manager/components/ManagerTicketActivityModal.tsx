import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ticketApi } from '@/lib/api/tickets.api';
import { TicketHistory } from '@/features/ticket-board/components/ticket-detail/TicketHistory';
import { TicketDetail } from '@/features/ticket-board/components/ticket-detail/types';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import {
    Activity,
    AlertTriangle,
    Building2,
    Calendar,
    Clock,
    Flame,
    Loader2,
    Shield,
    Tag,
    User,
    UserCheck,
    X,
    FileText,
    CheckCircle2,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagerTicketActivityModalProps {
    ticketId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const STATUS_BADGE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    TODO: { label: 'To Do', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
    WAITING_VENDOR: { label: 'Waiting Vendor', color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500' },
    RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', dot: 'bg-red-500' },
};

const PRIORITY_BADGE_CONFIG: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    MEDIUM: { label: 'Medium', color: 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400' },
    HIGH: { label: 'High', color: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400' },
    CRITICAL: { label: 'Critical', color: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400' },
};

export const ManagerTicketActivityModal: React.FC<ManagerTicketActivityModalProps> = ({
    ticketId,
    open,
    onOpenChange,
}) => {
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && ticketId) {
            fetchTicketDetail(ticketId);
        } else if (!open) {
            setTicket(null);
            setError(null);
        }
    }, [open, ticketId]);

    const fetchTicketDetail = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await ticketApi.get(id);
            const data = response.data as any;
            
            // Normalize data to TicketDetail interface
            const normalizedTicket: TicketDetail = {
                id: data.id,
                ticketNumber: data.ticketNumber,
                title: data.title || data.subject || 'Untitled Ticket',
                description: data.description || '',
                status: data.status || 'TODO',
                priority: data.priority || 'MEDIUM',
                category: typeof data.category === 'object' ? data.category?.name || 'General' : data.category || 'General',
                device: data.device,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                slaTarget: data.slaTarget,
                isHardwareInstallation: data.isHardwareInstallation,
                scheduledDate: data.scheduledDate,
                scheduledTime: data.scheduledTime,
                hardwareType: data.hardwareType,
                userAcknowledged: data.userAcknowledged,
                user: {
                    id: data.user?.id || data.userId,
                    fullName: data.user?.fullName || data.requester?.fullName || 'Requester',
                    email: data.user?.email || data.requester?.email || '-',
                    department: data.user?.department ? { name: data.user.department.name } : undefined,
                    site: data.site ? { name: data.site.name, code: data.site.code } : undefined,
                },
                assignedTo: data.assignedTo ? {
                    id: data.assignedTo.id,
                    fullName: data.assignedTo.fullName,
                    email: data.assignedTo.email,
                    site: data.assignedTo.site ? { name: data.assignedTo.site.name, code: data.assignedTo.site.code } : undefined,
                } : undefined,
                messages: (data.messages || []).map((msg: any) => ({
                    id: msg.id,
                    content: msg.content,
                    createdAt: msg.createdAt,
                    isSystemMessage: msg.isSystemMessage ?? true,
                    isInternal: msg.isInternal,
                    attachments: msg.attachments || [],
                    sender: msg.sender ? {
                        id: msg.sender.id,
                        fullName: msg.sender.fullName || 'System',
                    } : undefined,
                })),
            };

            setTicket(normalizedTicket);
        } catch (err: any) {
            console.error('Failed to fetch ticket detail for manager:', err);
            setError(err.response?.data?.message || 'Gagal memuat detail dan log aktivitas tiket');
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = ticket ? STATUS_BADGE_CONFIG[ticket.status] || STATUS_BADGE_CONFIG.TODO : STATUS_BADGE_CONFIG.TODO;
    const priorityConfig = ticket ? PRIORITY_BADGE_CONFIG[ticket.priority] || PRIORITY_BADGE_CONFIG.MEDIUM : PRIORITY_BADGE_CONFIG.MEDIUM;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col rounded-2xl bg-card border-border/80 shadow-2xl">
                {/* Header */}
                <DialogHeader className="p-5 pb-4 border-b border-border/80 bg-muted/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-bold text-primary border-primary/30 bg-primary/10">
                                    <Shield className="w-3.5 h-3.5 mr-1" />
                                    Manager Audit View
                                </Badge>
                                {ticket?.ticketNumber && (
                                    <span className="font-mono text-xs font-extrabold text-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/60">
                                        {ticket.ticketNumber}
                                    </span>
                                )}
                                {ticket?.user?.site?.code && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                                        {ticket.user.site.code}
                                    </span>
                                )}
                            </div>
                            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground line-clamp-1">
                                {ticket?.title || 'Detail Tiket'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                                Mode Pemantauan: Menampilkan ringkasan informasi dan riwayat log aktivitas tiket.
                            </DialogDescription>
                        </div>

                        {ticket && (
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                                    statusConfig.color
                                )}>
                                    <span className={cn("w-2 h-2 rounded-full", statusConfig.dot)} />
                                    {statusConfig.label}
                                </span>
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                                    priorityConfig.color
                                )}>
                                    {ticket.priority === 'CRITICAL' && <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                                    {ticket.priority === 'HIGH' && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                                    {priorityConfig.label}
                                </span>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm font-medium">Memuat log aktivitas tiket...</p>
                        </div>
                    ) : error ? (
                        <div className="py-16 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-medium text-foreground">{error}</p>
                            {ticketId && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fetchTicketDetail(ticketId)}
                                    className="rounded-xl"
                                >
                                    Coba Lagi
                                </Button>
                            )}
                        </div>
                    ) : ticket ? (
                        <>
                            {/* Overview Bento Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {/* Requester Card */}
                                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <User className="w-3.5 h-3.5 text-primary" />
                                        Requester
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                                            {ticket.user?.fullName?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{ticket.user?.fullName}</p>
                                            <p className="text-xs text-muted-foreground truncate">{ticket.user?.department?.name || ticket.user?.email || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Assignee Card */}
                                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                                        Assigned Agent
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                                            ticket.assignedTo
                                                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                                : "bg-muted text-muted-foreground border border-border/60"
                                        )}>
                                            {ticket.assignedTo?.fullName ? ticket.assignedTo.fullName.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">
                                                {ticket.assignedTo?.fullName || 'Belum Ditugaskan'}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {ticket.assignedTo?.email || 'Menunggu penugasan agen'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline & Category Card */}
                                <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                        Waktu & Kategori
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Dibuat:</span>
                                            <span className="font-semibold text-foreground" title={ticket.createdAt ? formatDateTimeID(ticket.createdAt) : undefined}>
                                                {ticket.createdAt ? formatRelativeTime(ticket.createdAt) : '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Kategori:</span>
                                            <span className="font-semibold text-foreground truncate max-w-[150px]">{ticket.category}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Description Card */}
                            {ticket.description && (
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <FileText className="w-3.5 h-3.5 text-primary" />
                                        Deskripsi Keluhan / Tiket
                                    </div>
                                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                        {ticket.description.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim()}
                                    </p>
                                </div>
                            )}

                            {/* Activity Log Section */}
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-bold text-foreground">Log Aktivitas & Audit Trail</h3>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {(ticket.messages || []).length} riwayat tercatat
                                    </span>
                                </div>

                                <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                                    <TicketHistory ticket={ticket} />
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {ticket?.updatedAt ? `Terakhir diperbarui ${formatRelativeTime(ticket.updatedAt)}` : ''}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 text-xs font-semibold cursor-pointer"
                    >
                        Tutup
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ManagerTicketActivityModal;
