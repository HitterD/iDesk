import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation, NavigateFunction } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Paperclip, AlertCircle, Clock, Tag, Monitor, Box, FileText, Save, Trash2, Ticket, DollarSign, PackageX, Wifi } from 'lucide-react';
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

const DRAFT_KEY = 'ticket-draft';

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

interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
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

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    CRITICAL: { bg: 'bg-error-500/10', text: 'text-error-600 dark:text-error-500', dot: 'bg-error-500' },
    HIGH: { bg: 'bg-warning-500/10', text: 'text-warning-600 dark:text-warning-500', dot: 'bg-warning-500' },
    MEDIUM: { bg: 'bg-warning-500/10', text: 'text-warning-600 dark:text-warning-500', dot: 'bg-warning-500' },
    LOW: { bg: 'bg-info-500/10', text: 'text-info-600 dark:text-info-500', dot: 'bg-info-500' },
};

const formatDuration = (minutes: number): string => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
    return parts.join(' ');
};

type TicketType = 'none' | 'service' | 'lost-item' | 'oracle-request';

const TICKET_TYPES = ['none', 'service', 'lost-item', 'oracle-request'] as const satisfies readonly TicketType[];
const DRAFT_AUTOSAVE_DELAY_MS = 3_000;

const ORACLE_TEMPLATES = [
    { label: 'Login Issue', priority: 'MEDIUM', subject: 'Lupa Password / Gagal Login Oracle', description: 'Gagal login ke portal Oracle. Error message: ' },
    { label: 'Role Update', priority: 'MEDIUM', subject: 'Penambahan Role K2', description: 'Mohon tambahkan role [Nama Role] untuk user [Nama User] di K2.' },
    { label: 'System Error', priority: 'HIGH', subject: 'Error Transaksi Oracle', description: 'Terdapat error saat proses transaksi modul [Nama Modul]. Error detail: ' },
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
];

