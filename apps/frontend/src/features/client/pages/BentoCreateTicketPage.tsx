import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation, NavigateFunction } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Send,
    Paperclip,
    AlertCircle,
    Tag,
    Monitor,
    Box,
    FileText,
    Save,
    Trash2,
    Ticket,
    DollarSign,
    PackageX,
    Wifi,
    Code2,
    Smartphone,
    X,
    Maximize2,
    Download,
    FileSpreadsheet,
    FileArchive,
    File as FileIcon,
    Image as ImageIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../../stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { logger } from '@/lib/logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LostItemForm } from '@/features/ticket-board/components/LostItemForm';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import {
    MAX_ATTACHMENTS_PER_TICKET,
    formatFileSize,
    validateAttachmentFile,
} from '@/lib/file-validation';
import { PriorityHoverTip } from '@/components/ui/PriorityHoverTip';

interface TicketDraft {
    title: string;
    description: string;
    priority: string;
    category: string;
    device: string;
    software: string;
    criticalReason?: string;
    savedAt: string;
}

/** Shape returned by GET /ticket-attributes (see backend ticket-attributes.service.ts). */
interface TicketAttribute {
    id: string;
    type: string;
    value: string;
}

interface TicketAttributes {
    categories: TicketAttribute[];
    priorities: TicketAttribute[];
    devices: TicketAttribute[];
    software: TicketAttribute[];
}

const PRIORITY_OPTIONS = [
    { id: 'LOW', label: 'LOW', dot: 'bg-emerald-500', activeRing: 'ring-emerald-500/30', activeBorder: 'border-emerald-500/60', activeBg: 'bg-emerald-500/10 dark:bg-emerald-500/15', activeText: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'MEDIUM', label: 'MEDIUM', dot: 'bg-blue-500', activeRing: 'ring-blue-500/30', activeBorder: 'border-blue-500/60', activeBg: 'bg-blue-500/10 dark:bg-blue-500/15', activeText: 'text-blue-600 dark:text-blue-400' },
    { id: 'HIGH', label: 'HIGH', dot: 'bg-amber-500', activeRing: 'ring-amber-500/30', activeBorder: 'border-amber-500/60', activeBg: 'bg-amber-500/10 dark:bg-amber-500/15', activeText: 'text-amber-600 dark:text-amber-400' },
    { id: 'CRITICAL', label: 'CRITICAL', dot: 'bg-rose-500', activeRing: 'ring-rose-500/30', activeBorder: 'border-rose-500/60', activeBg: 'bg-rose-500/10 dark:bg-rose-500/15', activeText: 'text-rose-600 dark:text-rose-400' },
] as const;

type TicketType = 'none' | 'service' | 'lost-item' | 'oracle-request' | 'web-dev-request' | 'mobile-dev-request';

const TICKET_TYPES = ['none', 'service', 'lost-item', 'oracle-request', 'web-dev-request', 'mobile-dev-request'] as const satisfies readonly TicketType[];
const DRAFT_AUTOSAVE_DELAY_MS = 2_000;

const getDraftStorageKey = (type: TicketType) => `ticket-draft-${type}`;

const ORACLE_TEMPLATES = [
    { label: 'Login Issue', priority: 'MEDIUM', subject: 'Lupa Password / Gagal Login Oracle', description: 'Gagal login ke portal Oracle. Error message: ' },
    { label: 'Role Update', priority: 'MEDIUM', subject: 'Penambahan Role K2', description: 'Mohon tambahkan role [Nama Role] untuk user [Nama User] di K2.' },
    { label: 'System Error', priority: 'HIGH', subject: 'Error Transaksi Oracle', description: 'Terdapat error saat proses transaksi modul [Nama Modul]. Error detail: ' },
] as const;

const WEB_DEV_TEMPLATES = [
    { label: 'UI Bug', priority: 'HIGH', subject: 'Bug Tampilan / Antarmuka Web', description: 'Terdapat kendala tampilan pada halaman [Nama Halaman]. Detail isu: ' },
    { label: 'API Error', priority: 'HIGH', subject: 'Error Integrasi API / Backend', description: 'Gagal memuat data dari endpoint API [Nama Endpoint]. Pesan error: ' },
    { label: 'Fitur Baru', priority: 'MEDIUM', subject: 'Permintaan Fitur Baru Web', description: 'Kebutuhan fitur baru pada modul [Nama Modul]. Rincian kebutuhan: ' },
    { label: 'Slow Web', priority: 'MEDIUM', subject: 'Loading Website Lambat / Timeout', description: 'Akses ke web portal mengalami lag/timeout pada bagian [Bagian Web].' },
] as const;

const MOBILE_DEV_TEMPLATES = [
    { label: 'App Crash', priority: 'CRITICAL', subject: 'Aplikasi Mobile Force Close / Crash', description: 'Aplikasi mobile mengalami crash saat membuka [Menu/Fitur]. Perangkat & OS: ' },
    { label: 'Release Issue', priority: 'HIGH', subject: 'Kendala Rilis / Update APK', description: 'Gagal melakukan instalasi atau update APK versi [Nomor Versi].' },
    { label: 'Sync Error', priority: 'HIGH', subject: 'Gagal Sinkronisasi Data Mobile', description: 'Data pada aplikasi mobile tidak tersinkron ke server pada modul [Nama Modul].' },
    { label: 'Push Notif', priority: 'MEDIUM', subject: 'Push Notification Tidak Masuk', description: 'Notifikasi tidak muncul pada device pengguna saat trigger [Nama Event].' },
] as const;

const QUICK_TEMPLATES = [
    { label: 'Email Issue', category: 'SOFTWARE', priority: 'HIGH', subject: 'Email tidak bisa diakses', description: 'Tidak dapat mengirim atau menerima email. Error message: ' },
    { label: 'Printer Fault', category: 'HARDWARE', priority: 'MEDIUM', subject: 'Printer rusak / tidak merespon', description: 'Printer tidak merespon saat print. Sudah direstart. Model printer: ' },
    { label: 'Slow System', category: 'HARDWARE', priority: 'LOW', subject: 'Komputer lemot', description: 'PC/Laptop sangat lambat saat membuka aplikasi. Area timbul keluhan: ' },
    { label: 'No Network', category: 'NETWORK', priority: 'HIGH', subject: 'Koneksi internet bermasalah', description: 'Tidak ada koneksi WiFi maupun LAN. Area/Lantai: ' },
    { label: 'Software Error', category: 'SOFTWARE', priority: 'CRITICAL', subject: 'Error sistem saat input data', description: 'Proses berhenti karena error. Nama sistem: ' },
    { label: 'Login Issue', category: 'GENERAL', priority: 'MEDIUM', subject: 'Password terkunci', description: 'Gagal login berkali-kali. Mohon dibantu reset. Username: ' },
] as const;

function getInitialTicketType(value: string | null): TicketType {
    return value && TICKET_TYPES.includes(value as TicketType) ? value as TicketType : 'none';
}

interface TicketTypeCardActionArgs {
    setTicketType: (type: TicketType) => void;
    navigate: NavigateFunction;
    getBasePath: () => string;
}

