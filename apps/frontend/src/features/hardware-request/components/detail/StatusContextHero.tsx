import {
    Clock,
    FileCheck2,
    Package,
    Truck,
    Wrench,
    CheckCircle2,
    XCircle,
    Ban,
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
import { pickActiveSchedule } from '../../utils/active-schedule.util';

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
    const isInstallationOnly = String(r.justification || '').includes('[PENJADWALAN PEMASANGAN]');
    const isNonBudget = String(r.justification || '').includes('[NON-BUDGET]');

    const activeSchedule = pickActiveSchedule(r);
    const hasConfirmedSchedule = activeSchedule && ['CONFIRMED', 'IN_PROGRESS', 'DONE'].includes(activeSchedule.status);
    const hasProposedSchedule = activeSchedule && activeSchedule.status === 'PROPOSED_AWAITING_USER';

    const getInstallationOnlyExplanation = () => {
        if (hasConfirmedSchedule) {
            return {
                title: 'Pemasangan Hardware Terjadwal',
                description: 'Jadwal pemasangan perangkat telah disepakati. Teknisi ICT akan hadir ke lokasi sesuai waktu yang telah dikonfirmasi.',
                icon: CheckCircle2,
            };
        }
        if (hasProposedSchedule) {
            return {
                title: 'Usulan Jadwal Siap — Menunggu Pilihan Anda',
                description: 'Tim ICT telah mengusulkan pilihan slot waktu pemasangan. Silakan pilih salah satu jadwal yang sesuai pada panel aksi.',
                icon: Calendar,
            };
        }
        return {
            title: 'Permintaan Diajukan — Menunggu Usulan Jadwal',
            description: 'Pengajuan pemasangan hardware telah diterima. Tim ICT sedang mengoordinasikan teknisi dan akan segera mengusulkan pilihan slot waktu kepada Anda.',
            icon: Clock,
        };
    };

    const baseExplanation = STATUS_EXPLANATIONS[r.status] || STATUS_EXPLANATIONS.SUBMITTED;
    const explanation = (r.status === 'INSTALLATION' && isInstallationOnly)
        ? getInstallationOnlyExplanation()
        : baseExplanation;
    const StatusIcon = explanation.icon;

    const stepIndex = REQUEST_PIPELINE.indexOf(r.status);
    const isPipelineStatus = stepIndex >= 0;

    const totalUnits = (r.items ?? []).reduce((acc, it) => acc + (it.quantity || 1), 0);

    return (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden mb-6">
            <div className="p-5 sm:p-6 space-y-5">
                {/* Status Explanation Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-4.5 rounded-xl bg-muted/30 border border-border/70">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div
                            className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                            style={{
                                backgroundColor: `${meta.hex}15`,
                                color: meta.hex,
                            }}
                        >
                            <StatusIcon className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                    {explanation.title}
                                </h2>
                                <StatusBadge status={r.status} size="sm" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {explanation.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-medium flex-wrap">
                                <span className="inline-flex items-center gap-1 font-semibold text-foreground/90">
                                    <Layers className="size-3 text-primary" />
                                    <span>{r.items?.length || 0} Jenis ({totalUnits} Unit)</span>
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <MapPin className="size-3 text-slate-400" />
                                    <span>{r.site?.name ?? '—'}</span>
                                </span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <Calendar className="size-3 text-slate-400" />
                                    <span>Diajukan {fmtDate(r.submittedAt || r.createdAt)}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Minimalist Connected Stepper Pipeline */}
                <div className="pt-1">
                    <StatusPipeline current={r.status} isInstallationOnly={isInstallationOnly} />
                </div>
            </div>
        </div>
    );
}