const TicketTypeCard: React.FC<{
    card: typeof TICKET_TYPE_CARDS[number];
    index: number;
    className?: string;
    style?: React.CSSProperties;
} & TicketTypeCardActionArgs> = ({ card, index, className = '', style, setTicketType, navigate, getBasePath }) => (
    // Double-bezel: gradient hairline shell wrapping a solid inner core, concentric radii.
    <div style={style} className={`p-px rounded-[1.4rem] bg-gradient-to-br from-primary/25 via-border to-accent/20 dark:from-primary/30 dark:via-border dark:to-accent/20 ${className}`}>
        <button
            type="button"
            onClick={() => card.action({ setTicketType, navigate, getBasePath })}
            aria-label={`Pilih ${card.title}`}
            className="group relative flex flex-col justify-between w-full min-h-[44px] h-full overflow-hidden rounded-[calc(1.4rem-1px)] bg-card p-6 text-left shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02] transition-all duration-300 motion-reduce:transition-none ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 motion-reduce:transform-none active:scale-[0.98] active:duration-100"
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

    const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
    const titleRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);

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

    // Fetch SLA configs for priorities
    const { data: slaConfigs = [] } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
        staleTime: 60000,
    });

    // Load draft on mount — deferred toast avoids firing on the selection screen
    const [draftToastShown, setDraftToastShown] = useState(false);
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
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
            }
        } catch (error) {
            logger.error('Failed to load draft:', error);
        }
        fetchAttributes();
    }, []);

    // Show draft-restored toast only once the service form mounts
    useEffect(() => {
        if (ticketType === 'service' && hasDraft && !draftToastShown) {
            toast.info('Draft dipulihkan', { description: 'Draft tiket Anda sebelumnya untuk Service Ticket telah dimuat kembali.' });
            setDraftToastShown(true);
        }
    }, [ticketType, hasDraft, draftToastShown]);

    // Auto-save draft (service + oracle) when form has content
    const saveDraft = useCallback(() => {
        if (ticketType !== 'service' && ticketType !== 'oracle-request') return;
        if (!formData.title && !formData.description) {
            return; // Don't save empty drafts
        }

        try {
            const draft: TicketDraft = {
                ...formData,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            setLastSaved(new Date());
            setHasDraft(true);
        } catch (error) {
            logger.error('Failed to save draft:', error);
        }
    }, [formData, ticketType]);

    // Auto-save on form change (debounced) — service + oracle
    useEffect(() => {
        if (ticketType !== 'service' && ticketType !== 'oracle-request') return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            saveDraft();
        }, DRAFT_AUTOSAVE_DELAY_MS); // Auto-save after inactivity

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [formData, saveDraft, ticketType]);

    const clearDraft = useCallback(() => {
        let snapshot: TicketDraft | null = null;
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (raw) snapshot = JSON.parse(raw) as TicketDraft;
        } catch { /* ignore */ }
        try {
            localStorage.removeItem(DRAFT_KEY);
            setHasDraft(false);
            setLastSaved(null);
            setDraftToastShown(false);
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                category: '',
                device: '',
                software: '',
                criticalReason: '',
            });
            toast.success('Draft cleared', snapshot ? {
                description: 'Draft dihapus.',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        if (!snapshot) return;
                        try {
                            localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
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
    }, []);

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
            // Surfaced in the UI: silently-empty dropdowns look like "no options exist".
            logger.error('Failed to fetch attributes:', error);
            setAttributesError(true);
        }
    };

    // Stable identity: useFocusTrap re-runs its effect whenever onEscape changes.
    const handleCloseAddModal = useCallback(() => {
        setShowAddModal({ type: '', show: false });
        setNewAttributeValue('');
    }, []);

    useFocusTrap(addModalRef, { enabled: showAddModal.show, onEscape: handleCloseAddModal });

    useEffect(() => {
        if (!showAddModal.show) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [showAddModal.show]);

    const handleAddAttribute = async () => {
        // Enter-to-submit plus a click could fire this twice and create duplicates.
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

    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const selectedSla = slaConfigs.find(s => s.priority === formData.priority);

    /**
     * Appends to the current selection instead of replacing it, and rejects files
     * the backend would refuse anyway (10MB each, 5 total, whitelisted types) so the
     * user finds out before the upload rather than after it.
     */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = ''; // allow re-picking the same file after a removal
        if (picked.length === 0) return;

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

        if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    };

    const handleRemoveFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation checks
        if (ticketType === 'service' || ticketType === 'oracle-request') {
            const titleErr = validateTitle(formData.title) || (formData.title.trim().length === 0 ? 'Judul tiket wajib diisi (minimal 5 karakter)' : undefined);
            const descErr = validateDescription(formData.description) || (formData.description.trim().length === 0 ? 'Deskripsi tiket wajib diisi (minimal 10 karakter)' : undefined);

            if (titleErr || descErr) {
                setErrors({ title: titleErr, description: descErr });
                toast.error(titleErr || descErr || 'Mohon lengkapi formulir sesuai ketentuan minimal karakter.');
                // Browser native validation does not cover minimum character rules.
                // Move focus to exact field instead of leaving it on Submit.
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
            } else {
                // Service Ticket submission
                formDataToSend.append('title', formData.title);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('priority', formData.priority);
                formDataToSend.append('category', formData.category);
                if (formData.device) formDataToSend.append('device', formData.device);
                if (formData.software) formDataToSend.append('software', formData.software);
                if (formData.priority === 'CRITICAL' && formData.criticalReason) {
                    formDataToSend.append('criticalReason', formData.criticalReason);
                }
            }

            files.forEach((file) => {
                formDataToSend.append('files', file);
            });

            await api.post('/tickets', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Only the service form autosaves a draft, so only a service submit may clear it.
            // Clearing unconditionally would destroy an unrelated service draft when a
            // hardware or oracle ticket is submitted.
            if (ticketType === 'service') {
                localStorage.removeItem(DRAFT_KEY);
                setHasDraft(false);
                setLastSaved(null);
            }

            toast.success('Ticket created successfully!');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

            // Oracle/K2 requests: agent_oracle/admin go to the dedicated queue, USER/others go to my-tickets
            if (ticketType === 'oracle-request') {
                if (user?.role === 'ADMIN') {
                    navigate('/tickets/oracle-k2');
                } else {
                    navigate('/client/my-tickets');
                }
            } else if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                navigate('/tickets/list');
            } else {
                navigate('/client/my-tickets');
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

    // Helper to check page access permission from preset / defaults
    const canAccessPage = useCallback((pageKey?: string): boolean => {
        if (!pageKey) return true;
        if (user?.role === 'ADMIN') return true;

        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            AGENT_OPERATIONAL_SUPPORT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT_ORACLE: ['oracle_k2_tickets', 'notifications'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads'],
            ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'settings'],
        };

        const userRole = (user?.role || 'USER') as string;
        return (roleDefaults[userRole] || roleDefaults['USER']).includes(pageKey);
    }, [user?.role, myPermissions?.pageAccess]);

    // Direct access guard (URL params e.g. ?type=lost-item)
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

    // Ticket Type Selection Screen
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
                        aria-label="Go back"
                        className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-0.5">New Request</p>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Buat Tiket Baru</h1>
                        <p className="text-muted-foreground text-sm">Pilih jenis kebutuhan Anda di bawah ini</p>
                    </div>
                </div>

                {/* Ticket Type Selection */}
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
                <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent p-5 flex gap-4 items-center">
                    <div className="p-2.5 bg-card rounded-xl text-primary shadow-sm ring-1 ring-primary/10 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">Pilih jenis tiket yang paling sesuai</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Tiap jenis tiket masuk ke tim yang berbeda. Kalau ragu, pilih <span className="font-semibold text-foreground">Service Ticket</span> untuk IT support umum.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

// Lost Item Form
    if (ticketType === 'lost-item') {
        const handleLostItemSubmit = async (data: any) => {
            setIsLoading(true);
            try {
                await api.post('/lost-item', data);
                toast.success('Lost item report submitted successfully!');
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
                if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                    navigate('/tickets/list');
                } else {
                    navigate('/client/my-tickets');
                }
            } catch (error: any) {
                logger.error('Failed to submit lost item report:', error);
                toast.error(error.response?.data?.message || 'Failed to submit report');
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div className="w-full max-w-7xl mx-auto space-y-4">
                {/* Header - Compact */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Back to request types"
                        className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
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

                {/* Form Card */}
                <div className="bg-card rounded-2xl border border-border p-4 md:p-6">
                    <LostItemForm
                        onSubmit={handleLostItemSubmit}
                        onCancel={handleBack}
                    />
                </div>
            </div>
        );
    }

// Oracle Request Form
    if (ticketType === 'oracle-request') {

        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
                {/* Header - Premium */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl shadow-sm">
                                <Box className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground tracking-tight">Oracle / K2 Request</h1>
                                <p className="text-sm text-muted-foreground font-medium">Enterprise System Support</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Templates Chip Row */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="p-1.5 bg-muted rounded-lg shrink-0">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {ORACLE_TEMPLATES.map((tpl, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ ...formData, title: tpl.subject, description: tpl.description, priority: tpl.priority })}
                            className="px-4 py-2 rounded-full bg-card border border-border text-xs font-bold text-muted-foreground hover:border-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out whitespace-nowrap shadow-sm active:scale-95"
                        >
                            {tpl.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }} className="bg-card rounded-2xl border border-border p-5 md:p-8 shadow-sm">
                    {Object.keys(errors).length > 0 && (
                        <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 mb-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                        </div>
                    )}
                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="oracle-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-cyan-500" aria-hidden="true" /> Subject / Title *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.title.length > 0 && formData.title.trim().length < 5
                                        ? "text-red-500 font-bold"
                                        : "text-muted-foreground"
                                )}>
                                    {formData.title.trim().length}/5 min
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
                                    setFormData({ ...formData, title: val });
                                    setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                                }}
                                aria-invalid={Boolean(errors.title)}
                                aria-describedby={errors.title ? 'oracle-ticket-title-error' : undefined}
                                className={cn(
                                    "w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none transition-colors shadow-sm font-medium text-foreground placeholder:text-muted-foreground",
                                    errors.title
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-border focus:ring-2 focus:ring-cyan-500/40"
                                )}
                                placeholder="E.g., Account Locked, Role Missing, Transaction Failed (minimal 5 karakter)..."
                            />
                            {errors.title && (
                                <p id="oracle-ticket-title-error" role="alert" className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    {errors.title}
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="oracle-ticket-description" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-cyan-500" aria-hidden="true" /> Detail Kebutuhan / Error *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.description.length > 0 && formData.description.trim().length < 10
                                        ? "text-red-500 font-bold"
                                        : "text-muted-foreground"
                                )}>
                                    {formData.description.trim().length}/10 min
                                </span>
                            </div>
                            <textarea
                                id="oracle-ticket-description"
                                ref={descriptionRef}
                                required
                                maxLength={5000}
                                value={formData.description}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, description: val });
                                    setErrors(prev => ({ ...prev, description: validateDescription(val) }));
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(120, e.target.scrollHeight) + 'px';
                                }}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={errors.description ? 'oracle-ticket-description-error' : undefined}
                                className={cn(
                                    "w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm outline-none transition-colors shadow-sm resize-none min-h-[120px] text-foreground leading-relaxed placeholder:text-muted-foreground",
                                    errors.description
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-border focus:ring-2 focus:ring-cyan-500/40"
                                )}
                                placeholder="Tuliskan secara lengkap error atau kebutuhan spesifik sistem (minimal 10 karakter)..."
                            />
                            {errors.description && (
                                <p id="oracle-ticket-description-error" role="alert" className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            {/* Priority Selector - Enhanced Horizontal Pills */}
                            <fieldset className="border-0 p-0 m-0">
                                <legend className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-4 h-4 text-cyan-500" aria-hidden="true" /> Issue Urgency
                                </legend>
                                <div role="radiogroup" aria-label="Issue urgency" className="flex bg-muted p-1.5 rounded-xl border border-border w-full overflow-hidden shadow-inner">
                                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => {
                                        const isSelected = formData.priority === p;
                                        const colors = PRIORITY_COLORS[p] || PRIORITY_COLORS.LOW;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                aria-label={p}
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                className={`flex-1 flex justify-center items-center py-2.5 rounded-lg font-bold text-xs transition-colors duration-150 tracking-wide ${isSelected
                                                    ? `${colors.bg} ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                            
                            {/* Attachment Upload - Drag zone style */}
                            <div className="flex gap-4">
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 flex items-center justify-center gap-2 h-[52px] border-2 border-dashed border-border text-sm font-semibold text-muted-foreground rounded-xl hover:border-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    {files.length > 0 ? `${files.length} Attachments` : 'Attach Screenshot'}
                                </button>
                                
                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading || !formData.title || !formData.description}
                                    className="flex-1 flex items-center justify-center gap-2 h-[52px] bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out focus:ring-4 focus:ring-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-600/25 active:scale-[0.98]"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            <span>Submit</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // Service Ticket Form - Premium Edition (templates now module-scope: QUICK_TEMPLATES)
    const applyTemplate = (template: typeof QUICK_TEMPLATES[number]) => {
        setFormData({
            ...formData,
            title: template.subject,
            description: template.description,
            category: template.category,
            priority: template.priority,
        });
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500 mb-10">
            {/* Header - Premium */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Back to request types"
                        className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl shadow-sm border border-amber-200/50">
                            <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">Service Ticket</h1>
                            <p className="text-sm font-medium text-muted-foreground">General IT Support Request</p>
                        </div>
                    </div>
                </div>

                {/* Draft indicator */}
                {hasDraft && (
                    <div aria-live="polite" className="flex items-center gap-1.5 p-1 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50 rounded-xl shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-500 px-3 py-1.5">
                            <Save className="w-3.5 h-3.5" aria-hidden="true" /> Auto-Saved{lastSaved ? ` · ${lastSaved.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </span>
                        <div className="w-px h-4 bg-green-200 dark:bg-green-800"></div>
                        <button type="button" onClick={clearDraft} className="p-1.5 mr-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Discard Draft">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Templates Chip Row */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="p-1.5 bg-muted rounded-lg shrink-0">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                </div>
                {QUICK_TEMPLATES.map((tpl, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="px-4 py-2 rounded-full bg-card border border-border text-xs font-bold text-muted-foreground hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out whitespace-nowrap shadow-sm active:scale-95"
                    >
                        {tpl.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }} className="bg-card rounded-2xl border border-border p-5 md:p-8 shadow-sm">
                {Object.keys(errors).length > 0 && (
                    <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 mb-6">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="font-medium">{errors.title || errors.description || 'Mohon perbaiki isian yang ditandai.'}</p>
                    </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

                    {/* LEFT COLUMN - Subject & Description (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="service-ticket-title" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                    Subject *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.title.length > 0 && formData.title.trim().length < 5
                                        ? "text-red-500 font-bold"
                                        : "text-muted-foreground"
                                )}>
                                    {formData.title.trim().length}/5 min
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
                                    setFormData({ ...formData, title: val });
                                    setErrors(prev => ({ ...prev, title: validateTitle(val) }));
                                }}
                                aria-invalid={Boolean(errors.title)}
                                aria-describedby={errors.title ? 'service-ticket-title-error' : undefined}
                                className={cn(
                                    "w-full px-4 py-3 h-12 bg-muted border border-border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground shadow-sm transition-colors",
                                    errors.title
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-border focus:ring-2 focus:ring-amber-500/30"
                                )}
                                placeholder="Summary of the issue (minimal 5 karakter)..."
                            />
                            {errors.title && (
                                <p id="service-ticket-title-error" role="alert" className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    {errors.title}
                                </p>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="service-ticket-description" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                    Description *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.description.length > 0 && formData.description.trim().length < 10
                                        ? "text-red-500 font-bold"
                                        : "text-muted-foreground"
                                )}>
                                    {formData.description.trim().length}/10 min
                                </span>
                            </div>
                            <textarea
                                id="service-ticket-description"
                                ref={descriptionRef}
                                required
                                maxLength={5000}
                                value={formData.description}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, description: val });
                                    setErrors(prev => ({ ...prev, description: validateDescription(val) }));
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(140, e.target.scrollHeight) + 'px';
                                }}
                                aria-invalid={Boolean(errors.description)}
                                aria-describedby={errors.description ? 'service-ticket-description-error' : undefined}
                                className={cn(
                                    "w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground shadow-sm resize-none min-h-[140px] leading-relaxed transition-colors",
                                    errors.description
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-border focus:ring-2 focus:ring-amber-500/30"
                                )}
                                placeholder="Include any error message, exact steps leading to the issue, or other context (minimal 10 karakter)..."
                                style={{ height: 'auto', minHeight: '140px' }}
                            />
                            {errors.description && (
                                <p id="service-ticket-description-error" role="alert" className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        {/* File Upload Region */}
                        <div>
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
                                disabled={files.length >= MAX_ATTACHMENTS_PER_TICKET}
                                className="w-full h-[60px] flex items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 font-semibold text-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm disabled:opacity-50 disabled:hover:border-border"
                            >
                                <Paperclip className="w-5 h-5" />
                                {files.length >= MAX_ATTACHMENTS_PER_TICKET
                                    ? `Batas ${MAX_ATTACHMENTS_PER_TICKET} lampiran tercapai`
                                    : 'Drop files here or Click to attach'}
                            </button>
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Maks {MAX_ATTACHMENTS_PER_TICKET} file, 10 MB per file. PDF, gambar, dokumen Office, txt, csv, zip.
                            </p>
                            {files.length > 0 && (
                                <ul className="mt-2 space-y-1.5">
                                    {files.map((file, index) => (
                                        <li
                                            key={`${file.name}-${file.size}`}
                                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-lg pl-3 pr-1 py-1"
                                        >
                                            <span className="truncate flex-1" title={file.name}>{file.name}</span>
                                            <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(index)}
                                                aria-label={`Hapus lampiran ${file.name}`}
                                                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* CENTER COLUMN - Classification (3 cols) */}
                    <div className="lg:col-span-3 space-y-6">
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
                            <div className="flex justify-between items-center mb-3">
                                <label id="label-service-category" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Tag className="w-4 h-4 text-amber-500" aria-hidden="true" /> Category
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[44px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                <SelectTrigger aria-labelledby="label-service-category" className="w-full h-12 px-4 py-3 text-sm font-medium bg-muted border border-border rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Select Category" />
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
                            <div className="flex justify-between items-center mb-3">
                                <label id="label-service-device" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Monitor className="w-4 h-4 text-amber-500" aria-hidden="true" /> Device
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[44px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.device} onValueChange={(value) => setFormData({ ...formData, device: value })}>
                                <SelectTrigger aria-labelledby="label-service-device" className="w-full h-12 px-4 py-3 text-sm font-medium bg-muted border border-border rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose device (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border font-medium">
                                    {attributes.devices?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label id="label-service-software" className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                    <Box className="w-4 h-4 text-amber-500" aria-hidden="true" /> Software
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[44px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.software} onValueChange={(value) => setFormData({ ...formData, software: value })}>
                                <SelectTrigger aria-labelledby="label-service-software" className="w-full h-12 px-4 py-3 text-sm font-medium bg-muted border border-border rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose app (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-border font-medium">
                                    {attributes.software?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Priority & Submit (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col space-y-6">
                        <fieldset className="border-0 p-0 m-0">
                            <legend className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                <AlertCircle className="w-4 h-4 text-amber-500" aria-hidden="true" /> Priority Level
                            </legend>
                            <div role="radiogroup" aria-label="Priority level" className="bg-muted rounded-xl p-1.5 border border-border flex flex-col gap-1.5 shadow-inner">
                                {slaConfigs.length > 0 ? (
                                    slaConfigs.map((sla) => {
                                        const colors = PRIORITY_COLORS[sla.priority] || PRIORITY_COLORS.LOW;
                                        const isSelected = formData.priority === sla.priority;
                                        return (
                                            <button
                                                key={sla.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => setFormData({ ...formData, priority: sla.priority })}
                                                className={`px-4 py-3 rounded-lg border flex items-center justify-between transition-colors duration-150 ${isSelected
                                                    ? `${colors.bg} border-current ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'bg-card border-transparent hover:border-border shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isSelected ? 'motion-reduce:animate-none animate-pulse' : ''}`}></span>
                                                    <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? colors.text : 'text-muted-foreground'}`}>
                                                        {sla.priority}
                                                    </span>
                                                </div>
                                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                                    <div className={`flex items-center gap-1.5 text-xs font-bold ${isSelected ? colors.text + ' opacity-80' : "text-muted-foreground"}`}>
                                                        <Clock className="w-3 h-3" aria-hidden="true" />
                                                        {formatDuration(sla.resolutionTimeMinutes)}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => {
                                        const colors = PRIORITY_COLORS[p] || PRIORITY_COLORS.LOW;
                                        const isSelected = formData.priority === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                className={`px-4 py-3 rounded-lg border flex items-center justify-between transition-colors duration-150 ${isSelected
                                                    ? `${colors.bg} border-current ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'bg-card border-transparent hover:border-border shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isSelected ? 'motion-reduce:animate-none animate-pulse' : ''}`}></span>
                                                    <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? colors.text : 'text-muted-foreground'}`}>
                                                        {p}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </fieldset>

                        {/* Critical Reason */}
                        {formData.priority === 'CRITICAL' && (
                            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800/30 animate-in fade-in motion-reduce:animate-none zoom-in-95 duration-300">
                                <label htmlFor="service-critical-reason" className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-4 h-4" aria-hidden="true" /> Justification
                                </label>
                                <textarea
                                    id="service-critical-reason"
                                    required
                                    rows={2}
                                    value={formData.criticalReason}
                                    onChange={(e) => setFormData({ ...formData, criticalReason: e.target.value })}
                                    className="w-full px-4 py-3 bg-card border border-red-300 dark:border-red-700/50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500/30 outline-none resize-none placeholder:text-red-400/50 min-h-[80px]"
                                    placeholder="Explain why this requires critical handling..."
                                />
                            </div>
                        )}
                        
                        {/* Submit Button */}
                        <div className="space-y-3 pt-6">
                            <button
                                type="submit"
                                disabled={isLoading || !formData.title || !formData.description || (formData.priority === 'CRITICAL' && !formData.criticalReason)}
                                className="w-full h-[54px] flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out focus:ring-4 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-amber-500/25 active:scale-[0.98] text-sm uppercase tracking-wide"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Creating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Submit Service Ticket</span>
                                    </>
                                )}
                            </button>
                            <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2">
                                Please ensure all details are correct before submitting
                            </p>
                        </div>
                    </div>
                </div>
            </form>

            {/* Add Attribute Modal */}
            {showAddModal.show && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
                    <div
                        ref={addModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-attribute-title"
                        className="bg-card p-8 rounded-2xl w-full max-w-[400px] border border-border shadow-2xl animate-in zoom-in-95 duration-300"
                    >
                        <h3 id="add-attribute-title" className="text-xl font-bold text-foreground mb-6">Add New {showAddModal.type}</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-attribute-value" className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">{showAddModal.type} Name</label>
                                <input
                                    id="new-attribute-value"
                                    type="text"
                                    value={newAttributeValue}
                                    onChange={(e) => setNewAttributeValue(e.target.value)}
                                    className="w-full h-12 px-4 border border-border rounded-xl text-sm font-medium text-foreground bg-muted focus:ring-2 focus:ring-amber-500/40 outline-none"
                                    placeholder={`Enter new ${showAddModal.type.toLowerCase()} name`}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseAddModal}
                                    className="flex-1 py-3 min-h-[44px] text-sm font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddAttribute}
                                    disabled={!newAttributeValue.trim() || isAddingAttribute}
                                    className="flex-1 py-3 min-h-[44px] text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-md shadow-primary/20"
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
