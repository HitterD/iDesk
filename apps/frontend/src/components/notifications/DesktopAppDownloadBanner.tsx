import React, { useState, useEffect } from 'react';
import { 
    Download, 
    Monitor, 
    Bell, 
    CheckCircle2, 
    ExternalLink, 
    Layers, 
    Terminal, 
    X,
    Laptop,
    Check,
    Copy,
    ChevronDown,
    Inbox,
    UserCheck,
    AlertTriangle,
    MessageSquare,
    Laptop2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { 
    getDesktopNotifierPreference, 
    setDesktopNotifierPreference, 
    type DesktopDisplayMode 
} from '@/lib/desktopNotifier';

interface DesktopAppDownloadBannerProps {
    variant?: 'compact' | 'full';
    className?: string;
    showAdminTools?: boolean;
}

const DISPLAY_MODES: Array<{
    id: DesktopDisplayMode;
    title: string;
    description: string;
    icon: React.ElementType;
}> = [
    {
        id: 'both',
        title: 'Keduanya (Rekomendasi)',
        description: 'Toast di sudut layar & Popup di tengah layar',
        icon: Layers,
    },
    {
        id: 'toast',
        title: 'Hanya Toast',
        description: 'Kartu ringkas bergaya WhatsApp di pojok kanan bawah',
        icon: MessageSquare,
    },
    {
        id: 'popup',
        title: 'Hanya Popup Window',
        description: 'Jendela detail tiket di tengah layar monitor',
        icon: Monitor,
    },
];

export const DesktopAppDownloadBanner: React.FC<DesktopAppDownloadBannerProps> = ({ 
    variant = 'compact',
    className = '',
    showAdminTools
}) => {
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAppActiveLocally, setIsAppActiveLocally] = useState<boolean | null>(null);
    const [isTestingNotification, setIsTestingNotification] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [pref, setPref] = useState(getDesktopNotifierPreference());

    // Role-based tool visibility: default to staff if user is not a regular user
    const isStaff = user?.role && user.role !== 'USER';
    const shouldShowAdminTools = showAdminTools !== undefined ? showAdminTools : Boolean(isStaff);

    const downloadUrl = `${import.meta.env.VITE_API_URL || ''}/v1/notifications/desktop-app/download`;

    // Check if SJA Notifier is running on user's local machine on mount and sync preference
    useEffect(() => {
        let isMounted = true;
        const checkLocalNotifier = async () => {
            try {
                const res = await fetch('http://127.0.0.1:18399/health', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(1500)
                });
                if (res.ok && isMounted) {
                    setIsAppActiveLocally(true);
                    const healthData = await res.json();
                    if (healthData?.defaultDisplayMode) {
                        setPref(p => ({ ...p, mode: healthData.defaultDisplayMode as DesktopDisplayMode }));
                    }
                }
            } catch {
                if (isMounted) {
                    setIsAppActiveLocally(false);
                }
            }
        };

        checkLocalNotifier();
        return () => { isMounted = false; };
    }, []);

    const handleModeSelect = async (newMode: DesktopDisplayMode) => {
        setPref(prev => ({ ...prev, mode: newMode }));
        await setDesktopNotifierPreference({ mode: newMode });
        const labels: Record<DesktopDisplayMode, string> = {
            both: 'Keduanya (Toast + Popup)',
            toast: 'Hanya Windows Toast',
            popup: 'Hanya Popup Window'
        };
        toast.success(`Preferensi Desktop: ${labels[newMode]} Disimpan`, {
            description: 'Notifikasi iDesk yang masuk akan muncul secara otomatis sesuai mode pilihan Anda.'
        });
    };

    const handleSendScenario = async (
        scenario: 'created' | 'assigned' | 'sla' | 'reply' | 'hardware',
        mode: 'both' | 'toast' | 'popup' = 'both'
    ) => {
        setIsTestingNotification(true);
        try {
            const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
            const res = await fetch(`http://127.0.0.1:18399/test?scenario=${scenario}&display=${mode}&baseUrl=${encodeURIComponent(currentOrigin)}`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });

            if (res.ok) {
                setIsAppActiveLocally(true);
                const labels: Record<string, string> = {
                    created: '1. Tiket Baru Masuk (#TKT-2026-1042)',
                    assigned: '2. Tiket Ditugaskan ke Agent (#TKT-2026-0988)',
                    sla: '3. Peringatan SLA Urgent (#TKT-2026-0955)',
                    reply: '4. Balasan Pesan Chat (#TKT-2026-1042)',
                    hardware: '5. Approval Hardware (#HW-2026-041)'
                };
                toast.success(`Notifikasi iDesk Terkirim!`, {
                    description: `${labels[scenario] || scenario} sedang tampil di monitor Anda dengan Logo Resmi iDesk & tombol tindak lanjut web.`
                });
            } else {
                throw new Error('Gagal memicu test.');
            }
        } catch {
            setIsAppActiveLocally(false);
            toast.error('SJA Notifier belum aktif di komputer Anda', {
                description: 'Pastikan aplikasi telah dibuka dan ikon SJA muncul di taskbar tray pojok kanan bawah.'
            });
        } finally {
            setIsTestingNotification(false);
        }
    };

    const handleSendQuickTest = async () => {
        await handleSendScenario('created', pref.mode);
    };

    const webhookCodeSnippet = `// Contoh integrasi dari Website Internal Santos (ERP / Kertas Kerja):
fetch('http://127.0.0.1:19876/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    app: 'Santos ERP',
    title: 'PO #1092 Menunggu Approval',
    message: 'Ada dokumen PO baru dari Dept Produksi yang memerlukan approval Anda.',
    url: 'https://erp.santos.co.id/po/1092',
    priority: 'high'
  })
});`;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(webhookCodeSnippet);
        setCopiedCode(true);
        toast.success('Kode berhasil disalin');
        setTimeout(() => setCopiedCode(false), 2000);
    };

    return (
        <>
            {/* Banner Container: Linear-style, neutral surface, crisp borders, no AI-slop gradients or blur blobs */}
            <div className={cn(
                "bg-card dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4 text-card-foreground",
                className
            )}>
                {/* Header & Primary Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Product Icon & Title */}
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 shadow-2xs">
                            <Monitor className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-none">
                                    SJA Desktop Notifier
                                </h3>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                    Windows App
                                </span>
                                {isAppActiveLocally === true && (
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Aktif di PC Ini
                                    </span>
                                )}
                                {isAppActiveLocally === false && (
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                        Belum Terhubung
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Notifikasi pop-up desktop Windows saat ada tiket baru atau pembaruan status sistem.
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsModalOpen(true)}
                            className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Panduan & Integrasi
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSendQuickTest}
                            disabled={isTestingNotification}
                            className="text-xs h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                        >
                            <Bell className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                            {isTestingNotification ? 'Mengirim...' : 'Tes Notifikasi'}
                        </Button>

                        <a 
                            href={downloadUrl}
                            download="SJANotifier-Setup.zip"
                            className="inline-flex items-center justify-center font-medium rounded-xl text-xs h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs transition-colors cursor-pointer"
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Unduh (.zip)
                        </a>
                    </div>
                </div>

                {/* Preferensi Tampilan Notifikasi Desktop */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Preferensi Tampilan Notifikasi Desktop:
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Pilih bagaimana notifikasi tiket ditampilkan di layar monitor ini
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {DISPLAY_MODES.map((item) => {
                            const Icon = item.icon;
                            const isSelected = pref.mode === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleModeSelect(item.id)}
                                    className={cn(
                                        "text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group",
                                        isSelected
                                            ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-2xs ring-1 ring-primary/20"
                                            : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={cn(
                                            "p-1.5 rounded-lg transition-colors",
                                            isSelected
                                                ? "bg-primary/15 text-primary dark:bg-primary/25"
                                                : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className={cn(
                                            "h-4 w-4 rounded-full border flex items-center justify-center transition-colors",
                                            isSelected
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-slate-300 dark:border-slate-600"
                                        )}>
                                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                        </div>
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "text-xs font-semibold leading-tight",
                                            isSelected ? "text-primary dark:text-primary-foreground font-bold" : "text-slate-800 dark:text-slate-200"
                                        )}>
                                            {item.title}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                            {item.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Bilah Diagnostik Khusus Admin & Agent */}
                {shouldShowAdminTools && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/30 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-3.5 sm:p-4 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-slate-200/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300">
                                <Terminal className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    Bilah Diagnostik SJA Notifier
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 hidden sm:inline">
                                    (Pengujian 5 Skenario Khusus Admin & Agent)
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Dropdown 5 Skenario Notifikasi iDesk */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isTestingNotification}
                                        className="text-xs h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-medium shadow-2xs gap-1.5"
                                    >
                                        <Laptop className="h-3.5 w-3.5 text-slate-500" />
                                        {isTestingNotification ? 'Mengirim...' : 'Uji 5 Skenario'}
                                        <ChevronDown className="h-3 w-3 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-80 p-1.5 shadow-xl">
                                    <DropdownMenuLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
                                        Pilih Skenario Event iDesk:
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        onClick={() => handleSendScenario('created', pref.mode)}
                                        className="text-xs flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <Inbox className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">1. Tiket Baru Masuk</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Event TICKET_CREATED (#TKT-2026-1042)</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => handleSendScenario('assigned', pref.mode)}
                                        className="text-xs flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <UserCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">2. Tiket Ditugaskan ke Agent</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Event TICKET_ASSIGNED (#TKT-2026-0988)</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => handleSendScenario('sla', pref.mode)}
                                        className="text-xs flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">3. Peringatan SLA Urgent</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Event SLA_WARNING (Sisa 15 Menit!)</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => handleSendScenario('reply', pref.mode)}
                                        className="text-xs flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <MessageSquare className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">4. Balasan Pesan Tiket</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Event TICKET_REPLY / User Chat</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                        onClick={() => handleSendScenario('hardware', pref.mode)}
                                        className="text-xs flex items-start gap-2.5 p-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <Laptop2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">5. Approval Hardware / E-Form</p>
                                            <p className="text-[11px] text-slate-500 leading-tight">Event HARDWARE_REQUEST (#HW-2026-041)</p>
                                        </div>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendScenario('assigned', pref.mode)}
                                disabled={isTestingNotification}
                                className="text-xs h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-medium shadow-2xs"
                            >
                                <UserCheck className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                Tes Terassign
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Information & Integration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                    <Laptop className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                                        SJA Desktop Notifier (Santos Jaya Abadi)
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Aplikasi Notifikasi Taskbar Tray Windows Native (WhatsApp-Style)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6 overflow-y-auto text-sm">
                            {/* Feature highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-3">
                                    <Bell className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-xs text-slate-900 dark:text-slate-100">Toast Pop-up & Suara</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Muncul di pojok kanan bawah desktop mirip pesan WhatsApp saat ada aktivitas baru.</p>
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-3">
                                    <ExternalLink className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-xs text-slate-900 dark:text-slate-100">Direct Click Redirect</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Klik notifikasi langsung membuka tiket atau URL terkait di web browser secara otomatis.</p>
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-3">
                                    <Layers className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-xs text-slate-900 dark:text-slate-100">Mode Fleksibel</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Mendukung pilihan mode Windows Toast, Popup Window detail, atau keduanya sekaligus.</p>
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-3">
                                    <Monitor className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-xs text-slate-900 dark:text-slate-100">Auto-Start Windows</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Otomatis berjalan di latar belakang taskbar tray (~15MB RAM) setiap komputer dinyalakan.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cara Instalasi */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    Cara Pasang Otomatis di Windows (1-Click Setup)
                                </h4>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                                        <p className="text-slate-700 dark:text-slate-300">
                                            Unduh file <code className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[11px]">SJANotifier-Setup.zip</code> menggunakan tombol unduh di bawah.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                                        <p className="text-slate-700 dark:text-slate-300">
                                            Ekstrak file zip, kemudian klik ganda (double-click) file <code className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded font-mono text-[11px]">install.cmd</code>.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                                        <p className="text-slate-700 dark:text-slate-300">
                                            Selesai! Ikon <span className="font-semibold text-primary">SJA</span> akan muncul di tray pojok kanan bawah dekat jam Windows dan siap menerima notifikasi.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Panduan Web Developer Santos (Internal) */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                                        <Terminal className="h-4 w-4 text-slate-500" />
                                        Integrasi Web Internal Santos (Port 19876)
                                    </h4>
                                    <button
                                        onClick={handleCopyCode}
                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                    >
                                        {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copiedCode ? 'Disalin' : 'Salin Kode'}
                                    </button>
                                </div>
                                <div className="relative rounded-xl bg-slate-900 p-3.5 text-slate-200 font-mono text-xs overflow-x-auto">
                                    <pre className="text-[11px] leading-relaxed">{webhookCodeSnippet}</pre>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendScenario('created', pref.mode)}
                                    disabled={isTestingNotification}
                                    className="text-xs h-9 border-slate-200 dark:border-slate-700"
                                >
                                    <Inbox className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                                    1. Tiket Masuk
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendScenario('assigned', pref.mode)}
                                    disabled={isTestingNotification}
                                    className="text-xs h-9 border-slate-200 dark:border-slate-700"
                                >
                                    <UserCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                    2. Terassign
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendScenario('sla', pref.mode)}
                                    disabled={isTestingNotification}
                                    className="text-xs h-9 border-slate-200 dark:border-slate-700"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
                                    3. SLA Urgent
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-xs h-9"
                                >
                                    Tutup
                                </Button>
                                <a 
                                    href={downloadUrl}
                                    download="SJANotifier-Setup.zip"
                                    className="inline-flex items-center justify-center font-medium rounded-xl text-xs h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs transition-colors cursor-pointer"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    Unduh Installer (.zip)
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
