import {
    Clock,
    FileCheck2,
    Package,
    Truck,
    Wrench,
    CheckCircle2,
    XCircle,
    Ban,
    Coins,
    MapPin,
    Layers,
    Calendar,
    Sparkles,
} from 'lucide-react';
import { StatusPipeline } from '../common/StatusPipeline';
import { StatusBadge } from '../common/StatusBadge';
import { STATUS_META, getStatusMeta } from '../../utils/status.util';
import { fmtDate } from '../../utils/format.util';
import { REQUEST_PIPELINE, type HardwareRequest, type RequestStatus } from '../../types';

interface StatusExplanation {
    title: string;
    description: string;
    icon: any;
}

const STATUS_EXPLANATIONS: Record<RequestStatus, StatusExplanation> = {
    DRAFT: {
        title: 'Draft Permintaan Baru',
        description: 'Pengajuan ini masih berupa draf. Silakan periksa kembali kelengkapan item dan klik Submit agar tim ICT dapat meninjau kebutuhan Anda.',
        icon: FileCheck2,
    },
    SUBMITTED: {
        title: 'Permintaan Berhasil Diajukan',
        description: 'Pengajuan telah masuk ke sistem dan sedang menunggu antrean peninjauan oleh tim Supervisor ICT.',
        icon: Clock,
    },
    UNDER_REVIEW: {
        title: 'Sedang Ditinjau oleh Tim ICT',
        description: 'Tim ICT sedang mengevaluasi kesesuaian spesifikasi perangkat keras dan kelayakan alokasi anggaran.',
        icon: Clock,
    },
    APPROVED: {
        title: 'Pengajuan Telah Disetujui',
        description: 'Permintaan hardware telah disetujui. Tim ICT sedang menyiapkan dokumen Surat Permintaan Pengadaan (SPP).',
        icon: CheckCircle2,
    },
    PROCUREMENT: {
        title: 'SPP Telah Diterbitkan (SPP Issued)',
        description: 'Surat Permintaan Pengadaan (SPP) telah diterbitkan dan diproses ke bagian pengadaan/purchasing untuk pemesanan ke vendor.',
        icon: FileCheck2,
    },
    AWAITING_DELIVERY: {
        title: 'Menunggu Pengiriman Barang dari Vendor',
        description: 'Barang sedang dalam proses pengiriman oleh vendor ke lokasi site. Sistem akan otomatis mengirimkan notifikasi email saat barang tiba.',
        icon: Truck,
    },
    INSTALLATION: {
        title: 'Barang Tiba — Proses Penjadwalan & Instalasi',
        description: 'Perangkat telah tiba di lokasi. Tim teknisi ICT sedang mengoordinasikan jadwal pemasangan dan registrasi barcode aset.',
        icon: Wrench,
    },
    AWAITING_USER_CONFIRMATION: {
        title: 'Menunggu Konfirmasi Penerimaan Anda',
        description: 'Pemasangan perangkat telah selesai dilakukan oleh teknisi. Mohon periksa fisik & fungsi perangkat lalu lakukan konfirmasi pada panel aksi.',
        icon: Sparkles,
    },
    COMPLETED: {
        title: 'Permintaan Selesai & Perangkat Terpasang',
        description: 'Seluruh perangkat keras telah berhasil dipasang, dicatat nomor asetnya, dan diserahkan kepada penerima dengan baik.',
        icon: CheckCircle2,
    },
    REJECTED: {
        title: 'Permintaan Ditolak',
        description: 'Pengajuan hardware ini tidak disetujui. Silakan periksa alasan penolakan pada kartu rincian permintaan di bawah.',
        icon: XCircle,
    },
    CANCELLED: {
        title: 'Permintaan Dibatalkan',
        description: 'Tiket pengajuan ini telah dibatalkan.',
        icon: Ban,
    },
};

export function StatusContextHero({ r }: { r: HardwareRequest }) {
    const meta = getStatusMeta(r.status);
    const explanation = STATUS_EXPLANATIONS[r.status] || STATUS_EXPLANATIONS.SUBMITTED;
    const StatusIcon = explanation.icon;

    const stepIndex = REQUEST_PIPELINE.indexOf(r.status);
    const isPipelineStatus = stepIndex >= 0;

    const totalUnits = (r.items ?? []).reduce((acc, it) => acc + (it.quantity || 1), 0);
    const isNonBudget = String(r.justification || '').includes('[NON-BUDGET]');

    return (
        <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden mb-6">
            {/* Top Accent Stripe */}
            <div
                className="h-1.5 w-full"
                style={{
                    background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}40)`,
                }}
            />

            <div className="p-5 sm:p-6 space-y-6">
                {/* Status Explanation Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-muted/20 border border-border/80">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div
                            className="size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs"
                            style={{
                                backgroundColor: `${meta.hex}18`,
                                color: meta.hex,
                            }}
                        >
                            <StatusIcon className="size-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-extrabold text-foreground">
                                    {explanation.title}
                                </h2>
                                <StatusBadge status={r.status} size="sm" />
                                {isPipelineStatus && (
                                    <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                        Tahap {stepIndex + 1} dari {REQUEST_PIPELINE.length}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                                {explanation.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 8-Step Interactive Pipeline */}
                <div className="pt-1">
                    <StatusPipeline current={r.status} />
                </div>

                {/* 4 Bento Mini-KPI Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60">
                    {/* Total Perangkat */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                            <Layers className="size-3 text-primary" />
                            <span>Total Perangkat</span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-foreground">
                            {r.items?.length || 0} Jenis ({totalUnits} Unit)
                        </div>
                    </div>

                    {/* Kategori Anggaran */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                            <Coins className="size-3 text-primary" />
                            <span>Kategori Budget</span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                            {isNonBudget ? 'Non-Budget' : 'Budget Tahunan'}
                        </div>
                    </div>

                    {/* Lokasi Site */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                            <MapPin className="size-3 text-primary" />
                            <span>Lokasi Site</span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                            {r.site?.name ?? '—'}
                        </div>
                    </div>

                    {/* Tanggal Pengajuan */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                            <Calendar className="size-3 text-primary" />
                            <span>Diajukan</span>
                        </div>
                        <div className="text-xs sm:text-sm font-extrabold text-foreground">
                            {fmtDate(r.submittedAt || r.createdAt)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