const TICKET_TYPE_CARDS: Array<{
    key: string;
    pageKey?: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof Ticket;
    action: (args: TicketTypeCardActionArgs) => void;
}> = [
    {
        key: 'service',
        pageKey: 'tickets',
        eyebrow: 'General Support',
        title: 'Service Ticket',
        description: 'Laporkan masalah hardware, software, jaringan, atau kebutuhan IT support umum lainnya.',
        icon: Ticket,
        action: ({ setTicketType }) => setTicketType('service'),
    },
    {
        key: 'hardware-budget',
        pageKey: 'hardware_requests',
        eyebrow: 'Procurement',
        title: 'Hardware & Budget',
        description: 'Ajukan pembelian barang IT baru.',
        icon: DollarSign,
        action: ({ navigate, getBasePath }) => navigate(`${getBasePath()}/hardware-requests`),
    },
    {
        key: 'lost-item',
        pageKey: 'lost_items',
        eyebrow: 'Asset',
        title: 'Lost Item Report',
        description: 'Laporkan laptop, HP, ID card, kunci, atau barang hilang lainnya.',
        icon: PackageX,
        action: ({ setTicketType }) => setTicketType('lost-item'),
    },
    {
        key: 'access-request',
        pageKey: 'eform_access',
        eyebrow: 'Network',
        title: 'Access Request',
        description: 'Minta akses WiFi, VPN, atau website dengan form approval.',
        icon: Wifi,
        action: ({ navigate, getBasePath }) => navigate(`${getBasePath()}/eform-access/new`),
    },
    {
        key: 'oracle-request',
        eyebrow: 'Enterprise System',
        title: 'Oracle / K2 Request',
        description: 'Bantuan sistem Oracle, update role K2, atau isu ERP.',
        icon: Box,
        action: ({ setTicketType }) => setTicketType('oracle-request'),
    },
    {
        key: 'web-dev-request',
        eyebrow: 'Web System',
        title: 'Web Developer Request',
        description: 'Permintaan bug fix, fitur baru, atau integrasi web portal.',
        icon: Code2,
        action: ({ setTicketType }) => setTicketType('web-dev-request'),
    },
    {
        key: 'mobile-dev-request',
        eyebrow: 'Mobile App',
        title: 'Mobile Developer Request',
        description: 'Permintaan perbaikan crash, update APK, atau fitur app mobile.',
        icon: Smartphone,
        action: ({ setTicketType }) => setTicketType('mobile-dev-request'),
    },
];

const TicketTypeCard: React.FC<{
    card: typeof TICKET_TYPE_CARDS[number];
    index: number;
    className?: string;
    style?: React.CSSProperties;
} & TicketTypeCardActionArgs> = ({ card, index, className = '', style, setTicketType, navigate, getBasePath }) => (
    <div style={style} className={`p-px rounded-[1.4rem] bg-gradient-to-br from-primary/25 via-border to-accent/20 dark:from-primary/30 dark:via-border dark:to-accent/20 ${className}`}>
        <button
            type="button"
            onClick={() => card.action({ setTicketType, navigate, getBasePath })}
            aria-label={`Pilih ${card.title}`}
            className="group relative flex flex-col justify-between w-full min-h-[44px] h-full overflow-hidden rounded-[calc(1.4rem-1px)] bg-card p-6 text-left shadow-xs ring-1 ring-black/[0.02] dark:ring-white/[0.02] transition-all duration-300 motion-reduce:transition-none ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 motion-reduce:transform-none active:scale-[0.98] active:duration-100 cursor-pointer"
        >
            <span className="absolute top-5 right-6 font-mono text-xs tracking-widest text-primary/25 dark:text-primary/30 select-none">
                {String(index + 1).padStart(2, '0')}
            </span>

            <div>
                <div className="w-[3.25rem] h-[3.25rem] rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-primary group-hover:ring-primary">
                    <card.icon className="w-6 h-6 text-primary transition-colors duration-300 group-hover:text-primary-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary mb-1.5">{card.eyebrow}</p>
                <h2 className="text-lg font-bold text-foreground mb-2 tracking-tight">{card.title}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.description}
                </p>
            </div>

            <div className="flex items-center gap-1.5 mt-6 text-xs font-semibold text-primary opacity-0 -translate-x-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-hover:translate-x-0">
                Pilih
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5">
                    <ArrowLeft className="w-3 h-3 rotate-180" aria-hidden="true" />
                </span>
            </div>
        </button>
    </div>
);

