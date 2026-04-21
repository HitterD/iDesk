import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Paperclip, AlertCircle, Clock, Tag, Monitor, Box, FileText, Save, Trash2, Calendar, CheckCircle2, Ticket, HardDrive, DollarSign, PackageX, Wifi } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../../stores/useAuth';
import { logger } from '@/lib/logger';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { IctBudgetForm } from '@/features/ticket-board/components/IctBudgetForm';
import { LostItemForm } from '@/features/ticket-board/components/LostItemForm';
import { AccessRequestForm } from '@/features/ticket-board/components/AccessRequestForm';
import { useAvailableSlots } from '@/features/request-center/api/schedule.api';

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

interface TicketAttributes {
    categories: string[];
    devices: string[];
    software: string[];
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

export const BentoCreateTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [ticketType, setTicketType] = useState<TicketType>('none');
    const [attributes, setAttributes] = useState<TicketAttributes>({ categories: [], devices: [], software: [] });
    const [showAddModal, setShowAddModal] = useState<{ type: string; show: boolean }>({ type: '', show: false });
    const [newAttributeValue, setNewAttributeValue] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        category: '',
        device: '',
        software: '',
        criticalReason: '',
    });

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
        }, 3000); // Auto-save after 3 seconds of inactivity

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
            setAttributes(res.data);
        } catch (error) {
            logger.error('Failed to fetch attributes:', error);
        }
    };

    const handleAddAttribute = async () => {
        if (!newAttributeValue.trim()) return;
        try {
            await api.post('/ticket-attributes', { type: showAddModal.type, value: newAttributeValue });
            toast.success('Attribute added successfully');
            setNewAttributeValue('');
            setShowAddModal({ type: '', show: false });
            fetchAttributes();
        } catch (error: any) {
            logger.error('Failed to add attribute:', error);
            toast.error(error.response?.data?.message || 'Failed to add attribute');
        }
    };

    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const selectedSla = slaConfigs.find(s => s.priority === formData.priority);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

            // Clear draft on successful submission
            localStorage.removeItem(DRAFT_KEY);

            toast.success(ticketType === 'hardware' ? 'Hardware Installation scheduled!' : 'Ticket created successfully!');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
                navigate('/tickets/list');
            } else {
                navigate('/client/my-tickets');
            }
        } catch (error) {
            logger.error('Failed to create ticket:', error);
            toast.error('Failed to create ticket. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

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

        return (
            <div className="w-full max-w-5xl xl:max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Create New Ticket</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Choose the type of request</p>
                    </div>
                </div>

                {/* Ticket Type Selection Cards (Refined Industrial) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Service Ticket Card */}
                    <button
                        onClick={() => setTicketType('service')}
                        className="group flex flex-col p-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-left relative overflow-hidden"
                    >
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors relative z-10">
                            <Ticket className="w-7 h-7 text-primary" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-2 tracking-tight relative z-10">Service Ticket</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%] mb-6 relative z-10">
                            Report issues with hardware, software, network, or general IT support.
                        </p>
                        <div className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold group-hover:bg-primary group-hover:text-slate-900 transition-colors relative z-10 w-fit">
                            <span>Start Request</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>

                    {/* Hardware Request Card */}
                    <button
                        onClick={() => navigate(`${getBasePath()}/hardware-requests`)}
                        className="group flex flex-col p-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-left relative overflow-hidden"
                    >
                        <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-colors relative z-10">
                            <DollarSign className="w-7 h-7 text-emerald-500" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-2 tracking-tight relative z-10">Hardware & Budget</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%] mb-6 relative z-10">
                            Ajukan pembelian barang IT baru (Procurement).
                        </p>
                        <div className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-bold group-hover:bg-emerald-500 group-hover:text-white transition-colors relative z-10 w-fit">
                            <span>Create Request</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>

                    {/* Lost Item Card */}
                    <button
                        onClick={() => navigate(`${getBasePath()}/lost-items`)}
                        className="group flex flex-col p-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-rose-500/50 hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-left relative overflow-hidden"
                    >
                        <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center mb-5 group-hover:bg-rose-500/20 transition-colors relative z-10">
                            <PackageX className="w-7 h-7 text-rose-500" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-2 tracking-tight relative z-10">Lost Item Report</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%] mb-6 relative z-10">
                            Report lost laptop, phone, ID card, keys, or other items.
                        </p>
                        <div className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/5 text-rose-600 dark:text-rose-400 text-xs font-bold group-hover:bg-rose-500 group-hover:text-white transition-colors relative z-10 w-fit">
                            <span>Report Item</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>

                    {/* Access Request Card (Now Sky Blue) */}
                    <button
                        onClick={() => navigate(`${getBasePath()}/eform-access/new`)}
                        className="group flex flex-col p-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-sky-500/50 hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-left relative overflow-hidden"
                    >
                        <div className="w-14 h-14 rounded-xl bg-sky-500/10 flex items-center justify-center mb-5 group-hover:bg-sky-500/20 transition-colors relative z-10">
                            <Wifi className="w-7 h-7 text-sky-500" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-2 tracking-tight relative z-10">Access Request</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%] mb-6 relative z-10">
                            Request WiFi, VPN, or website access with approval form.
                        </p>
                        <div className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500/5 text-sky-600 dark:text-sky-400 text-xs font-bold group-hover:bg-sky-500 group-hover:text-white transition-colors relative z-10 w-fit">
                            <span>Request Access</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>

                    {/* Oracle/K2 Card */}
                    <button
                        onClick={() => setTicketType('oracle-request')}
                        className="group flex flex-col p-7 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-cyan-600/50 hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out text-left relative overflow-hidden"
                    >
                        <div className="w-14 h-14 rounded-xl bg-cyan-600/10 flex items-center justify-center mb-5 group-hover:bg-cyan-600/20 transition-colors relative z-10">
                            <Box className="w-7 h-7 text-cyan-600" />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-2 tracking-tight relative z-10">Oracle / K2 Request</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%] mb-6 relative z-10">
                            Request Oracle system assistance, K2 role updates, or ERP issues.
                        </p>
                        <div className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-600/5 text-cyan-600 dark:text-cyan-400 text-xs font-bold group-hover:bg-cyan-600 group-hover:text-white transition-colors relative z-10 w-fit">
                            <span>Request Support</span>
                            <ArrowLeft className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>
                </div>

                {/* Info Guidance Strip */}
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex gap-4 items-center shadow-sm">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">Select the most relevant ticket type</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                            Each ticket type routes to a specialized team. If unsure, default to <span className="font-semibold text-slate-700 dark:text-slate-300">Service Ticket</span> for general IT support.
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
                        onClick={handleBack}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
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
                                    <input
                                        type="text"
                                        required
                                        value={hardwareData.customHardwareType}
                                        onChange={(e) => setHardwareData({ ...hardwareData, customHardwareType: e.target.value })}
                                        className="w-full mt-3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm text-slate-800 dark:text-white"
                                        placeholder="Specify hardware type..."
                                    />
                                )}
                            </div>

                            {/* Description - Auto Expand */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                    <FileText className="w-4 h-4 text-emerald-500" /> Keterangan Hardware *
                                </label>
                                <textarea
                                    required
                                    value={hardwareData.description}
                                    onChange={(e) => {
                                        setHardwareData({ ...hardwareData, description: e.target.value });
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px';
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm resize-none min-h-[100px] text-slate-800 dark:text-white"
                                    placeholder="Jelaskan detail hardware, lokasi spesifik, atau instruksi instalasi..."
                                />
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
                                    onChange={(date) => setHardwareData({ ...hardwareData, scheduledDate: format(date, 'yyyy-MM-dd') })}
                                    placeholder="Select optimal date"
                                    minDate={new Date(Date.now() + 86400000)}
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
                        onClick={handleBack}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
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
                        onClick={handleBack}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
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
                        onClick={handleBack}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
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
                            <ArrowLeft className="w-5 h-5" />
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
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                <FileText className="w-4 h-4 text-cyan-500" /> Subject / Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/40 outline-none transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm font-medium text-slate-800 dark:text-white"
                                placeholder="E.g., Account Locked, Role Missing, Transaction Failed"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                <FileText className="w-4 h-4 text-cyan-500" /> Detail Kebutuhan / Error *
                            </label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData({ ...formData, description: e.target.value });
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(120, e.target.scrollHeight) + 'px';
                                }}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/40 outline-none transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm resize-none min-h-[120px] text-slate-800 dark:text-white leading-relaxed"
                                placeholder="Tuliskan secara lengkap error atau kebutuhan spesifik sistem. Lampirkan URL atau Error Code jika tersedia..."
                            />
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
                        onClick={handleBack}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
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
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                                <FileText className="w-4 h-4 text-amber-500" />
                                Subject *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/30 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-sm"
                                placeholder="Summary of the issue..."
                            />
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 block flex items-center gap-1.5 uppercase tracking-wide">
                                <FileText className="w-4 h-4 text-amber-500" />
                                Description *
                            </label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData({ ...formData, description: e.target.value });
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(140, e.target.scrollHeight) + 'px';
                                }}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/30 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 shadow-sm resize-none min-h-[140px] leading-relaxed"
                                placeholder="Include any error message, exact steps leading to the issue, or other context..."
                                style={{ height: 'auto', minHeight: '140px' }}
                            />
                        </div>

                        {/* File Upload Region */}
                        <div>
                            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-[60px] flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 font-semibold text-sm transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                            >
                                <Paperclip className="w-5 h-5" />
                                {files.length > 0 ? `${files.length} file(s) attached` : 'Drop files here or Click to attach'}
                            </button>
                            {files.length > 0 && (
                                <p className="text-[11px] font-medium text-slate-500 mt-2 truncate max-w-full italic">{files.map(f => f.name).join(', ')}</p>
                            )}
                        </div>
                    </div>

                    {/* CENTER COLUMN - Classification (3 cols) */}
                    <div className="lg:col-span-3 space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                                    <Tag className="w-4 h-4 text-amber-500" /> Category
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-amber-100">+ Add</button>
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
                                    {attributes.categories?.map((attr: any) => (
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
                                    <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-amber-100">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.device} onValueChange={(value) => setFormData({ ...formData, device: value })}>
                                <SelectTrigger className="w-full h-12 px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose device (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 font-medium">
                                    {attributes.devices?.map((attr: any) => (
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
                                    <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider hover:bg-amber-100">+ Add</button>
                                )}
                            </div>
                            <Select value={formData.software} onValueChange={(value) => setFormData({ ...formData, software: value })}>
                                <SelectTrigger className="w-full h-12 px-4 py-3 text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500/30">
                                    <SelectValue placeholder="Choose app (optional)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 font-medium">
                                    {attributes.software?.map((attr: any) => (
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
                                {slaConfigs.map((sla) => {
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
                                })}
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
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl w-[400px] border border-slate-200 dark:border-slate-700 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Add New {showAddModal.type}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">{showAddModal.type} Name</label>
                                <input
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
                                    onClick={() => setShowAddModal({ type: '', show: false })}
                                    className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAttribute}
                                    disabled={!newAttributeValue.trim()}
                                    className="flex-1 py-3 text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-md shadow-amber-400/20"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
