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

type TicketType = 'none' | 'service' | 'hardware' | 'ict-budget' | 'lost-item' | 'access-request';

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
    const TIME_SLOTS = schedulingConfig?.timeSlots ?? DEFAULT_TIME_SLOTS;

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
                setTicketType('service'); // Auto-select service if draft exists
                toast.info('Draft restored', { description: 'Your previous unsaved ticket has been restored.' });
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
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Create New Ticket</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Choose the type of request</p>
                    </div>
                </div>

                {/* Ticket Type Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Service Ticket Card */}
                    <button
                        onClick={() => setTicketType('service')}
                        className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all text-left"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Ticket className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Service Ticket</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Report issues with hardware, software, network, or general IT support.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-primary font-medium text-sm">
                            <span>Start Request</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Hardware Installation Card */}
                    <button
                        onClick={() => setTicketType('hardware')}
                        className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 transition-all text-left"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <HardDrive className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Hardware Installation</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Schedule installation of PC, IP-Phone, Printer, or other equipment.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-amber-600 font-medium text-sm">
                            <span>Schedule</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* ICT Budget Card */}
                    <button
                        onClick={() => setTicketType('ict-budget')}
                        className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all text-left"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <DollarSign className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">ICT Budget</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Request realization for hardware purchase, license, or renewal.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-emerald-600 font-medium text-sm">
                            <span>Request Budget</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Lost Item Report Card */}
                    <button
                        onClick={() => setTicketType('lost-item')}
                        className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-red-500 hover:shadow-xl hover:shadow-red-500/10 transition-all text-left"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <PackageX className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Lost Item Report</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Report lost laptop, phone, ID card, keys, or other items.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-red-600 font-medium text-sm">
                            <span>Report Lost Item</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Access Request Card */}
                    <button
                        onClick={() => setTicketType('access-request')}
                        className="group p-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 transition-all text-left"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Wifi className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Access Request</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Request WiFi, VPN, or website access with approval form.
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-purple-600 font-medium text-sm">
                            <span>Request Access</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                </div>

                {/* Info Banner */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex gap-4 items-start">
                    <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Pilih jenis permintaan yang sesuai</h4>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            <strong>Service Ticket</strong> untuk masalah teknis • <strong>ICT Budget</strong> untuk pengadaan • <strong>Lost Item</strong> untuk kehilangan barang • <strong>Access Request</strong> untuk permintaan akses WiFi/VPN
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Hardware Installation Form
    if (ticketType === 'hardware') {
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
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                                <HardDrive className="w-4 h-4 text-amber-600" />
                            </div>
                            Hardware Installation
                        </h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Main Form - 3 Column Grid */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                            {/* LEFT COLUMN - Hardware Type + Description (5 cols) */}
                            <div className="lg:col-span-5 space-y-4">
                                {/* Hardware Type */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block flex items-center gap-1">
                                        <Monitor className="w-3.5 h-3.5 text-amber-600" /> Hardware Type *
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {HARDWARE_TYPES.map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setHardwareData({ ...hardwareData, hardwareType: type, customHardwareType: '' })}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${hardwareData.hardwareType === type
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setHardwareData({ ...hardwareData, hardwareType: 'OTHER' })}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${hardwareData.hardwareType === 'OTHER'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
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
                                            className="w-full mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                                            placeholder="Specify hardware type..."
                                        />
                                    )}
                                </div>

                                {/* Description - Auto Expand */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
                                        <FileText className="w-3.5 h-3.5 text-amber-600" /> Keterangan Hardware *
                                    </label>
                                    <textarea
                                        required
                                        value={hardwareData.description}
                                        onChange={(e) => {
                                            setHardwareData({ ...hardwareData, description: e.target.value });
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.max(80, e.target.scrollHeight) + 'px';
                                        }}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm resize-none min-h-[80px]"
                                        placeholder="Jelaskan hardware yang akan diinstall, lokasi..."
                                    />
                                </div>

                                {/* Attachments */}
                                <div>
                                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200"
                                    >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        {files.length > 0 ? `${files.length} file(s)` : 'Attach Files'}
                                    </button>
                                </div>
                            </div>

                            {/* CENTER COLUMN - Schedule (3 cols) */}
                            <div className="lg:col-span-3 space-y-4">
                                {/* Installation Date */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-amber-600" /> Installation Date *
                                    </label>
                                    <ModernDatePicker
                                        value={hardwareData.scheduledDate ? parseISO(hardwareData.scheduledDate) : undefined}
                                        onChange={(date) => setHardwareData({ ...hardwareData, scheduledDate: format(date, 'yyyy-MM-dd') })}
                                        placeholder="Select date"
                                        minDate={new Date(Date.now() + 86400000)}
                                        triggerClassName="w-full py-2.5 text-sm bg-slate-50 dark:bg-slate-900"
                                    />
                                </div>

                                {/* Time Slot */}
                                <div>
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Time Slot *
                                    </label>
                                    <Select value={hardwareData.scheduledTime} onValueChange={(value) => setHardwareData({ ...hardwareData, scheduledTime: value })}>
                                        <SelectTrigger className="w-full px-3 py-2.5 h-auto text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl">
                                            <SelectValue placeholder="Select Time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_SLOTS.map(slot => (
                                                <SelectItem key={slot} value={slot}>{slot} WIB</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-500 mt-1">08:00-11:00, 14:00-15:00</p>
                                </div>
                            </div>

                            {/* RIGHT COLUMN - Info + Acknowledge + Submit (4 cols) */}
                            <div className="lg:col-span-4 space-y-4">
                                {/* Important Info - Compact */}
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                                    <h4 className="font-bold text-amber-700 dark:text-amber-400 text-xs mb-1.5 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" /> Important
                                    </h4>
                                    <ul className="text-[10px] text-amber-600 dark:text-amber-300 space-y-0.5">
                                        <li>• Be available on scheduled time</li>
                                        <li>• Installation: 2-4 hours</li>
                                        <li>• Backup data before PC migration</li>
                                    </ul>
                                </div>

                                {/* Acknowledgment */}
                                <label className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-amber-500">
                                    <input
                                        type="checkbox"
                                        required
                                        checked={hardwareData.userAcknowledged}
                                        onChange={(e) => setHardwareData({ ...hardwareData, userAcknowledged: e.target.checked })}
                                        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-amber-600"
                                    />
                                    <div>
                                        <span className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                                            I Understand
                                        </span>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            I will be available 2-4 hours and have backed up my data.
                                        </p>
                                    </div>
                                </label>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading || !hardwareData.description || !hardwareData.scheduledDate || !hardwareData.scheduledTime || !hardwareData.hardwareType || !hardwareData.userAcknowledged || (hardwareData.hardwareType === 'OTHER' && !hardwareData.customHardwareType)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Scheduling...
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-4 h-4" />
                                            Schedule Installation
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
                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                            <Wifi className="w-4 h-4 text-purple-600" />
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

    // Service Ticket Form - Landscape 3-Column Layout
    const QUICK_TEMPLATES = [
        { label: 'Email Issue', category: 'SOFTWARE', priority: 'HIGH', subject: 'Email tidak bisa diakses', description: 'Tidak dapat mengirim/menerima email. Error message: ' },
        { label: 'Printer Problem', category: 'HARDWARE', priority: 'MEDIUM', subject: 'Printer tidak bisa print', description: 'Printer tidak merespon. Sudah dicoba restart. Model printer: ' },
        { label: 'Slow PC', category: 'HARDWARE', priority: 'LOW', subject: 'Komputer lemot/lambat', description: 'PC sangat lambat saat bekerja. Sudah restart tapi masih sama. ' },
        { label: 'Network Issue', category: 'NETWORK', priority: 'HIGH', subject: 'Tidak bisa akses jaringan/internet', description: 'Tidak ada koneksi internet. Sudah cek kabel. ' },
        { label: 'SAP Error', category: 'SOFTWARE', priority: 'CRITICAL', subject: 'SAP Error - tidak bisa transaksi', description: 'SAP menampilkan error saat transaksi. Error code: ' },
        { label: 'Cannot Login', category: 'GENERAL', priority: 'MEDIUM', subject: 'Tidak bisa login ke aplikasi', description: 'Lupa password / account terkunci. Nama aplikasi: ' },
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
        <div className="w-full max-w-7xl mx-auto space-y-4">
            {/* Header - Compact */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                <Ticket className="w-4 h-4 text-blue-600" />
                            </div>
                            Service Ticket
                        </h1>
                    </div>
                </div>

                {/* Draft indicator */}
                {hasDraft && (
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                            <Save className="w-3 h-3" />
                            Draft
                        </span>
                        <button type="button" onClick={clearDraft} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Templates - Horizontal Scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <span className="text-xs text-slate-500 whitespace-nowrap self-center mr-1">Quick:</span>
                {QUICK_TEMPLATES.map((tpl, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap border border-slate-200 dark:border-slate-700"
                    >
                        {tpl.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                {/* Main Form - 3 Column Grid (Desktop) / Stack (Mobile) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

                        {/* LEFT COLUMN - Subject & Description (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                            {/* Subject */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-primary" />
                                    Subject *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Briefly describe the issue..."
                                />
                            </div>

                            {/* Description - Auto Expand */}
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">Description *</label>
                                <textarea
                                    required
                                    value={formData.description}
                                    onChange={(e) => {
                                        setFormData({ ...formData, description: e.target.value });
                                        // Auto-expand
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.max(100, e.target.scrollHeight) + 'px';
                                    }}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 resize-none min-h-[100px]"
                                    placeholder="Provide detailed information about the issue..."
                                    style={{ height: 'auto', minHeight: '100px' }}
                                />
                            </div>

                            {/* Attachments */}
                            <div>
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    {files.length > 0 ? `${files.length} file(s)` : 'Attach Files'}
                                </button>
                                {files.length > 0 && (
                                    <p className="text-[10px] text-slate-400 mt-1 truncate">{files.map(f => f.name).join(', ')}</p>
                                )}
                            </div>
                        </div>

                        {/* CENTER COLUMN - Category, Device, Software (3 cols) */}
                        <div className="lg:col-span-3 space-y-4">
                            {/* Category */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        <Tag className="w-3.5 h-3.5 text-primary" /> Category
                                    </label>
                                    {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                        <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-[10px] text-primary hover:underline">+ Add</button>
                                    )}
                                </div>
                                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                    <SelectTrigger className="w-full px-3 py-2.5 h-auto text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
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

                            {/* Device */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        <Monitor className="w-3.5 h-3.5 text-primary" /> Device
                                    </label>
                                    {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                        <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-[10px] text-primary hover:underline">+ Add</button>
                                    )}
                                </div>
                                <Select value={formData.device} onValueChange={(value) => setFormData({ ...formData, device: value })}>
                                    <SelectTrigger className="w-full px-3 py-2.5 h-auto text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl">
                                        <SelectValue placeholder="Select Device (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {attributes.devices?.map((attr: any) => (
                                            <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Software */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        <Box className="w-3.5 h-3.5 text-primary" /> Software
                                    </label>
                                    {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                        <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-[10px] text-primary hover:underline">+ Add</button>
                                    )}
                                </div>
                                <Select value={formData.software} onValueChange={(value) => setFormData({ ...formData, software: value })}>
                                    <SelectTrigger className="w-full px-3 py-2.5 h-auto text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl">
                                        <SelectValue placeholder="Select Software (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {attributes.software?.map((attr: any) => (
                                            <SelectItem key={attr.id} value={attr.value}>{attr.value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* RIGHT COLUMN - Priority & Submit (4 cols) */}
                        <div className="lg:col-span-4 space-y-4">
                            {/* Priority Cards - 2x2 Grid Desktop, 4 cols Mobile */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-primary" /> Priority
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {slaConfigs.map((sla) => {
                                        const colors = PRIORITY_COLORS[sla.priority] || PRIORITY_COLORS.LOW;
                                        const isSelected = formData.priority === sla.priority;
                                        return (
                                            <button
                                                key={sla.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: sla.priority })}
                                                className={`p-2.5 rounded-xl border-2 transition-all text-left ${isSelected
                                                    ? `${colors.bg} border-current ${colors.text}`
                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                                                    <span className={`font-bold text-xs ${isSelected ? colors.text : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {sla.priority}
                                                    </span>
                                                </div>
                                                {/* SLA time only visible for Admin/Agent */}
                                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        <span>{formatDuration(sla.resolutionTimeMinutes)}</span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* SLA resolution time only visible for Admin/Agent */}
                                {selectedSla && (user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Resolution: <strong>{formatDuration(selectedSla.resolutionTimeMinutes)}</strong>
                                    </p>
                                )}
                            </div>

                            {/* Critical Reason */}
                            {formData.priority === 'CRITICAL' && (
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                                    <label className="text-xs font-bold text-red-600 mb-1.5 block flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" /> Alasan Kritikalitas *
                                    </label>
                                    <textarea
                                        required
                                        rows={2}
                                        value={formData.criticalReason}
                                        onChange={(e) => setFormData({ ...formData, criticalReason: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 rounded-lg text-xs focus:ring-2 focus:ring-red-500/50 outline-none resize-none"
                                        placeholder="Jelaskan mengapa harus segera ditangani..."
                                    />
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !formData.title || !formData.description || (formData.priority === 'CRITICAL' && !formData.criticalReason)}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Submit Ticket
                                    </>
                                )}
                            </button>

                            {/* Tips - Compact */}
                            <div className="text-[10px] text-slate-500 space-y-0.5">
                                <p>💡 Sertakan error message jika ada</p>
                                <p>📷 Attach screenshot untuk masalah visual</p>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            {/* Add Attribute Modal */}
            {showAddModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-96 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add New {showAddModal.type}</h3>
                        <input
                            type="text"
                            value={newAttributeValue}
                            onChange={(e) => setNewAttributeValue(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder={`Enter new ${showAddModal.type.toLowerCase()}`}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAttribute()}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowAddModal({ type: '', show: false })}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAttribute}
                                className="px-4 py-2 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