export const BentoCreateTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data: myPermissions } = useMyPermissions();
    const [isLoading, setIsLoading] = useState(false);

    const initialType = getInitialTicketType(searchParams.get('type'));
    const [ticketType, setTicketType] = useState<TicketType>(initialType);

    const [attributes, setAttributes] = useState<TicketAttributes>({ categories: [], priorities: [], devices: [], software: [] });
    const [attributesError, setAttributesError] = useState(false);
    const [showAddModal, setShowAddModal] = useState<{ type: string; show: boolean }>({ type: '', show: false });
    const [newAttributeValue, setNewAttributeValue] = useState('');
    const [isAddingAttribute, setIsAddingAttribute] = useState(false);
    const addModalRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        category: '',
        device: '',
        software: '',
        criticalReason: '',
    });

    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
    const titleRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);

    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [lightboxItem, setLightboxItem] = useState<{ url: string; name: string; size: number; index: number } | null>(null);

    // Object URL Map for image previews (cleaned up on file removal / unmount)
    const filePreviewMap = useMemo(() => {
        const map = new Map<File, string>();
        files.forEach((file) => {
            if (file.type.startsWith('image/')) {
                map.set(file, URL.createObjectURL(file));
            }
        });
        return map;
    }, [files]);

    useEffect(() => {
        return () => {
            filePreviewMap.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [filePreviewMap]);

    const validateTitle = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.length > 0 && trimmed.length < 5) {
            return 'Judul tiket minimal 5 karakter';
        }
        return undefined;
    };

    const validateDescription = (val: string) => {
        const trimmed = val.trim();
        if (trimmed.length > 0 && trimmed.length < 10) {
            return 'Deskripsi tiket minimal 10 karakter';
        }
        return undefined;
    };

    const [hasDraft, setHasDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync ticketType with URL searchParams if it changes
    useEffect(() => {
        const typeFromUrl = getInitialTicketType(searchParams.get('type'));
        if (typeFromUrl !== ticketType) {
            setTicketType(typeFromUrl);
        }
    }, [searchParams]);

    // Load type-scoped draft whenever ticketType changes
    useEffect(() => {
        if (ticketType === 'none' || ticketType === 'lost-item') {
            setHasDraft(false);
            setLastSaved(null);
            setSelectedTemplate(null);
            return;
        }

        const draftKey = getDraftStorageKey(ticketType);
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draft: TicketDraft = JSON.parse(savedDraft);
                setFormData({
                    title: draft.title || '',
                    description: draft.description || '',
                    priority: draft.priority || 'MEDIUM',
                    category: draft.category || '',
                    device: draft.device || '',
                    software: draft.software || '',
                    criticalReason: draft.criticalReason || '',
                });
                setLastSaved(new Date(draft.savedAt));
                setHasDraft(true);
            } else {
                setFormData({
                    title: '',
                    description: '',
                    priority: 'MEDIUM',
                    category: '',
                    device: '',
                    software: '',
                    criticalReason: '',
                });
                setHasDraft(false);
                setLastSaved(null);
            }
        } catch (error) {
            logger.error('Failed to load scoped draft:', error);
        }
        setErrors({});
        setSelectedTemplate(null);
    }, [ticketType]);

    // Auto-save draft per ticket type (debounced)
    const saveDraft = useCallback(() => {
        if (ticketType === 'none' || ticketType === 'lost-item') return;
        if (!formData.title.trim() && !formData.description.trim()) {
            return;
        }

        const draftKey = getDraftStorageKey(ticketType);
        try {
            const draft: TicketDraft = {
                ...formData,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(draftKey, JSON.stringify(draft));
            setLastSaved(new Date());
            setHasDraft(true);
        } catch (error) {
            logger.error('Failed to save scoped draft:', error);
        }
    }, [formData, ticketType]);

    useEffect(() => {
        if (ticketType === 'none' || ticketType === 'lost-item') return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            saveDraft();
        }, DRAFT_AUTOSAVE_DELAY_MS);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [formData, saveDraft, ticketType]);

    const clearDraft = useCallback(() => {
        if (ticketType === 'none' || ticketType === 'lost-item') return;
        const draftKey = getDraftStorageKey(ticketType);
        let snapshot: TicketDraft | null = null;
        try {
            const raw = localStorage.getItem(draftKey);
            if (raw) snapshot = JSON.parse(raw) as TicketDraft;
        } catch { /* ignore */ }

        try {
            localStorage.removeItem(draftKey);
            setHasDraft(false);
            setLastSaved(null);
            setSelectedTemplate(null);
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                category: '',
                device: '',
                software: '',
                criticalReason: '',
            });
            setErrors({});
            toast.success('Draft dibersihkan', snapshot ? {
                description: 'Draft formulir berhasil dihapus.',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        if (!snapshot) return;
                        try {
                            localStorage.setItem(draftKey, JSON.stringify(snapshot));
                            setFormData({
                                title: snapshot.title || '',
                                description: snapshot.description || '',
                                priority: snapshot.priority || 'MEDIUM',
                                category: snapshot.category || '',
                                device: snapshot.device || '',
                                software: snapshot.software || '',
                                criticalReason: snapshot.criticalReason || '',
                            });
                            setLastSaved(snapshot.savedAt ? new Date(snapshot.savedAt) : new Date());
                            setHasDraft(true);
                            toast.success('Draft dipulihkan');
                        } catch (e) { logger.error('Failed to restore draft:', e); }
                    },
                },
            } : undefined);
        } catch (error) {
            logger.error('Failed to clear draft:', error);
        }
    }, [ticketType]);

    const fetchAttributes = async () => {
        try {
            const res = await api.get('/ticket-attributes');
            setAttributes({
                categories: res.data?.categories ?? [],
                priorities: res.data?.priorities ?? [],
                devices: res.data?.devices ?? [],
                software: res.data?.software ?? [],
            });
            setAttributesError(false);
        } catch (error) {
            logger.error('Failed to fetch attributes:', error);
            setAttributesError(true);
        }
    };

    useEffect(() => {
        fetchAttributes();
    }, []);

    const handleCloseAddModal = useCallback(() => {
        setShowAddModal({ type: '', show: false });
        setNewAttributeValue('');
    }, []);

    useFocusTrap(addModalRef, { enabled: showAddModal.show, onEscape: handleCloseAddModal });

    useEffect(() => {
        if (!showAddModal.show && !lightboxItem) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [showAddModal.show, lightboxItem]);

    const handleAddAttribute = async () => {
        if (!newAttributeValue.trim() || isAddingAttribute) return;
        setIsAddingAttribute(true);
        try {
            await api.post('/ticket-attributes', { type: showAddModal.type, value: newAttributeValue.trim() });
            toast.success('Attribute added successfully');
            setNewAttributeValue('');
            setShowAddModal({ type: '', show: false });
            fetchAttributes();
        } catch (error: any) {
            logger.error('Failed to add attribute:', error);
            toast.error(error.response?.data?.message || 'Failed to add attribute');
        } finally {
            setIsAddingAttribute(false);
        }
    };

    // Robust file addition helper (shared by input, paste, and drag-and-drop)
    const addFiles = useCallback((picked: File[]) => {
        if (!picked || picked.length === 0) return;

        const accepted: File[] = [];
        for (const file of picked) {
            if (files.length + accepted.length >= MAX_ATTACHMENTS_PER_TICKET) {
                toast.error(`Maksimal ${MAX_ATTACHMENTS_PER_TICKET} lampiran`);
                break;
            }
            const isDuplicate = [...files, ...accepted].some(
                (f) => f.name === file.name && f.size === file.size,
            );
            if (isDuplicate) continue;

            const result = validateAttachmentFile(file);
            if (!result.valid) {
                toast.error(`${file.name}: ${result.error}`);
                continue;
            }
            accepted.push(file);
        }

        if (accepted.length > 0) {
            setFiles((prev) => [...prev, ...accepted]);
        }
    }, [files]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';
        addFiles(picked);
    };

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
        if (lightboxItem && lightboxItem.index === index) {
            setLightboxItem(null);
        }
    };

    // Paste handler for clipboard screenshot / images
    const handlePaste = (e: React.ClipboardEvent) => {
        const clipboardFiles = Array.from(e.clipboardData?.files || []);
        if (clipboardFiles.length > 0) {
            addFiles(clipboardFiles);
            toast.success(`${clipboardFiles.length} file gambar ditempel dari clipboard`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (ticketType === 'service' || ticketType === 'oracle-request' || ticketType === 'web-dev-request' || ticketType === 'mobile-dev-request') {
            const titleErr = validateTitle(formData.title) || (formData.title.trim().length === 0 ? 'Judul tiket wajib diisi (minimal 5 karakter)' : undefined);
            const descErr = validateDescription(formData.description) || (formData.description.trim().length === 0 ? 'Deskripsi tiket wajib diisi (minimal 10 karakter)' : undefined);

            if (titleErr || descErr) {
                setErrors({ title: titleErr, description: descErr });
                toast.error(titleErr || descErr || 'Mohon lengkapi formulir sesuai ketentuan minimal karakter.');
                (titleErr ? titleRef : descriptionRef).current?.focus();
                return;
            }
        }

        setIsLoading(true);
        try {
            const formDataToSend = new FormData();

            if (ticketType === 'oracle-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'ORACLE_REQUEST');
                formDataToSend.append('ticketType', 'ORACLE_REQUEST');
            } else if (ticketType === 'web-dev-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'WEB_DEV_REQUEST');
                formDataToSend.append('ticketType', 'WEB_DEV_REQUEST');
            } else if (ticketType === 'mobile-dev-request') {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority || 'MEDIUM');
                formDataToSend.append('category', 'MOBILE_DEV_REQUEST');
                formDataToSend.append('ticketType', 'MOBILE_DEV_REQUEST');
            } else {
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority);
                formDataToSend.append('category', formData.category);
                if (formData.device) formDataToSend.append('device', formData.device);
                if (formData.software) formDataToSend.append('software', formData.software);
            }

            if (formData.priority === 'CRITICAL' && formData.criticalReason) {
                formDataToSend.append('criticalReason', formData.criticalReason);
            }

            files.forEach((file) => {
                formDataToSend.append('files', file);
            });

            const createRes = await api.post('/tickets', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const createdTicketId = createRes?.data?.id;

            // Clear draft for this specific ticket type
            if (ticketType !== 'none' && ticketType !== 'lost-item') {
                localStorage.removeItem(getDraftStorageKey(ticketType));
                setHasDraft(false);
                setLastSaved(null);
            }

            toast.success('Tiket berhasil dibuat!');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

            if (ticketType === 'oracle-request') {
                if (user?.role === 'ADMIN' || user?.role === 'AGENT_ORACLE') {
                    navigate('/tickets/oracle-k2');
                } else {
                    navigate('/client/my-tickets');
                }
            } else if (ticketType === 'web-dev-request') {
                if (user?.role === 'ADMIN' || user?.role === 'AGENT_ORACLE') {
                    navigate('/tickets/web-developer');
                } else {
                    navigate('/client/my-tickets');
                }
            } else if (ticketType === 'mobile-dev-request') {
                if (user?.role === 'ADMIN' || user?.role === 'AGENT_ORACLE') {
                    navigate('/tickets/mobile-developer');
                } else {
                    navigate('/client/my-tickets');
                }
            } else if (user?.role === 'AGENT_ORACLE') {
                navigate('/tickets/oracle-k2');
            } else if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                navigate(createdTicketId ? `/tickets/${createdTicketId}` : '/tickets/list');
            } else {
                navigate(createdTicketId ? `/client/tickets/${createdTicketId}` : '/client/my-tickets');
            }
        } catch (error: any) {
            logger.error('Failed to create ticket:', error);
            const serverMsg = error.response?.data?.message;
            if (Array.isArray(serverMsg)) {
                toast.error(`Gagal membuat tiket: ${serverMsg.join(', ')}`);
            } else if (typeof serverMsg === 'string') {
                toast.error(`Gagal membuat tiket: ${serverMsg}`);
            } else {
                toast.error('Gagal membuat tiket. Silakan periksa kembali formulir Anda.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const canAccessPage = useCallback((pageKey?: string): boolean => {
        if (!pageKey) return true;
        if (user?.role === 'ADMIN') return true;

        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_OPERATIONAL_SUPPORT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_ADMIN: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_ORACLE: ['oracle_k2_tickets', 'web_dev_tickets', 'notifications'],
            AGENT_WEB_DEV: ['web_dev_tickets', 'oracle_k2_tickets', 'mobile_dev_tickets', 'notifications'],
            AGENT_MOBILE_DEV: ['mobile_dev_tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'notifications'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads'],
            ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'settings'],
        };

        const userRole = (user?.role || 'USER') as string;
        return (roleDefaults[userRole] || roleDefaults['USER']).includes(pageKey);
    }, [user?.role, myPermissions?.pageAccess]);

    useEffect(() => {
        if (ticketType === 'lost-item' && !canAccessPage('lost_items')) {
            toast.error('Anda tidak memiliki akses ke halaman Lost Items');
            setTicketType('none');
        }
    }, [ticketType, canAccessPage]);

    const handleBack = useCallback(() => {
        const hasDirtyForm = Boolean(formData.title.trim() || formData.description.trim() || formData.category || formData.device || formData.software || formData.criticalReason || files.length > 0);
        if (ticketType !== 'none' && hasDirtyForm) {
            const ok = window.confirm('Perubahan belum disimpan. Yakin ingin kembali? Draft akan tetap tersimpan.');
            if (!ok) return;
        }
        if (ticketType !== 'none') {
            setTicketType('none');
        } else {
            navigate(-1);
        }
    }, [ticketType, formData.title, formData.description, formData.category, formData.device, formData.software, formData.criticalReason, files.length, navigate]);

    // Template selection helper
    const handleTemplateClick = (template: { label: string; subject: string; description: string; priority: string; category?: string }) => {
        if (selectedTemplate === template.label) {
            setSelectedTemplate(null);
        } else {
            setSelectedTemplate(template.label);
            setFormData(prev => ({
                ...prev,
                title: template.subject,
                description: template.description,
                priority: template.priority,
                ...(template.category ? { category: template.category } : {}),
            }));
            setErrors({});
        }
    };

    // Shared Header Component
    const renderFormHeader = (icon: React.ReactNode, title: string, subtitle: string, iconBgClass: string) => (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <div className="flex items-center gap-3.5">
                <button
                    type="button"
                    onClick={handleBack}
                    aria-label="Kembali ke pilihan jenis tiket"
                    className="p-2.5 rounded-xl bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2.5 rounded-xl shadow-2xs border", iconBgClass)}>
                        {icon}
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">{subtitle}</p>
                    </div>
                </div>
            </div>

            {hasDraft && (
                <div aria-live="polite" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Auto-saved{lastSaved ? ` (${lastSaved.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}</span>
                    <button
                        type="button"
                        onClick={clearDraft}
                        className="ml-1 p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                        title="Hapus Draft"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );

    // Clean Priority Selector Component without duration / SLA
    const renderPrioritySelector = (legendClass = "text-primary") => (
        <fieldset className="border-0 p-0 m-0">
            <legend className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className={cn("w-3.5 h-3.5", legendClass)} aria-hidden="true" />
                <span>Issue Urgency / Prioritas</span>
            </legend>
            <div role="radiogroup" aria-label="Issue urgency" className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/80 shadow-2xs">
                {PRIORITY_OPTIONS.map((p) => {
                    const isSelected = formData.priority === p.id;
                    return (
                        <PriorityHoverTip key={p.id} priority={p.id} side="top">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={p.label}
                                onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                                    isSelected
                                        ? `${p.activeBg} ${p.activeBorder} ${p.activeText} shadow-xs ring-2 ${p.activeRing}`
                                        : "bg-card border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                )}
                            >
                                <span className={cn("w-2.5 h-2.5 rounded-full", p.dot, isSelected && "animate-pulse")} />
                                <span className="tracking-wider">{p.label}</span>
                            </button>
                        </PriorityHoverTip>
                    );
                })}
            </div>
        </fieldset>
    );

    // File icon helper for non-image files
    const renderFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />;
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />;
        return <FileIcon className="w-4 h-4 text-primary shrink-0" />;
    };

    // Integrated Rich Composer for Description / Detail Field
    const renderRichDescriptionComposer = (
        id: string,
        placeholder: string,
        accentBorderFocus: string,
        iconColor: string
    ) => {
        return (
            <div>
                <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor={id} className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                        <FileText className={cn("w-3.5 h-3.5", iconColor)} aria-hidden="true" />
                        <span>Detail Masalah / Kebutuhan <span className="text-rose-500">*</span></span>
                    </label>
                    <span className={cn(
                        "text-[11px] font-mono font-medium",
                        formData.description.trim().length === 0
                            ? "text-muted-foreground"
                            : formData.description.trim().length < 10
                            ? "text-rose-500 font-bold"
                            : "text-emerald-600 dark:text-emerald-400 font-semibold"
                    )}>
                        {formData.description.trim().length < 10 && formData.description.trim().length > 0
                            ? `Kurang ${10 - formData.description.trim().length} karakter (min. 10)`
                            : `${formData.description.length} / 5000 karakter`}
                    </span>
                </div>

                {/* Composer Card Container with Drag & Drop */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const droppedFiles = Array.from(e.dataTransfer.files || []);
                        addFiles(droppedFiles);
                    }}
                    className={cn(
                        "relative flex flex-col bg-background border rounded-2xl transition-all shadow-2xs overflow-hidden",
                        isDraggingOver && "border-primary ring-4 ring-primary/15 bg-primary/5",
                        errors.description
                            ? "border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/10 focus-within:border-rose-500"
                            : `border-border/90 ${accentBorderFocus}`
                    )}
                >
                    {/* Textarea Area */}
                    <textarea
                        id={id}
                        ref={descriptionRef}
                        required
                        maxLength={5000}
                        value={formData.description}
                        onPaste={handlePaste}
                        onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, description: val }));
                            setErrors(prev => ({ ...prev, description: validateDescription(val) }));
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.max(120, e.target.scrollHeight) + 'px';
                        }}
                        className="w-full px-4 pt-3.5 pb-2 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[120px] leading-relaxed"
                        placeholder={placeholder}
                    />

                    {/* In-Composer Attachment Preview Tray */}
                    {files.length > 0 && (
                        <div className="px-4 py-2.5 bg-muted/25 border-t border-border/70 flex flex-wrap gap-2.5 items-center">
                            {files.map((file, index) => {
                                const previewUrl = filePreviewMap.get(file);
                                const isImage = Boolean(previewUrl);

                                if (isImage && previewUrl) {
                                    return (
                                        <div
                                            key={`${file.name}-${file.size}-${index}`}
                                            className="group relative w-20 h-20 rounded-xl border border-border/90 bg-card overflow-hidden shadow-2xs transition-all hover:ring-2 hover:ring-primary/40"
                                        >
                                            <img
                                                src={previewUrl}
                                                alt={file.name}
                                                className="w-full h-full object-cover cursor-pointer"
                                                onClick={() => setLightboxItem({ url: previewUrl, name: file.name, size: file.size, index })}
                                            />
                                            {/* Hover Overlay Zoom */}
                                            <button
                                                type="button"
                                                onClick={() => setLightboxItem({ url: previewUrl, name: file.name, size: file.size, index })}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                                                title="Lihat preview gambar"
                                            >
                                                <Maximize2 className="w-4 h-4 drop-shadow" />
                                            </button>
                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                                                title="Hapus gambar"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={`${file.name}-${file.size}-${index}`}
                                        className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-card border border-border/90 rounded-xl text-xs font-medium text-foreground shadow-2xs"
                                    >
                                        {renderFileIcon(file.name)}
                                        <span className="truncate max-w-[150px]" title={file.name}>{file.name}</span>
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">{formatFileSize(file.size)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(index)}
                                            className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                            title="Hapus file"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Composer Bottom Toolbar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-t border-border/80 text-xs">
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border/80 text-foreground font-semibold transition-all hover:border-primary/40 cursor-pointer shadow-2xs active:scale-95"
                                title="Lampirkan File / Screenshot"
                            >
                                <Paperclip className="w-3.5 h-3.5 text-primary" />
                                <span>Lampirkan</span>
                                {files.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                        {files.length}
                                    </span>
                                )}
                            </button>

                            <span className="hidden sm:inline-block text-[11px] text-muted-foreground">
                                Tempel gambar (<kbd className="px-1 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Ctrl+V</kbd>) atau seret file ke sini
                            </span>
                        </div>

                        <span className="text-[11px] text-muted-foreground font-medium">
                            Maks. {MAX_ATTACHMENTS_PER_TICKET} file (10MB/file)
                        </span>
                    </div>
                </div>

                {errors.description && (
                    <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.description}</span>
                    </p>
                )}
            </div>
        );
    };

    // Shared Submit & Critical Reason Region Component
    const renderSubmitActionBar = (submitBtnClass: string, submitLabel: string) => (
        <div className="space-y-4 pt-1">
            {/* Critical Reason Justification Field */}
            {formData.priority === 'CRITICAL' && (
                <div className="bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl p-4 border border-rose-200/80 dark:border-rose-800/40 animate-in fade-in zoom-in-95 duration-200 space-y-2">
                    <label htmlFor="critical-reason" className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Justifikasi Tiket Critical <span className="text-rose-500">*</span></span>
                    </label>
                    <textarea
                        id="critical-reason"
                        required
                        rows={2}
                        value={formData.criticalReason}
                        onChange={(e) => setFormData(prev => ({ ...prev, criticalReason: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-background border border-rose-300 dark:border-rose-700/60 rounded-xl text-sm font-medium focus:ring-4 focus:ring-rose-500/15 outline-none resize-none placeholder:text-muted-foreground/60 min-h-[70px]"
                        placeholder="Jelaskan mengapa masalah ini mendesak / berdampak luas bagi operasional..."
                    />
                </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/70">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>Pintasan:</span>
                    <kbd className="px-2 py-0.5 bg-muted rounded border border-border font-mono text-[11px] font-semibold text-foreground">Ctrl + Enter</kbd>
                    <span>untuk kirim langsung</span>
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !formData.title.trim() || !formData.description.trim() || (formData.priority === 'CRITICAL' && !formData.criticalReason?.trim())}
                    className={cn(
                        "w-full sm:w-auto min-w-[180px] h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                        submitBtnClass
                    )}
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Mengirim...</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{submitLabel}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    // ==========================================
    // 1. TICKET TYPE SELECTION SCREEN (none)
    // ==========================================
    if (ticketType === 'none') {
        const getBasePath = () => location.pathname.startsWith('/client') ? '/client' : location.pathname.startsWith('/manager') ? '/manager' : '';
        const visibleCards = TICKET_TYPE_CARDS.filter(card => canAccessPage(card.pageKey));
        const getCardGridClass = (_cardIndex: number, totalCards: number) => {
            if (totalCards === 1) return 'sm:col-span-1 max-w-md mx-auto';
            return 'sm:col-span-1';
        };

        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-8 lg:space-y-10 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Kembali"
                        className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-xs cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-0.5">New Request</p>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Buat Tiket Baru</h1>
                        <p className="text-muted-foreground text-sm">Pilih jenis kebutuhan Anda di bawah ini</p>
                    </div>
                </div>

                {/* Ticket Type Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visibleCards.map((card, idx) => (
                        <TicketTypeCard
                            key={card.key}
                            card={card}
                            index={idx}
                            setTicketType={setTicketType}
                            navigate={navigate}
                            getBasePath={getBasePath}
                            className={`animate-in fade-in slide-in-from-bottom-3 fill-mode-both ${getCardGridClass(idx, visibleCards.length)}`}
                            style={{ animationDelay: `${idx * 60}ms`, animationDuration: '500ms' }}
                        />
                    ))}
                </div>

                {/* Info Guidance Strip */}
                <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent p-5 flex gap-4 items-center">
                    <div className="p-2.5 bg-card rounded-xl text-primary shadow-xs ring-1 ring-primary/10 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">Pilih jenis tiket yang paling sesuai</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Tiap jenis tiket masuk ke antrean tim penanganan yang spesifik. Jika Anda membutuhkan bantuan IT kantor umum, pilih <span className="font-semibold text-foreground">Service Ticket</span>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // 2. LOST ITEM REPORT FORM
    // ==========================================
    if (ticketType === 'lost-item') {
        const handleLostItemSubmit = async (data: any) => {
            setIsLoading(true);
            try {
                await api.post('/lost-item', data);
                toast.success('Laporan barang hilang berhasil dikirim!');
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
                if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                    navigate('/tickets/list');
                } else {
                    navigate('/client/my-tickets');
                }
            } catch (error: any) {
                logger.error('Failed to submit lost item report:', error);
                toast.error(error.response?.data?.message || 'Gagal mengirim laporan');
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div className="w-full max-w-7xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Kembali ke pilihan jenis tiket"
                        className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-lg">
                            <PackageX className="w-4 h-4 text-red-600" />
                        </div>
                        Lost Item Report
                    </h1>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
                    <LostItemForm
                        onSubmit={handleLostItemSubmit}
                        onCancel={handleBack}
                    />
                </div>
            </div>
        );
    }

    // ==========================================
    // 3. ORACLE / K2 REQUEST FORM
    // ==========================================
    if (ticketType === 'oracle-request') {
        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
                {renderFormHeader(
                    <Box className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
                    "Oracle / K2 Request",
                    "Enterprise System Support (ERP, Database & K2 Workflow)",
                    "bg-cyan-500/10 border-cyan-500/20"
                )}

                {/* Quick Templates */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-cyan-500" /> Template Cepat
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        {ORACLE_TEMPLATES.map((tpl) => {
                            const isSelected = selectedTemplate === tpl.label;
                            return (
                                <button
                                    key={tpl.label}
                                    type="button"
                                    onClick={() => handleTemplateClick(tpl)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/20"
                                            : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-cyan-500/40"
                                    )}
                                >
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                                    <span>{tpl.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
                    className="bg-card rounded-2xl border border-border/80 p-5 md:p-8 shadow-sm space-y-6"
                >
                    {Object.keys(errors).length > 0 && (
                        <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                        </div>
                    )}

                    {/* Subject / Title */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label htmlFor="oracle-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                                <FileText className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
                                <span>Subject / Judul Tiket <span className="text-rose-500">*</span></span>
                            </label>
                            <span className={cn(
                                "text-[11px] font-mono font-medium",
                                formData.title.trim().length === 0
                                    ? "text-muted-foreground"
                                    : formData.title.trim().length < 5
                                    ? "text-rose-500 font-bold"
                                    : "text-emerald-600 dark:text-emerald-400 font-semibold"
                            )}>
                                {formData.title.trim().length < 5 && formData.title.trim().length > 0
                                    ? `Kurang ${5 - formData.title.trim().length} karakter (min. 5)`
                                    : `${formData.title.length} / 200 karakter`}
                            </span>
                        </div>
                        <input
                            id="oracle-ticket-title"
                            ref={titleRef}
                            type="text"
                            required
                            maxLength={200}
                            value={formData.title}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, title: val }));
                                setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                            }}
                            className={cn(
                                "w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60 transition-all shadow-2xs",
                                errors.title
                                    ? "border-rose-500 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
                                    : "border-border/90 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                            )}
                            placeholder="Contoh: Lupa Password Oracle, Penambahan Role K2, Error Validasi AP..."
                        />
                        {errors.title && (
                            <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{errors.title}</span>
                            </p>
                        )}
                    </div>

                    {/* Integrated Rich Composer */}
                    {renderRichDescriptionComposer(
                        "oracle-ticket-description",
                        "Tuliskan secara lengkap pesan error, nama modul, username user, atau detail form K2 yang membutuhkan update...",
                        "focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10",
                        "text-cyan-500"
                    )}

                    {/* Priority Selector */}
                    {renderPrioritySelector("text-cyan-500")}

                    {/* Submit Action */}
                    {renderSubmitActionBar(
                        "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-cyan-600/20",
                        "Kirim Tiket Oracle"
                    )}
                </form>

                {/* Lightbox Modal */}
                {lightboxItem && (
                    <LightboxModal
                        item={lightboxItem}
                        onClose={() => setLightboxItem(null)}
                        onDelete={() => handleRemoveFile(lightboxItem.index)}
                    />
                )}
            </div>
        );
    }

    // ==========================================
    // 4. WEB DEVELOPER REQUEST FORM
    // ==========================================
    if (ticketType === 'web-dev-request') {
        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
                {renderFormHeader(
                    <Code2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
                    "Web Developer Request",
                    "Web Applications & Portal Development Support",
                    "bg-blue-500/10 border-blue-500/20"
                )}

                {/* Quick Templates */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-500" /> Template Cepat
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        {WEB_DEV_TEMPLATES.map((tpl) => {
                            const isSelected = selectedTemplate === tpl.label;
                            return (
                                <button
                                    key={tpl.label}
                                    type="button"
                                    onClick={() => handleTemplateClick(tpl)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20"
                                            : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-blue-500/40"
                                    )}
                                >
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                    <span>{tpl.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
                    className="bg-card rounded-2xl border border-border/80 p-5 md:p-8 shadow-sm space-y-6"
                >
                    {Object.keys(errors).length > 0 && (
                        <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                        </div>
                    )}

                    {/* Subject / Title */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label htmlFor="web-dev-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                                <FileText className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
                                <span>Subject / Judul Tiket <span className="text-rose-500">*</span></span>
                            </label>
                            <span className={cn(
                                "text-[11px] font-mono font-medium",
                                formData.title.trim().length === 0
                                    ? "text-muted-foreground"
                                    : formData.title.trim().length < 5
                                    ? "text-rose-500 font-bold"
                                    : "text-emerald-600 dark:text-emerald-400 font-semibold"
                            )}>
                                {formData.title.trim().length < 5 && formData.title.trim().length > 0
                                    ? `Kurang ${5 - formData.title.trim().length} karakter (min. 5)`
                                    : `${formData.title.length} / 200 karakter`}
                            </span>
                        </div>
                        <input
                            id="web-dev-ticket-title"
                            ref={titleRef}
                            type="text"
                            required
                            maxLength={200}
                            value={formData.title}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, title: val }));
                                setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                            }}
                            className={cn(
                                "w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60 transition-all shadow-2xs",
                                errors.title
                                    ? "border-rose-500 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
                                    : "border-border/90 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            )}
                            placeholder="Contoh: Bug Tombol Submit, Error API Endpoint, Permintaan Halaman Baru..."
                        />
                        {errors.title && (
                            <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{errors.title}</span>
                            </p>
                        )}
                    </div>

                    {/* Integrated Rich Composer */}
                    {renderRichDescriptionComposer(
                        "web-dev-ticket-description",
                        "Jelaskan URL/halaman web, langkah reproduksi error, console log jika ada, atau spesifikasi fitur yang diinginkan...",
                        "focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10",
                        "text-blue-500"
                    )}

                    {/* Priority Selector */}
                    {renderPrioritySelector("text-blue-500")}

                    {/* Submit Action */}
                    {renderSubmitActionBar(
                        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/20",
                        "Kirim Tiket Web Dev"
                    )}
                </form>

                {/* Lightbox Modal */}
                {lightboxItem && (
                    <LightboxModal
                        item={lightboxItem}
                        onClose={() => setLightboxItem(null)}
                        onDelete={() => handleRemoveFile(lightboxItem.index)}
                    />
                )}
            </div>
        );
    }

    // ==========================================
    // 5. MOBILE DEVELOPER REQUEST FORM
    // ==========================================
    if (ticketType === 'mobile-dev-request') {
        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
                {renderFormHeader(
                    <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
                    "Mobile Developer Request",
                    "Mobile iOS & Android App Development Support",
                    "bg-purple-500/10 border-purple-500/20"
                )}

                {/* Quick Templates */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-purple-500" /> Template Cepat
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        {MOBILE_DEV_TEMPLATES.map((tpl) => {
                            const isSelected = selectedTemplate === tpl.label;
                            return (
                                <button
                                    key={tpl.label}
                                    type="button"
                                    onClick={() => handleTemplateClick(tpl)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20"
                                            : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-purple-500/40"
                                    )}
                                >
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                                    <span>{tpl.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
                    className="bg-card rounded-2xl border border-border/80 p-5 md:p-8 shadow-sm space-y-6"
                >
                    {Object.keys(errors).length > 0 && (
                        <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                        </div>
                    )}

                    {/* Subject / Title */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label htmlFor="mobile-dev-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                                <FileText className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
                                <span>Subject / Judul Tiket <span className="text-rose-500">*</span></span>
                            </label>
                            <span className={cn(
                                "text-[11px] font-mono font-medium",
                                formData.title.trim().length === 0
                                    ? "text-muted-foreground"
                                    : formData.title.trim().length < 5
                                    ? "text-rose-500 font-bold"
                                    : "text-emerald-600 dark:text-emerald-400 font-semibold"
                            )}>
                                {formData.title.trim().length < 5 && formData.title.trim().length > 0
                                    ? `Kurang ${5 - formData.title.trim().length} karakter (min. 5)`
                                    : `${formData.title.length} / 200 karakter`}
                            </span>
                        </div>
                        <input
                            id="mobile-dev-ticket-title"
                            ref={titleRef}
                            type="text"
                            required
                            maxLength={200}
                            value={formData.title}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, title: val }));
                                setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                            }}
                            className={cn(
                                "w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60 transition-all shadow-2xs",
                                errors.title
                                    ? "border-rose-500 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
                                    : "border-border/90 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10"
                            )}
                            placeholder="Contoh: App Force Close, Gagal Download APK, Push Notif Error..."
                        />
                        {errors.title && (
                            <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{errors.title}</span>
                            </p>
                        )}
                    </div>

                    {/* Integrated Rich Composer */}
                    {renderRichDescriptionComposer(
                        "mobile-dev-ticket-description",
                        "Jelaskan tipe perangkat (Android/iOS), versi OS, langkah terjadinya error, atau lampirkan screenshot log crash...",
                        "focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10",
                        "text-purple-500"
                    )}

                    {/* Priority Selector */}
                    {renderPrioritySelector("text-purple-500")}

                    {/* Submit Action */}
                    {renderSubmitActionBar(
                        "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-purple-600/20",
                        "Kirim Tiket Mobile Dev"
                    )}
                </form>

                {/* Lightbox Modal */}
                {lightboxItem && (
                    <LightboxModal
                        item={lightboxItem}
                        onClose={() => setLightboxItem(null)}
                        onDelete={() => handleRemoveFile(lightboxItem.index)}
                    />
                )}
            </div>
        );
    }

    // ==========================================
    // 6. SERVICE TICKET FORM (Default IT Support)
    // ==========================================
    return (
        <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 mb-10">
            {renderFormHeader(
                <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-500" />,
                "Service Ticket",
                "General IT Support Request (Hardware, Software, Network & General)",
                "bg-amber-500/10 border-amber-500/20"
            )}

            {/* Quick Templates */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-500" /> Template Cepat
                </span>
                <div className="flex flex-wrap items-center gap-2">
                    {QUICK_TEMPLATES.map((tpl) => {
                        const isSelected = selectedTemplate === tpl.label;
                        return (
                            <button
                                key={tpl.label}
                                type="button"
                                onClick={() => handleTemplateClick(tpl)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5",
                                    isSelected
                                        ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20"
                                        : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-amber-500/40"
                                )}
                            >
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                <span>{tpl.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
                className="bg-card rounded-2xl border border-border/80 p-5 md:p-8 shadow-sm"
            >
                {Object.keys(errors).length > 0 && (
                    <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 mb-6">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                    {/* LEFT COLUMN - Subject & Integrated Rich Composer (6 cols) */}
                    <div className="lg:col-span-6 space-y-5">
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label htmlFor="service-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-wide">
                                    <FileText className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                                    <span>Subject / Judul Tiket <span className="text-rose-500">*</span></span>
                                </label>
                                <span className={cn(
                                    "text-[11px] font-mono font-medium",
                                    formData.title.trim().length === 0
                                        ? "text-muted-foreground"
                                        : formData.title.trim().length < 5
                                        ? "text-rose-500 font-bold"
                                        : "text-emerald-600 dark:text-emerald-400 font-semibold"
                                )}>
                                    {formData.title.trim().length < 5 && formData.title.trim().length > 0
                                        ? `Kurang ${5 - formData.title.trim().length} karakter (min. 5)`
                                        : `${formData.title.length} / 200 karakter`}
                                </span>
                            </div>
                            <input
                                id="service-ticket-title"
                                ref={titleRef}
                                type="text"
                                required
                                maxLength={200}
                                value={formData.title}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, title: val }));
                                    setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                                }}
                                className={cn(
                                    "w-full px-4 py-2.5 bg-background border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60 transition-all shadow-2xs",
                                    errors.title
                                        ? "border-rose-500 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500"
                                        : "border-border/90 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                                )}
                                placeholder="Ringkasan masalah (contoh: Monitor tidak menyala, Laptop lambat)..."
                            />
                            {errors.title && (
                                <p className="text-xs text-rose-500 font-medium mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{errors.title}</span>
                                </p>
                            )}
                        </div>

                        {/* Integrated Rich Composer */}
                        {renderRichDescriptionComposer(
                            "service-ticket-description",
                            "Jelaskan pesan error, lokasi, langkah yang sudah dicoba, atau paste screenshot langsung...",
                            "focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-500/10",
                            "text-amber-500"
                        )}
                    </div>

                    {/* CENTER COLUMN - Classification (3 cols) */}
                    <div className="lg:col-span-3 space-y-5">
                        {attributesError && (
                            <div role="alert" className="flex items-start gap-2 text-xs bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl p-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-semibold">Gagal memuat daftar kategori/device/software.</p>
                                    <button type="button" onClick={fetchAttributes} className="underline font-bold mt-1">
                                        Coba lagi
                                    </button>
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label id="label-service-category" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Tag className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Category
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg uppercase tracking-wider hover:bg-amber-500/20 cursor-pointer">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                <SelectTrigger aria-labelledby="label-service-category" className="w-full h-11 px-4 py-2.5 text-sm font-medium bg-background border border-border/90 rounded-xl shadow-2xs focus:ring-4 focus:ring-amber-500/10">
                                    <SelectValue placeholder="Pilih Kategori" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border font-medium">
                                    <SelectItem value="GENERAL">General</SelectItem>
                                    <SelectItem value="HARDWARE">Hardware</SelectItem>
                                    <SelectItem value="SOFTWARE">Software</SelectItem>
                                    <SelectItem value="NETWORK">Network</SelectItem>
                                    {attributes.categories?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label id="label-service-device" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Monitor className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Device
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg uppercase tracking-wider hover:bg-amber-500/20 cursor-pointer">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.device} onValueChange={(value) => setFormData({ ...formData, device: value })}>
                                <SelectTrigger aria-labelledby="label-service-device" className="w-full h-11 px-4 py-2.5 text-sm font-medium bg-background border border-border/90 rounded-xl shadow-2xs focus:ring-4 focus:ring-amber-500/10">
                                    <SelectValue placeholder="Pilih perangkat (opsional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border font-medium">
                                    {attributes.devices?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label id="label-service-software" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Box className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Software
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg uppercase tracking-wider hover:bg-amber-500/20 cursor-pointer">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.software} onValueChange={(value) => setFormData({ ...formData, software: value })}>
                                <SelectTrigger aria-labelledby="label-service-software" className="w-full h-11 px-4 py-2.5 text-sm font-medium bg-background border border-border/90 rounded-xl shadow-2xs focus:ring-4 focus:ring-amber-500/10">
                                    <SelectValue placeholder="Pilih aplikasi (opsional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border font-medium">
                                    {attributes.software?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Priority & Submit (3 cols) */}
                    <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
                        <fieldset className="border-0 p-0 m-0">
                            <legend className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Priority Level
                            </legend>
                            <div role="radiogroup" aria-label="Priority level" className="bg-muted/40 rounded-2xl p-1.5 border border-border/80 flex flex-col gap-1.5 shadow-2xs">
                                {PRIORITY_OPTIONS.map((p) => {
                                    const isSelected = formData.priority === p.id;

                                    return (
                                        <PriorityHoverTip key={p.id} priority={p.id} side="left">
                                            <button
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => setFormData({ ...formData, priority: p.id })}
                                                className={cn(
                                                    "w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer",
                                                    isSelected
                                                        ? `${p.activeBg} ${p.activeBorder} ${p.activeText} shadow-xs ring-2 ${p.activeRing}`
                                                        : "bg-card border-transparent hover:border-border/80 shadow-2xs text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={cn("w-2.5 h-2.5 rounded-full", p.dot, isSelected && "animate-pulse")} />
                                                    <span className={cn("font-bold text-xs uppercase tracking-wider", isSelected ? p.activeText : "text-foreground")}>
                                                        {p.id}
                                                    </span>
                                                </div>
                                            </button>
                                        </PriorityHoverTip>
                                    );
                                })}
                            </div>
                        </fieldset>

                        {/* Critical Reason */}
                        {formData.priority === 'CRITICAL' && (
                            <div className="bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl p-3.5 border border-rose-200/80 dark:border-rose-800/40 animate-in fade-in zoom-in-95 duration-200 space-y-1.5">
                                <label htmlFor="service-critical-reason" className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Justifikasi Urgent
                                </label>
                                <textarea
                                    id="service-critical-reason"
                                    required
                                    rows={2}
                                    value={formData.criticalReason}
                                    onChange={(e) => setFormData({ ...formData, criticalReason: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-rose-300 dark:border-rose-700/60 rounded-xl text-xs font-medium focus:ring-4 focus:ring-rose-500/15 outline-none resize-none placeholder:text-muted-foreground/60 min-h-[60px]"
                                    placeholder="Jelaskan alasan urgensi critical..."
                                />
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="space-y-2 pt-2">
                            <button
                                type="submit"
                                disabled={isLoading || !formData.title.trim() || !formData.description.trim() || (formData.priority === 'CRITICAL' && !formData.criticalReason?.trim())}
                                className="w-full h-[46px] flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all duration-200 focus:ring-4 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 active:scale-[0.98] text-xs uppercase tracking-wide cursor-pointer"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Membuat Tiket...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Kirim Service Ticket</span>
                                    </>
                                )}
                            </button>
                            <p className="text-center text-[10px] font-medium text-muted-foreground">
                                Pastikan informasi sudah benar sebelum mengirim
                            </p>
                        </div>
                    </div>
                </div>
            </form>

            {/* Lightbox Modal */}
            {lightboxItem && (
                <LightboxModal
                    item={lightboxItem}
                    onClose={() => setLightboxItem(null)}
                    onDelete={() => handleRemoveFile(lightboxItem.index)}
                />
            )}

            {/* Add Attribute Modal */}
            {showAddModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
                    <div
                        ref={addModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-attribute-title"
                        className="bg-card p-6 md:p-8 rounded-2xl w-full max-w-[400px] border border-border shadow-2xl animate-in zoom-in-95 duration-300"
                    >
                        <h3 id="add-attribute-title" className="text-lg font-bold text-foreground mb-4">Add New {showAddModal.type}</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-attribute-value" className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">{showAddModal.type} Name</label>
                                <input
                                    id="new-attribute-value"
                                    type="text"
                                    value={newAttributeValue}
                                    onChange={(e) => setNewAttributeValue(e.target.value)}
                                    className="w-full h-11 px-4 border border-border rounded-xl text-sm font-medium text-foreground bg-background focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none"
                                    placeholder={`Enter new ${showAddModal.type.toLowerCase()} name`}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseAddModal}
                                    className="flex-1 py-2.5 text-xs font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddAttribute}
                                    disabled={!newAttributeValue.trim() || isAddingAttribute}
                                    className="flex-1 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-primary/20 cursor-pointer"
                                >
                                    {isAddingAttribute ? 'Adding…' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Lightbox Modal Component for image full preview
interface LightboxModalProps {
    item: { url: string; name: string; size: number; index: number };
    onClose: () => void;
    onDelete: () => void;
}

const LightboxModal: React.FC<LightboxModalProps> = ({ item, onClose, onDelete }) => {
    return (
        <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative max-w-4xl max-h-[90vh] flex flex-col bg-card rounded-2xl border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Top Bar */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-card/90 border-b border-border/80">
                    <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                        <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground truncate" title={item.name}>{item.name}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded shrink-0">{formatFileSize(item.size)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={item.url}
                            download={item.name}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Unduh gambar"
                        >
                            <Download className="w-4 h-4" />
                        </a>
                        <button
                            type="button"
                            onClick={() => { onDelete(); onClose(); }}
                            className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Hapus gambar"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Tutup preview"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Modal Image Area */}
                <div className="flex items-center justify-center bg-black/10 p-4 max-h-[calc(90vh-70px)] overflow-auto">
                    <img
                        src={item.url}
                        alt={item.name}
                        className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md select-none"
                    />
                </div>
            </div>
        </div>
    );
};
