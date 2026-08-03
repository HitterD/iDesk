import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, NavigateFunction } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Paperclip, AlertCircle, Clock, Tag, Monitor, Box, FileText, Save, Trash2, Calendar, CheckCircle2, Ticket, HardDrive, DollarSign, PackageX, Wifi } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../../stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { logger } from '@/lib/logger';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { IctBudgetForm } from '@/features/ticket-board/components/IctBudgetForm';
import { LostItemForm } from '@/features/ticket-board/components/LostItemForm';
import { AccessRequestForm } from '@/features/ticket-board/components/AccessRequestForm';
import { useAvailableSlots } from '@/features/request-center/api/schedule.api';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import {
    MAX_ATTACHMENTS_PER_TICKET,
    formatFileSize,
    validateAttachmentFile,
} from '@/lib/file-validation';

const DRAFT_KEY = 'ticket-draft';
/** Hardware installs must be booked at least one day ahead. */
const MIN_SCHEDULE_LEAD_MS = 24 * 60 * 60 * 1000;

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
    CRITICAL: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600', dot: 'bg-red-500' },
    HIGH: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600', dot: 'bg-orange-500' },
    MEDIUM: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600', dot: 'bg-yellow-500' },
    LOW: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600', dot: 'bg-blue-500' },
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

type TicketType = 'none' | 'service' | 'hardware' | 'ict-budget' | 'lost-item' | 'access-request' | 'oracle-request';

