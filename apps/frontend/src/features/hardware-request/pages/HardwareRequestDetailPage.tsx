import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Check, Copy, Cpu, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useHardwareRequest } from '../hooks/useHardwareRequest';
import { useHardwareRequestRealtime } from '../hooks/useHardwareRequestRealtime';
import { useHardwareRole } from '../hooks/usePermissions';
import { capsFor } from '../utils/permission.util';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatusContextHero } from '../components/detail/StatusContextHero';
import { RequestInfoCard } from '../components/detail/RequestInfoCard';
import { ItemsCard } from '../components/detail/ItemsCard';
import { CommentThread } from '../components/detail/CommentThread';
import { ActivityTimeline } from '../components/detail/ActivityTimeline';
import { ActionPanel } from '../components/detail/ActionPanel';
import { useHardwareBasePath } from '../hooks/useHardwareBasePath';
import { InstallationScheduleCard } from '../components/detail/InstallationScheduleCard';
import { SlotPickerModal } from '../components/scheduling/SlotPickerModal';
import { RescheduleRequestModal } from '../components/scheduling/RescheduleRequestModal';
import { ScheduleProposeModal } from '../components/scheduling/ScheduleProposeModal';
import type { InstallationSchedule } from '../types';

export default function HardwareRequestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { data: r, isLoading, isError } = useHardwareRequest(id);
    const { userId, role } = useHardwareRole();
    const basePath = useHardwareBasePath();
    const [copied, setCopied] = useState(false);
    useHardwareRequestRealtime(id);

    // Modal state for direct actions on detail page
    const [pickerSched, setPickerSched] = useState<InstallationSchedule | null>(null);
    const [rescheduleSched, setRescheduleSched] = useState<InstallationSchedule | null>(null);
    const [proposeOpen, setProposeOpen] = useState(false);

    if (isLoading) return <DetailSkeleton />;
    if (isError || !r) {
        return (
            <div className="max-w-7xl mx-auto p-8 text-center bg-card border border-border rounded-3xl m-6">
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    Gagal memuat rincian permintaan hardware.
                </p>
                <Link
                    to={basePath}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                    <ArrowLeft className="size-3.5" />
                    <span>Kembali ke Daftar Request</span>
                </Link>
            </div>
        );
    }

    const isStaff = role === 'ICT_STAFF';
    const caps = capsFor({ id: userId, role }, r);

    const activeSchedule = (r.schedules && r.schedules.length > 0)
        ? [...r.schedules].reverse().find((s) => s.status !== 'CANCELLED') || r.schedules[r.schedules.length - 1]
        : r.installationSchedule;

    const arrivedItems = (r.items ?? []).filter((i) => i.deliveryStatus === 'ARRIVED');

    const copyRequestId = () => {
        navigator.clipboard.writeText(r.requestNumber);
        setCopied(true);
        toast.success(`Nomor request ${r.requestNumber} disalin`);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-16 animate-fade-in-up">
            {/* ── STICKY TOPBAR ── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="sticky top-0 z-20 bg-background/90 backdrop-blur-md py-3 -mx-2 sm:-mx-4 px-2 sm:px-4 border-b border-border mb-6"
            >
                <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
                    {/* Back button & Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Link
                            to={basePath}
                            className="size-9 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-all shrink-0 shadow-2xs cursor-pointer"
                            title="Kembali ke Daftar Request"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>

                        <div className="flex items-center gap-2 min-w-0">
                            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Cpu className="size-4" />
                            </div>
                            
                            <button
                                type="button"
                                onClick={copyRequestId}
                                className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-foreground bg-muted/50 hover:bg-muted px-2.5 py-1 rounded-lg border border-border/80 transition-colors cursor-pointer shadow-2xs shrink-0"
                                title="Klik untuk salin nomor request"
                            >
                                <span>{r.requestNumber}</span>
                                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-muted-foreground" />}
                            </button>

                            <span className="text-muted-foreground hidden sm:inline">·</span>

                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-semibold truncate">
                                <MapPin className="size-3 text-primary" />
                                <span>{r.site?.name ?? 'Site'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status & Quick Schedule Button */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <StatusBadge status={r.status} size="sm" />
                        <Link
                            to={`${basePath}/calendar`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground p-2 sm:px-3 sm:py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Kalender Instalasi"
                        >
                            <Calendar className="size-3.5 text-primary shrink-0" />
                            <span className="hidden sm:inline">Kalender</span>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* ── STATUS CONTEXT HERO (Explanation + Tracker + 4 KPI Cards) ── */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.35 }}
            >
                <StatusContextHero r={r} />
            </motion.div>

            {/* ── MAIN SPLIT LAYOUT ── */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
                {/* Left Column: Schedule Card, Mobile Action Panel (lg:hidden), Request Info & Bento Item Cards & Comment Thread */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.35 }}
                    className="space-y-6 min-w-0"
                >
                    {/* Dedicated Installation Schedule Card */}
                    {activeSchedule && (
                        <InstallationScheduleCard
                            request={r}
                            schedule={activeSchedule}
                            isStaff={isStaff}
                            onSelectSlot={(s: InstallationSchedule) => setPickerSched(s)}
                            onReschedule={(s: InstallationSchedule) => setRescheduleSched(s)}
                            onProposeNewSlots={() => setProposeOpen(true)}
                        />
                    )}

                    {/* Mobile Action Panel: positioned right after schedule so users don't need to scroll down */}
                    <div className="lg:hidden">
                        <ActionPanel
                            r={r}
                            onProposeSchedule={() => setProposeOpen(true)}
                            onSelectSlot={(s: InstallationSchedule) => setPickerSched(s)}
                        />
                    </div>

                    <RequestInfoCard r={r} />
                    <ItemsCard r={r} />
                    <CommentThread requestId={r.id} canComment={caps.canComment} />
                </motion.div>

                {/* Right Column: Desktop Sticky Contextual Action Hub & Activity Log */}
                <motion.aside
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.35 }}
                    className="space-y-6 lg:sticky lg:top-[74px]"
                >
                    <div className="hidden lg:block">
                        <ActionPanel
                            r={r}
                            onProposeSchedule={() => setProposeOpen(true)}
                            onSelectSlot={(s: InstallationSchedule) => setPickerSched(s)}
                        />
                    </div>
                    <ActivityTimeline requestId={r.id} />
                </motion.aside>
            </div>

            {/* Global Modals for Scheduling */}
            {pickerSched && (
                <SlotPickerModal
                    open={!!pickerSched}
                    onOpenChange={(o) => !o && setPickerSched(null)}
                    requestId={r.id}
                    schedule={pickerSched}
                />
            )}

            {rescheduleSched && (
                <RescheduleRequestModal
                    open={!!rescheduleSched}
                    onOpenChange={(o) => !o && setRescheduleSched(null)}
                    requestId={r.id}
                    scheduleId={rescheduleSched.id}
                />
            )}

            <ScheduleProposeModal
                open={proposeOpen}
                onOpenChange={setProposeOpen}
                requestId={r.id}
                arrivedItems={arrivedItems}
                defaultTechnicianId={userId}
                siteName={r.site?.name}
            />
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-pulse">
            <div className="h-12 bg-muted/40 rounded-2xl" />
            <div className="h-44 bg-muted/40 rounded-3xl" />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
                <div className="space-y-5">
                    <div className="h-64 bg-muted/40 rounded-3xl" />
                    <div className="h-72 bg-muted/40 rounded-3xl" />
                </div>
                <div className="space-y-5">
                    <div className="h-48 bg-muted/40 rounded-3xl" />
                    <div className="h-64 bg-muted/40 rounded-3xl" />
                </div>
            </div>
        </div>
    );
}
