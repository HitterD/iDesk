import React from 'react';
import {
    Barcode,
    Building2,
    CheckCircle2,
    Clock,
    FileText,
    Layers,
    Package,
    Truck,
    User,
    Wrench,
} from 'lucide-react';
import { SectionCard } from '../common/SectionCard';
import { fmtIDR, fmtDate } from '../../utils/format.util';
import type { HardwareRequest, ItemCategory } from '../../types';
import { cn } from '@/lib/utils';

const CAT_ICON: Record<string, string> = {
    LAPTOP: '💻',
    DESKTOP: '🖥',
    MONITOR: '🖵',
    ACCESSORY: '🎧',
    NETWORK: '🌐',
    SOFTWARE: '📦',
    OTHER: '📋',
};

const DELIVERY_STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
    PENDING: { label: 'Menunggu Pengadaan', color: 'bg-muted text-muted-foreground border-border', icon: Clock },
    ORDERED: { label: 'Dipesan Vendor', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30', icon: Truck },
    ARRIVED: { label: 'Tiba di Lokasi', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', icon: Package },
    INSTALLED: { label: 'Sudah Terpasang', color: 'bg-primary/10 text-primary border-primary/30', icon: CheckCircle2 },
};

export function ItemsCard({ r, children }: { r: HardwareRequest; children?: React.ReactNode }) {
    const totalUnits = (r.items ?? []).reduce((acc, it) => acc + (it.quantity || 1), 0);

    return (
        <SectionCard
            title="Daftar Perangkat Hardware"
            action={
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    <Layers className="size-3" />
                    <span>{r.items?.length || 0} Jenis ({totalUnits} Unit)</span>
                </span>
            }
        >
            <div className="space-y-3.5">
                {r.items.map((it, idx) => {
                    const snap = it.categorySnapshot || {};
                    const category = (snap.category || 'OTHER') as ItemCategory;
                    const catIcon = CAT_ICON[category] || '📦';
                    const snapCustom = (snap.customFields || {}) as Record<string, any>;
                    const recipientName = snapCustom.recipientName || (it as any).customFields?.recipientName;
                    const assets = (r.assets ?? []).filter((a) => a.itemId === it.id);
                    const deliveryMeta = DELIVERY_STATUS_META[it.deliveryStatus || 'PENDING'] || DELIVERY_STATUS_META.PENDING;
                    const DeliveryIcon = deliveryMeta.icon;

                    return (
                        <div
                            key={it.id || idx}
                            className="p-4 rounded-2xl border border-border bg-card shadow-2xs hover:border-primary/40 transition-all duration-150 space-y-3"
                        >
                            {/* Card Top Row */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="size-10 rounded-xl bg-muted/60 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                                        {catIcon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-bold text-foreground leading-snug truncate">
                                            {String(snap.name ?? it.name ?? 'Item Hardware')}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                            {String(snap.code ?? it.catalogId ?? '')} · <span className="uppercase">{category}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantity badge */}
                                <div className="text-right shrink-0">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-muted text-xs font-black text-foreground tabular-nums shadow-2xs">
                                        × {it.quantity} Unit
                                    </span>
                                </div>
                            </div>

                            {/* Recipient & Delivery Status Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                                {/* Recipient */}
                                {recipientName ? (
                                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground bg-muted/40 px-2 py-0.5 rounded-lg">
                                        <User className="size-3 text-primary" />
                                        <span>Penerima: <strong>{recipientName}</strong></span>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-muted-foreground">
                                        Penerima: Divisi / Bersama
                                    </div>
                                )}

                                {/* Status Item Badge */}
                                <div className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border', deliveryMeta.color)}>
                                    <DeliveryIcon className="size-3" />
                                    <span>{deliveryMeta.label}</span>
                                </div>
                            </div>

                            {/* Custom Specs if any */}
                            {snapCustom && Object.keys(snapCustom).filter((k) => k !== 'recipientName').length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {Object.entries(snapCustom)
                                        .filter(([k]) => k !== 'recipientName')
                                        .map(([k, val]) => (
                                            <span
                                                key={k}
                                                className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md border border-border/40 font-mono"
                                            >
                                                {k}: <strong className="text-foreground">{String(val)}</strong>
                                            </span>
                                        ))}
                                </div>
                            )}

                            {/* Asset Barcodes (if registered) */}
                            {assets.length > 0 && (
                                <div className="pt-2 border-t border-border/50 space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Barcode className="size-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>Barcode Aset Terdaftar:</span>
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {assets.map((a) => (
                                            <span
                                                key={a.id}
                                                className="text-xs font-black font-mono rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 shadow-2xs"
                                            >
                                                {a.barcode}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Procurement/Vendor Details if any */}
                            {(it.vendor || it.actualCost != null || it.invoiceNumber) && (
                                <div className="pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-muted/20 p-2.5 rounded-xl">
                                    {it.vendor && (
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Vendor:</span>
                                            <span className="font-semibold text-foreground">{it.vendor}</span>
                                        </div>
                                    )}
                                    {it.actualCost != null && (
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Biaya Aktual:</span>
                                            <span className="font-semibold text-foreground">{fmtIDR(it.actualCost)}/unit</span>
                                        </div>
                                    )}
                                    {it.invoiceNumber && (
                                        <div>
                                            <span className="text-muted-foreground block text-[10px]">Invoice:</span>
                                            <span className="font-semibold text-foreground">
                                                {it.invoiceNumber} {it.invoiceDate && `(${fmtDate(it.invoiceDate)})`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {children}
        </SectionCard>
    );
}