const TICKET_TYPES: TicketType[] = ['none', 'service', 'hardware', 'ict-budget', 'lost-item', 'access-request', 'oracle-request'];
const DRAFT_AUTOSAVE_DELAY_MS = 3_000;

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
            className="group relative flex flex-col justify-between w-full min-h-[44px] h-full overflow-hidden rounded-[calc(1.4rem-1px)] bg-white dark:bg-card p-6 text-left shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02] transition-all duration-300 motion-reduce:transition-none ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 motion-reduce:transform-none active:scale-[0.98] active:duration-100"
        >
            <span className="absolute top-5 right-6 font-mono text-[11px] tracking-widest text-primary/25 dark:text-primary/30 select-none">
                {String(index + 1).padStart(2, '0')}
            </span>

            <div>
                <div className="w-[3.25rem] h-[3.25rem] rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10 flex items-center justify-center mb-5 transition-colors duration-300 group-hover:bg-primary group-hover:ring-primary">
                    <card.icon className="w-6 h-6 text-primary transition-colors duration-300 group-hover:text-primary-foreground" aria-hidden="true" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent mb-1.5">{card.eyebrow}</p>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2 tracking-tight">{card.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
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

    const [errors, setErrors] = useState<{ title?: string; description?: string; hardwareDescription?: string }>({});
    const titleRef = useRef<HTMLInputElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const hardwareDescriptionRef = useRef<HTMLTextAreaElement>(null);

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

    // Hardware installation state
    const [hardwareData, setHardwareData] = useState({
        scheduledDate: '',
        scheduledTime: '',
        hardwareType: '',
        customHardwareType: '',
        description: '', // Keterangan hardware yang akan diinstall
        userAcknowledged: false,
    });

    // Default values (fallback if API fails)
    const DEFAULT_HARDWARE_TYPES = ['PC', 'IP-Phone', 'Printer'];
    const DEFAULT_TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'];

    const [hasDraft, setHasDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch scheduling config from API
    interface SchedulingConfig {
        timeSlots: string[];
        hardwareTypes: string[];
    }

    const { data: schedulingConfig } = useQuery<SchedulingConfig>({
        queryKey: ['scheduling-config'],
        queryFn: async () => {
            const res = await api.get('/settings/scheduling');
            return res.data;
        },
        staleTime: 60000, // Cache for 1 minute
    });

    // Use API values with fallback to defaults
    const HARDWARE_TYPES = schedulingConfig?.hardwareTypes ?? DEFAULT_HARDWARE_TYPES;
    
    // Dynamic available slots
    const { data: dynamicSlots, isLoading: isLoadingSlots } = useAvailableSlots(hardwareData.scheduledDate);
    const availableDynamicSlots = dynamicSlots?.slots 
        ? dynamicSlots.slots.filter(s => s.isAvailable).map(s => s.timeSlot) 
        : DEFAULT_TIME_SLOTS;

    // Fetch SLA configs for priorities
    const { data: slaConfigs = [] } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
        staleTime: 60000,
    });

    // Load draft on mount
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
                // setTicketType('service'); // Removed: Do not auto-select service if draft exists so user stays on selection menu
                toast.info('Draft dipulihkan', { description: 'Draft tiket Anda sebelumnya untuk Service Ticket telah dimuat kembali.' });
            }
        } catch (error) {
            logger.error('Failed to load draft:', error);
        }
        fetchAttributes();
    }, []);

    // Auto-save draft every 10 seconds when form has content
    const saveDraft = useCallback(() => {
        if (ticketType !== 'service') return; // Only save service ticket drafts
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

    // Auto-save on form change (debounced)
    useEffect(() => {
        if (ticketType !== 'service') return;

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

    const clearDraft = () => {
        try {
            localStorage.removeItem(DRAFT_KEY);
            setHasDraft(false);
            setLastSaved(null);
            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                category: '',
                device: '',
                software: '',
                criticalReason: '',
            });
            toast.success('Draft cleared');
        } catch (error) {
            logger.error('Failed to clear draft:', error);
        }
    };

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
        } else if (ticketType === 'hardware') {
            const descErr = validateDescription(hardwareData.description) || (hardwareData.description.trim().length === 0 ? 'Keterangan hardware wajib diisi (minimal 10 karakter)' : undefined);
            if (descErr) {
                setErrors({ hardwareDescription: descErr });
                toast.error(descErr);
                hardwareDescriptionRef.current?.focus();
                return;
            }
        }

        setIsLoading(true);
        try {
            const formDataToSend = new FormData();

            if (ticketType === 'hardware') {
                // Hardware Installation submission
                formDataToSend.append('title', 'Hardware Installation');
                formDataToSend.append('description', hardwareData.description);
                formDataToSend.append('priority', 'MEDIUM'); // Backend will override to HARDWARE_INSTALLATION
                formDataToSend.append('category', 'HARDWARE_INSTALLATION');
                formDataToSend.append('isHardwareInstallation', 'true');
                formDataToSend.append('scheduledDate', hardwareData.scheduledDate);
                formDataToSend.append('scheduledTime', hardwareData.scheduledTime);
                formDataToSend.append('hardwareType', hardwareData.hardwareType === 'OTHER' ? hardwareData.customHardwareType : hardwareData.hardwareType);
                formDataToSend.append('userAcknowledged', 'true');
            } else if (ticketType === 'oracle-request') {
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

            toast.success(ticketType === 'hardware' ? 'Hardware Installation scheduled!' : 'Ticket created successfully!');
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
        if ((ticketType === 'hardware' || ticketType === 'ict-budget') && !canAccessPage('hardware_requests')) {
            toast.error('Anda tidak memiliki akses ke halaman Hardware Requests');
            setTicketType('none');
        }
        if (ticketType === 'access-request' && !canAccessPage('eform_access')) {
            toast.error('Anda tidak memiliki akses ke halaman E-Form Access');
            setTicketType('none');
        }
    }, [ticketType, canAccessPage]);

    const handleBack = () => {
        if (ticketType !== 'none') {
            setTicketType('none');
        } else {
            navigate(-1);
        }
    };

    // Ticket Type Selection Screen
    if (ticketType === 'none') {
        const getBasePath = () => location.pathname.startsWith('/client') ? '/client' : location.pathname.startsWith('/manager') ? '/manager' : '';

        const visibleCards = TICKET_TYPE_CARDS.filter(card => canAccessPage(card.pageKey));

        const getCardGridClass = (cardIndex: number, totalCards: number) => {
            if (totalCards === 5) {
                return `md:col-span-2 ${cardIndex === 3 ? 'md:col-start-2' : ''}`;
            }
            if (totalCards === 4) {
                return `md:col-span-3`;
            }
            if (totalCards === 3) {
                return `md:col-span-2`;
            }
            if (totalCards === 2) {
                return `md:col-span-3`;
            }
            return `md:col-span-6 max-w-md mx-auto`;
        };

        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-8 lg:space-y-10 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-0.5">New Request</p>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Buat Tiket Baru</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Pilih jenis kebutuhan Anda di bawah ini</p>
                    </div>
                </div>

                {/* Ticket Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
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
                    <div className="p-2.5 bg-white dark:bg-card rounded-xl text-primary shadow-sm ring-1 ring-primary/10 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Pilih jenis tiket yang paling sesuai</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                            Tiap jenis tiket masuk ke tim yang berbeda. Kalau ragu, pilih <span className="font-semibold text-slate-700 dark:text-slate-300">Service Ticket</span> untuk IT support umum.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Hardware Installation Form
    if (ticketType === 'hardware') {
        return (
            <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-500">
                {/* Header - Compact */}
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Back to request types"
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl shadow-sm">
                            <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                            Hardware Installation
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-8 shadow-sm">
                    {/* Main Form - 3 Column Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                        {/* LEFT COLUMN - Hardware Type + Description (5 cols) */}
                        <div className="lg:col-span-5 space-y-5">
                            {/* Hardware Type */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Monitor className="w-4 h-4 text-emerald-500" /> Hardware Type *
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {HARDWARE_TYPES.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setHardwareData({ ...hardwareData, hardwareType: type, customHardwareType: '' })}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm active:scale-95 ${hardwareData.hardwareType === type
                                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/20'
                                                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setHardwareData({ ...hardwareData, hardwareType: 'OTHER' })}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm active:scale-95 ${hardwareData.hardwareType === 'OTHER'
                                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/20'
                                            : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        Other...
                                    </button>
                                </div>
                                {hardwareData.hardwareType === 'OTHER' && (
                                    <>
                                        <label htmlFor="custom-hardware-type" className="sr-only">Specify hardware type</label>
                                        <input
                                            id="custom-hardware-type"
                                            type="text"
                                            required
                                            value={hardwareData.customHardwareType}
                                            onChange={(e) => setHardwareData({ ...hardwareData, customHardwareType: e.target.value })}
                                            className="w-full mt-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm text-slate-800 dark:text-white"
                                            placeholder="Specify hardware type..."
                                        />
                                    </>
                                )}
                            </div>

                            {/* Description - Auto Expand */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                        <FileText className="w-4 h-4 text-emerald-500" /> Keterangan Hardware *
                                    </label>
                                    <span className={cn(
                                        "text-xs font-mono font-semibold",
                                        hardwareData.description.length > 0 && hardwareData.description.trim().length < 10
                                            ? "text-red-500 font-bold"
                                            : "text-slate-400"
                                    )}>
                                        {hardwareData.description.trim().length}/10 min
                                    </span>
                                </div>
                                <textarea
                                    id="hardware-description"
                                    ref={hardwareDescriptionRef}
                                    required
                                    maxLength={5000}
                                    aria-invalid={Boolean(errors.hardwareDescription)}
                                    aria-describedby={errors.hardwareDescription ? 'hardware-description-error' : undefined}
                                    value={hardwareData.description}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setHardwareData({ ...hardwareData, description: val });
                                        setErrors(prev => ({ ...prev, hardwareDescription: validateDescription(val) }));
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px';
                                    }}
                                    className={cn(
                                        "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none transition-colors shadow-sm resize-none min-h-[100px] text-slate-800 dark:text-white",
                                        errors.hardwareDescription
                                            ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                            : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30"
                                    )}
                                    placeholder="Jelaskan detail hardware, lokasi spesifik, atau instruksi instalasi (minimal 10 karakter)..."
                                />
                                {errors.hardwareDescription && (
                                    <p id="hardware-description-error" className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                        {errors.hardwareDescription}
                                    </p>
                                )}
                            </div>

                            {/* Attachments */}
                            <div>
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-3 w-full justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-500 dark:text-slate-400 rounded-xl hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors duration-150"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    {files.length > 0 ? `${files.length} file(s) attached` : 'Attach Photos or Documents'}
                                </button>
                            </div>
                        </div>

                        {/* CENTER COLUMN - Schedule (3 cols) */}
                        <div className="lg:col-span-3 space-y-5">
                            {/* Installation Date */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Calendar className="w-4 h-4 text-emerald-500" /> Installation Date *
                                </label>
                                <ModernDatePicker
                                    value={hardwareData.scheduledDate ? parseISO(hardwareData.scheduledDate) : undefined}
                                    onChange={(date) => setHardwareData({
                                        ...hardwareData,
                                        scheduledDate: format(date, 'yyyy-MM-dd'),
                                        // Available slots depend on date. Keeping the old selection
                                        // submits a time that may no longer be offered for the new day.
                                        scheduledTime: '',
                                    })}
                                    placeholder="Select optimal date"
                                    minDate={new Date(Date.now() + MIN_SCHEDULE_LEAD_MS)}
                                    triggerClassName="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-medium shadow-sm"
                                />
                            </div>

                            {/* Time Slot */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Clock className="w-4 h-4 text-emerald-500" /> Time Slot *
                                </label>
                                <Select disabled={!hardwareData.scheduledDate || isLoadingSlots} value={hardwareData.scheduledTime} onValueChange={(value) => setHardwareData({ ...hardwareData, scheduledTime: value })}>
                                    <SelectTrigger className="w-full px-4 py-3 h-auto text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium shadow-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out focus:ring-2 focus:ring-emerald-500/30">
                                        <SelectValue placeholder={!hardwareData.scheduledDate ? "Select Date First" : isLoadingSlots ? "Loading slots..." : "Select Time"} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl overflow-hidden border-slate-200 dark:border-slate-700">
                                        {availableDynamicSlots.length === 0 && hardwareData.scheduledDate && !isLoadingSlots ? (
                                            <div className="p-3 text-sm font-medium text-slate-500 text-center">No slots available for this date</div>
                                        ) : (
                                            availableDynamicSlots.map(slot => (
                                                <SelectItem key={slot} value={slot} className="font-medium">{slot} WIB</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* RIGHT COLUMN - Info + Acknowledge + Submit (4 cols) */}
                        <div className="lg:col-span-4 flex flex-col space-y-5">
                            {/* Important Info - Premium Alert */}
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800/30 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl -mt-8 -mr-8"></div>
                                <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-emerald-500" /> Preparation Checklist
                               </h4>
                                <ul className="text-xs font-medium text-emerald-700/80 dark:text-emerald-300/80 space-y-2">
                                   <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> Please be available during the selected time exactly at your desk</li>
                                   <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> Installations typically require 2-4 hours to complete full setup</li>
                                   <li className="flex items-start gap-1.5"><span className="text-emerald-500">•</span> Perform manual backups of locally stored files before IT arrives</li>
                                </ul>
                            </div>

                            <div className="flex-grow"></div>

                            {/* Acknowledgment Card */}
                            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-emerald-500 hover:shadow-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out">
                                <input
                                    type="checkbox"
                                    required
                                    checked={hardwareData.userAcknowledged}
                                    onChange={(e) => setHardwareData({ ...hardwareData, userAcknowledged: e.target.checked })}
                                    className="w-5 h-5 mt-0.5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                    <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        I Understand and Agree
                                    </span>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        I am ready for the installation time & have completed required data backups.
                                    </p>
                                </div>
                            </label>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !hardwareData.description || !hardwareData.scheduledDate || !hardwareData.scheduledTime || !hardwareData.hardwareType || !hardwareData.userAcknowledged || (hardwareData.hardwareType === 'OTHER' && !hardwareData.customHardwareType)}
                                className="w-full flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Scheduling...</span>
                                    </>
                                ) : (
                                    <>
                                        <Calendar className="w-4 h-4" />
                                        <span>Confirm Schedule</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // ICT Budget Form
    if (ticketType === 'ict-budget') {
        const handleIctBudgetSubmit = async (data: any) => {
            setIsLoading(true);
            try {
                await api.post('/ict-budget', data);
                toast.success('ICT Budget request submitted successfully!');
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
                if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                    navigate('/tickets/list');
                } else {
                    navigate('/client/my-tickets');
                }
            } catch (error: any) {
                logger.error('Failed to submit ICT Budget request:', error);
                toast.error(error.response?.data?.message || 'Failed to submit request');
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
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                            <DollarSign className="w-4 h-4 text-emerald-600" />
                        </div>
                        ICT Budget
                    </h1>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                    <IctBudgetForm
                        onSubmit={handleIctBudgetSubmit}
                        onCancel={handleBack}
                    />
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
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/50 rounded-lg">
                            <PackageX className="w-4 h-4 text-red-600" />
                        </div>
                        Lost Item Report
                    </h1>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                    <LostItemForm
                        onSubmit={handleLostItemSubmit}
                        onCancel={handleBack}
                    />
                </div>
            </div>
        );
    }

    // Access Request Form
    if (ticketType === 'access-request') {
        const handleAccessRequestSubmit = async (data: any) => {
            setIsLoading(true);
            try {
                await api.post('/access-request', data);
                toast.success('Access request submitted successfully!');
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
                if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                    navigate('/tickets/list');
                } else {
                    navigate('/client/my-tickets');
                }
            } catch (error: any) {
                logger.error('Failed to submit access request:', error);
                toast.error(error.response?.data?.message || 'Failed to submit request');
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
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                            <Wifi className="w-4 h-4 text-sky-600" />
                        </div>
                        Access Request
                    </h1>
                </div>

                {/* Form Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                    <AccessRequestForm
                        onSubmit={handleAccessRequestSubmit}
                        onCancel={handleBack}
                    />
                </div>
            </div>
        );
    }

    // Oracle Request Form
    if (ticketType === 'oracle-request') {
        const ORACLE_TEMPLATES = [
            { label: 'Login Issue', priority: 'MEDIUM', subject: 'Lupa Password / Gagal Login Oracle', description: 'Gagal login ke portal Oracle. Error message: ' },
            { label: 'Role Update', priority: 'MEDIUM', subject: 'Penambahan Role K2', description: 'Mohon tambahkan role [Nama Role] untuk user [Nama User] di K2.' },
            { label: 'System Error', priority: 'HIGH', subject: 'Error Transaksi Oracle', description: 'Terdapat error saat proses transaksi modul [Nama Modul]. Error detail: ' },
        ];

        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
                {/* Header - Premium */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl shadow-sm">
                                <Box className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Oracle / K2 Request</h1>
                                <p className="text-sm text-slate-500 font-medium">Enterprise System Support</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Templates Chip Row */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                        <Tag className="w-4 h-4 text-slate-500" />
                    </div>
                    {ORACLE_TEMPLATES.map((tpl, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setFormData({ ...formData, title: tpl.subject, description: tpl.description, priority: tpl.priority })}
                            className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out whitespace-nowrap shadow-sm active:scale-95"
                        >
                            {tpl.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-8 shadow-sm">
                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-cyan-500" /> Subject / Title *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.title.length > 0 && formData.title.trim().length < 5
                                        ? "text-red-500 font-bold"
                                        : "text-slate-400"
                                )}>
                                    {formData.title.trim().length}/5 min
                                </span>
                            </div>
                            <input
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
                                className={cn(
                                    "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none transition-colors shadow-sm font-medium text-slate-800 dark:text-white",
                                    errors.title
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500/40"
                                )}
                                placeholder="E.g., Account Locked, Role Missing, Transaction Failed (minimal 5 karakter)..."
                            />
                            {errors.title && (
                                <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {errors.title}
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-cyan-500" /> Detail Kebutuhan / Error *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.description.length > 0 && formData.description.trim().length < 10
                                        ? "text-red-500 font-bold"
                                        : "text-slate-400"
                                )}>
                                    {formData.description.trim().length}/10 min
                                </span>
                            </div>
                            <textarea
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
                                className={cn(
                                    "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none transition-colors shadow-sm resize-none min-h-[120px] text-slate-800 dark:text-white leading-relaxed",
                                    errors.description
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-cyan-500/40"
                                )}
                                placeholder="Tuliskan secara lengkap error atau kebutuhan spesifik sistem (minimal 10 karakter)..."
                            />
                            {errors.description && (
                                <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            {/* Priority Selector - Enhanced Horizontal Pills */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-4 h-4 text-cyan-500" /> Issue Urgency
                                </label>
                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full overflow-hidden shadow-inner">
                                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => {
                                        const isSelected = formData.priority === p;
                                        const colors = PRIORITY_COLORS[p] || PRIORITY_COLORS.LOW;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                className={`flex-1 flex justify-center items-center py-2.5 rounded-lg font-bold text-[10px] sm:text-xs transition-colors duration-150 tracking-wide ${isSelected
                                                    ? `${colors.bg} ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Attachment Upload - Drag zone style */}
                            <div className="flex gap-4">
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 flex items-center justify-center gap-2 h-[52px] border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:border-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
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

    // Service Ticket Form - Premium Edition
    const QUICK_TEMPLATES = [
        { label: 'Email Issue', category: 'SOFTWARE', priority: 'HIGH', subject: 'Email tidak bisa diakses', description: 'Tidak dapat mengirim atau menerima email. Error message: ' },
        { label: 'Printer Fault', category: 'HARDWARE', priority: 'MEDIUM', subject: 'Printer rusak / tidak merespon', description: 'Printer tidak merespon saat print. Sudah direstart. Model printer: ' },
        { label: 'Slow System', category: 'HARDWARE', priority: 'LOW', subject: 'Komputer lemot', description: 'PC/Laptop sangat lambat saat membuka aplikasi. Area timbul keluhan: ' },
        { label: 'No Network', category: 'NETWORK', priority: 'HIGH', subject: 'Koneksi internet bermasalah', description: 'Tidak ada koneksi WiFi maupun LAN. Area/Lantai: ' },
        { label: 'Software Error', category: 'SOFTWARE', priority: 'CRITICAL', subject: 'Error sistem saat input data', description: 'Proses berhenti karena error. Nama sistem: ' },
        { label: 'Login Issue', category: 'GENERAL', priority: 'MEDIUM', subject: 'Password terkunci', description: 'Gagal login berkali-kali. Mohon dibantu reset. Username: ' },
    ];

    const applyTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
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
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl shadow-sm border border-amber-200/50">
                            <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Service Ticket</h1>
                            <p className="text-sm font-medium text-slate-500">General IT Support Request</p>
                        </div>
                    </div>
                </div>

                {/* Draft indicator */}
                {hasDraft && (
                    <div className="flex items-center gap-1.5 p-1 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/50 rounded-xl shadow-sm">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-500 px-3 py-1.5">
                            <Save className="w-3.5 h-3.5" /> Auto-Saved
                        </span>
                        <div className="w-px h-4 bg-green-200 dark:bg-green-800"></div>
                        <button type="button" onClick={clearDraft} className="p-1.5 mr-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Discard Draft">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Templates Chip Row */}
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide py-1">
                <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                    <Tag className="w-4 h-4 text-slate-500" />
                </div>
                {QUICK_TEMPLATES.map((tpl, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out whitespace-nowrap shadow-sm active:scale-95"
                    >
                        {tpl.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-8 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

                    {/* LEFT COLUMN - Subject & Description (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="service-ticket-title" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                    Subject *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.title.length > 0 && formData.title.trim().length < 5
                                        ? "text-red-500 font-bold"
                                        : "text-slate-400"
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
                                    "w-full px-4 py-3 h-12 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm font-medium outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-sm transition-colors",
                                    errors.title
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30"
                                )}
                                placeholder="Summary of the issue (minimal 5 karakter)..."
                            />
                            {errors.title && (
                                <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {errors.title}
                                </p>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-amber-500" />
                                    Description *
                                </label>
                                <span className={cn(
                                    "text-xs font-mono font-semibold",
                                    formData.description.length > 0 && formData.description.trim().length < 10
                                        ? "text-red-500 font-bold"
                                        : "text-slate-400"
                                )}>
                                    {formData.description.trim().length}/10 min
                                </span>
                            </div>
                            <textarea
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
                                className={cn(
                                    "w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm font-medium outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-sm resize-none min-h-[140px] leading-relaxed transition-colors",
                                    errors.description
                                        ? "border-red-500 focus:ring-2 focus:ring-red-500/30"
                                        : "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30"
                                )}
                                placeholder="Include any error message, exact steps leading to the issue, or other context (minimal 10 karakter)..."
                                style={{ height: 'auto', minHeight: '140px' }}
                            />
                            {errors.description && (
                                <p className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
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
                                className="w-full h-[60px] flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 font-semibold text-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm disabled:opacity-50 disabled:hover:border-slate-200"
                            >
                                <Paperclip className="w-5 h-5" />
                                {files.length >= MAX_ATTACHMENTS_PER_TICKET
                                    ? `Batas ${MAX_ATTACHMENTS_PER_TICKET} lampiran tercapai`
                                    : 'Drop files here or Click to attach'}
                            </button>
                            <p className="text-[11px] text-slate-400 mt-1.5">
                                Maks {MAX_ATTACHMENTS_PER_TICKET} file, 10 MB per file. PDF, gambar, dokumen Office, txt, csv, zip.
                            </p>
                            {files.length > 0 && (
                                <ul className="mt-2 space-y-1.5">
                                    {files.map((file, index) => (
                                        <li
                                            key={`${file.name}-${file.size}`}
                                            className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-1 py-1"
                                        >
                                            <span className="truncate flex-1" title={file.name}>{file.name}</span>
                                            <span className="shrink-0 text-slate-400">{formatFileSize(file.size)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFile(index)}
                                                aria-label={`Hapus lampiran ${file.name}`}
                                                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
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
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Tag className="w-4 h-4 text-amber-500" /> Category
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[32px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                <SelectTrigger className="w-full h-12 px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 font-medium">
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
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Monitor className="w-4 h-4 text-amber-500" /> Device
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[32px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.device} onValueChange={(value) => setFormData({ ...formData, device: value })}>
                                <SelectTrigger className="w-full h-12 px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose device (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 font-medium">
                                    {attributes.devices?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Box className="w-4 h-4 text-amber-500" /> Software
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 min-h-[32px] px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/40">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.software} onValueChange={(value) => setFormData({ ...formData, software: value })}>
                                <SelectTrigger className="w-full h-12 px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose app (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 font-medium">
                                    {attributes.software?.map((attr) => (
                                        <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Priority & Submit (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                <AlertCircle className="w-4 h-4 text-amber-500" /> Priority Level
                            </label>
                            
                            <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-1.5 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 shadow-inner">
                                {slaConfigs.length > 0 ? (
                                    slaConfigs.map((sla) => {
                                        const colors = PRIORITY_COLORS[sla.priority] || PRIORITY_COLORS.LOW;
                                        const isSelected = formData.priority === sla.priority;
                                        return (
                                            <button
                                                key={sla.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: sla.priority })}
                                                className={`px-4 py-3 rounded-lg border flex items-center justify-between transition-colors duration-150 ${isSelected
                                                    ? `${colors.bg} border-current ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isSelected ? 'animate-pulse' : ''}`}></span>
                                                    <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? colors.text : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {sla.priority}
                                                    </span>
                                                </div>
                                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                                    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isSelected ? colors.text + ' opacity-80' : 'text-slate-400'}`}>
                                                        <Clock className="w-3 h-3" />
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
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                className={`px-4 py-3 rounded-lg border flex items-center justify-between transition-colors duration-150 ${isSelected
                                                    ? `${colors.bg} border-current ${colors.text} shadow-sm ring-1 ring-current`
                                                    : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isSelected ? 'animate-pulse' : ''}`}></span>
                                                    <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? colors.text : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {p}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Critical Reason */}
                        {formData.priority === 'CRITICAL' && (
                            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-800/30 animate-in fade-in zoom-in-95 duration-300">
                                <label className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                                    <AlertCircle className="w-4 h-4" /> Justification
                                </label>
                                <textarea
                                    required
                                    rows={2}
                                    value={formData.criticalReason}
                                    onChange={(e) => setFormData({ ...formData, criticalReason: e.target.value })}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700/50 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500/30 outline-none resize-none placeholder:text-red-400/50 min-h-[80px]"
                                    placeholder="Explain why this requires critical handling..."
                                />
                            </div>
                        )}
                        
                        <div className="flex-grow"></div>

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
                            <p className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2">
                                Please ensure all details are correct before submitting
                            </p>
                        </div>
                    </div>
                </div>
            </form>

            {/* Add Attribute Modal */}
            {showAddModal.show && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
                    <div
                        ref={addModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-attribute-title"
                        className="bg-white dark:bg-slate-800 p-8 rounded-2xl w-full max-w-[400px] border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-300"
                    >
                        <h3 id="add-attribute-title" className="text-xl font-bold text-slate-800 dark:text-white mb-6">Add New {showAddModal.type}</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="new-attribute-value" className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{showAddModal.type} Name</label>
                                <input
                                    id="new-attribute-value"
                                    type="text"
                                    value={newAttributeValue}
                                    onChange={(e) => setNewAttributeValue(e.target.value)}
                                    className="w-full h-12 px-4 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/40 outline-none"
                                    placeholder={`Enter new ${showAddModal.type.toLowerCase()} name`}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseAddModal}
                                    className="flex-1 py-3 min-h-[44px] text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddAttribute}
                                    disabled={!newAttributeValue.trim() || isAddingAttribute}
                                    className="flex-1 py-3 min-h-[44px] text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-md shadow-amber-400/20"
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
