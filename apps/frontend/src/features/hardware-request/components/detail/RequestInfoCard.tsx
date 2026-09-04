import { Building2, Calendar, Coins, FileText, MapPin, User, Users, AlertTriangle } from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { fmtDateTime } from '../../utils/format.util';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { HardwareRequest } from '../../types';

function getDeptName(dept: any): string {
    if (!dept) return '—';
    if (typeof dept === 'string') return dept;
    return dept.name || dept.code || '—';
}

export function RequestInfoCard({ r }: { r: HardwareRequest | any }) {
    const isNonBudget = String(r.justification || '').includes('[NON-BUDGET]');
    const cleanJustification = String(r.justification || '')
        .replace(/^\[(BUDGET TAHUNAN|NON-BUDGET)\]\s*/i, '');

    // Parse recipient names if comma separated
    const rawRecipients = r.recipientName || r.recipient?.fullName || '';
    const recipientList = rawRecipients
        ? rawRecipients.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    return (
        <SectionCard title="Informasi Permintaan">
            <div className="space-y-5">
                {/* Budget Category Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border border-border/60">
                    <div className="flex items-center gap-2">
                        <Coins className="size-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Kategori Anggaran
                        </span>
                    </div>
                    <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            isNonBudget
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                : 'bg-primary/10 text-primary border border-primary/20'
                        }`}
                    >
                        {isNonBudget ? 'Pengajuan Budget Tambahan / Non-Tahunan' : 'Realisasi Budget Tahunan ICT'}
                    </span>
                </div>

                {/* Requester & Department Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Requester */}
                    <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-start gap-3">
                        <UserAvatar user={r.requester} size="sm" />
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Pemohon (Requester)
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
                                {r.requester?.fullName ?? '—'}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                                {r.requester?.email || ''}
                            </div>
                        </div>
                    </div>

                    {/* Divisi */}
                    <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs flex items-start gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="size-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Divisi / Departemen
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
                                {getDeptName(r.division)}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="size-3 text-slate-400" />
                                <span>{r.site?.name ?? '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recipient Names */}
                <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        <span>Penerima Barang</span>
                    </span>
                    {recipientList.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {recipientList.map((name: string) => (
                                <span
                                    key={name}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 text-foreground border border-border text-xs font-semibold"
                                >
                                    <User className="size-3 text-primary" />
                                    <span>{name}</span>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs font-semibold text-muted-foreground italic">
                            Sama dengan pemohon (requester)
                        </span>
                    )}
                </div>

                {/* Justifikasi */}
                <div className="space-y-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-primary" />
                        <span>Justifikasi Kebutuhan & Keterangan</span>
                    </span>
                    <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-xs sm:text-sm text-foreground leading-relaxed italic whitespace-pre-wrap">
                        "{cleanJustification || r.justification || '—'}"
                    </div>
                </div>

                {/* Timestamps */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-[11px] text-muted-foreground font-medium">
                    <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-slate-400" />
                        <span>Diajukan pada: <strong>{fmtDateTime(r.submittedAt || r.createdAt)}</strong></span>
                    </div>
                    {r.updatedAt && (
                        <span>Update terakhir: {fmtDateTime(r.updatedAt)}</span>
                    )}
                </div>

                {/* Reject Reason Banner if any */}
                {r.rejectReason && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                            <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                            <span>Alasan Penolakan Permintaan</span>
                        </div>
                        <p className="text-xs font-medium whitespace-pre-wrap pl-5">
                            {r.rejectReason}
                        </p>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
