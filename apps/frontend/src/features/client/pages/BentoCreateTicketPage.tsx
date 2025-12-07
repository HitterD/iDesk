import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Paperclip, AlertCircle, Clock, Tag, Monitor, Box, FileText, Save, Trash2, Calendar, Wrench, CheckCircle2, Ticket, HardDrive } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../../stores/useAuth';
import { logger } from '@/lib/logger';

const DRAFT_KEY = 'ticket-draft';

interface TicketDraft {
    title: string;
    description: string;
    priority: string;
    category: string;
    device: string;
    software: string;
    savedAt: string;
}

interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
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

type TicketType = 'none' | 'service' | 'hardware';

export const BentoCreateTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [ticketType, setTicketType] = useState<TicketType>('none');
    const [attributes, setAttributes] = useState<any>({ categories: [], devices: [], software: [] });
    const [showAddModal, setShowAddModal] = useState<{ type: string; show: boolean }>({ type: '', show: false });
    const [newAttributeValue, setNewAttributeValue] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        category: '',
        device: '',
        software: '',
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

    const HARDWARE_TYPES = ['PC', 'IP-Phone', 'Printer'];
    const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'];
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Service Ticket Card */}
                    <button
                        onClick={() => setTicketType('service')}
                        className="group p-8 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-xl hover:shadow-primary/10 transition-all text-left"
                    >
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Ticket className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Service Ticket</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Report issues with hardware, software, network, or request general IT support.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-primary font-medium text-sm">
                            <span>Start Request</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Hardware Installation Card */}
                    <button
                        onClick={() => setTicketType('hardware')}
                        className="group p-8 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 transition-all text-left"
                    >
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <HardDrive className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Hardware Installation</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Schedule installation of PC, IP-Phone, Printer, or other hardware equipment.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-amber-600 font-medium text-sm">
                            <span>Schedule Installation</span>
                            <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 flex gap-4 items-start">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Need Help?</h4>
                        <p className="text-blue-700/80 dark:text-blue-400 text-sm">
                            Choose <strong>Service Ticket</strong> for troubleshooting issues, or <strong>Hardware Installation</strong> to schedule new equipment setup.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Hardware Installation Form
    if (ticketType === 'hardware') {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                                    <HardDrive className="w-5 h-5 text-amber-600" />
                                </div>
                                Hardware Installation
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Schedule your hardware installation appointment</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Main Form Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Hardware Type */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block flex items-center gap-2">
                                <Monitor className="w-4 h-4 text-amber-600" />
                                Hardware Type *
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {HARDWARE_TYPES.map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setHardwareData({ ...hardwareData, hardwareType: type, customHardwareType: '' })}
                                        className={`px-5 py-3 rounded-xl border-2 transition-all font-medium ${hardwareData.hardwareType === type
                                            ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setHardwareData({ ...hardwareData, hardwareType: 'OTHER' })}
                                    className={`px-5 py-3 rounded-xl border-2 transition-all font-medium ${hardwareData.hardwareType === 'OTHER'
                                        ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 text-slate-600 dark:text-slate-400'
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
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500/50 transition-all outline-none text-slate-800 dark:text-white mt-2"
                                    placeholder="Specify hardware type..."
                                />
                            )}
                        </div>

                        {/* Description/Keterangan */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
                                <FileText className="w-4 h-4 text-amber-600" />
                                Keterangan Hardware *
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={hardwareData.description}
                                onChange={(e) => setHardwareData({ ...hardwareData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500/50 transition-all outline-none text-slate-800 dark:text-white placeholder:text-slate-400 resize-none"
                                placeholder="Jelaskan hardware apa yang akan diinstall, lokasi, dan informasi tambahan lainnya..."
                            />
                        </div>

                        {/* Schedule */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Scheduled Date */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-amber-600" />
                                    Installation Date *
                                </label>
                                <input
                                    type="date"
                                    required
                                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                    value={hardwareData.scheduledDate}
                                    onChange={(e) => setHardwareData({ ...hardwareData, scheduledDate: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all outline-none text-slate-800 dark:text-white"
                                />
                            </div>

                            {/* Time Slot */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    Time Slot *
                                </label>
                                <select
                                    required
                                    value={hardwareData.scheduledTime}
                                    onChange={(e) => setHardwareData({ ...hardwareData, scheduledTime: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500/50 transition-all outline-none text-slate-800 dark:text-white cursor-pointer"
                                >
                                    <option value="">Select Time Slot</option>
                                    {TIME_SLOTS.map(slot => (
                                        <option key={slot} value={slot}>{slot} WIB</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Available: 08:00-11:00, 14:00-15:00 (excluding lunch)</p>
                            </div>
                        </div>

                        {/* Important Notice */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10">
                            <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                                <h4 className="font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Important Information
                                </h4>
                                <ul className="text-amber-700 dark:text-amber-400 text-sm space-y-1">
                                    <li>• Please ensure you are available during the scheduled time</li>
                                    <li>• Installation typically takes <strong>2-4 hours</strong></li>
                                    <li>• You will receive reminders 1 day before and on the installation day</li>
                                    <li>• Backup your important data before PC migration</li>
                                </ul>
                            </div>

                            {/* Acknowledgment Checkbox */}
                            <label className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                                <input
                                    type="checkbox"
                                    required
                                    checked={hardwareData.userAcknowledged}
                                    onChange={(e) => setHardwareData({ ...hardwareData, userAcknowledged: e.target.checked })}
                                    className="w-5 h-5 mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                                <div>
                                    <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                                        I Understand and Acknowledge
                                    </span>
                                    <p className="text-sm text-slate-500 mt-1">
                                        I confirm that I will be available on the scheduled date and time for 2-4 hours,
                                        and I have backed up my important data if this involves PC migration.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Attachments */}
                        <div className="p-6">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Attachments (optional)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="file"
                                    multiple
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    {files.length > 0 ? `${files.length} file(s) attached` : 'Attach Files'}
                                </button>
                                {files.length > 0 && (
                                    <p className="text-xs text-slate-400">
                                        {files.map(f => f.name).join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading || !hardwareData.description || !hardwareData.scheduledDate || !hardwareData.scheduledTime || !hardwareData.hardwareType || !hardwareData.userAcknowledged || (hardwareData.hardwareType === 'OTHER' && !hardwareData.customHardwareType)}
                            className="flex items-center gap-2 px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
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
                </form>
            </div>
        );
    }

    // Service Ticket Form (Original form without hardware installation category)
    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                <Ticket className="w-5 h-5 text-blue-600" />
                            </div>
                            Service Ticket
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Submit a support request</p>
                    </div>
                </div>

                {/* Draft indicator */}
                {hasDraft && (
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg">
                            <Save className="w-4 h-4" />
                            Draft saved
                            {lastSaved && (
                                <span className="text-xs text-green-500/70">
                                    ({lastSaved.toLocaleTimeString()})
                                </span>
                            )}
                        </span>
                        <button
                            type="button"
                            onClick={clearDraft}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Clear draft"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Main Form Card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Subject */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Subject
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                            placeholder="Briefly describe the issue..."
                        />
                    </div>

                    {/* Priority Selection - From SLA Config */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-primary" />
                            Priority
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {slaConfigs.map((sla) => {
                                const colors = PRIORITY_COLORS[sla.priority] || PRIORITY_COLORS.LOW;
                                const isSelected = formData.priority === sla.priority;
                                return (
                                    <button
                                        key={sla.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, priority: sla.priority })}
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? `${colors.bg} border-current ${colors.text}`
                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`w-3 h-3 rounded-full ${colors.dot}`}></span>
                                            <span className={`font-bold ${isSelected ? colors.text : 'text-slate-700 dark:text-slate-300'}`}>
                                                {sla.priority}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Clock className="w-3 h-3" />
                                            <span>SLA: {formatDuration(sla.resolutionTimeMinutes)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedSla && (
                            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Expected resolution within <strong>{formatDuration(selectedSla.resolutionTimeMinutes)}</strong>
                            </p>
                        )}
                    </div>

                    {/* Category & Device */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-primary" />
                                    Category
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'CATEGORY', show: true })} className="text-xs text-primary hover:underline">+ Add</button>
                                )}
                            </div>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none text-slate-800 dark:text-white cursor-pointer"
                            >
                                <option value="">Select Category</option>
                                <option value="GENERAL">General</option>
                                <option value="HARDWARE">Hardware</option>
                                <option value="SOFTWARE">Software</option>
                                <option value="NETWORK">Network</option>
                                {attributes.categories?.map((attr: any) => (
                                    <option key={attr.id} value={attr.value}>{attr.value}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <Monitor className="w-4 h-4 text-primary" />
                                    Device
                                </label>
                                {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                    <button type="button" onClick={() => setShowAddModal({ type: 'DEVICE', show: true })} className="text-xs text-primary hover:underline">+ Add</button>
                                )}
                            </div>
                            <select
                                value={formData.device}
                                onChange={(e) => setFormData({ ...formData, device: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none text-slate-800 dark:text-white cursor-pointer"
                            >
                                <option value="">Select Device (optional)</option>
                                {attributes.devices?.map((attr: any) => (
                                    <option key={attr.id} value={attr.value}>{attr.value}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Software */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Box className="w-4 h-4 text-primary" />
                                Software (optional)
                            </label>
                            {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                                <button type="button" onClick={() => setShowAddModal({ type: 'SOFTWARE', show: true })} className="text-xs text-primary hover:underline">+ Add</button>
                            )}
                        </div>
                        <select
                            value={formData.software}
                            onChange={(e) => setFormData({ ...formData, software: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none text-slate-800 dark:text-white cursor-pointer"
                        >
                            <option value="">Select Software</option>
                            {attributes.software?.map((attr: any) => (
                                <option key={attr.id} value={attr.value}>{attr.value}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div className="p-6">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Description</label>
                        <textarea
                            required
                            rows={5}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none text-slate-800 dark:text-white placeholder:text-slate-400 resize-none"
                            placeholder="Please provide detailed information about the issue..."
                        />
                    </div>
                </div>

                {/* Attachments & Submit */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                <Paperclip className="w-4 h-4" />
                                {files.length > 0 ? `${files.length} file(s) attached` : 'Attach Files'}
                            </button>
                            {files.length > 0 && (
                                <p className="text-xs text-slate-400 mt-2">
                                    {files.map(f => f.name).join(', ')}
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !formData.title || !formData.description}
                            className="flex items-center gap-2 px-8 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
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
                    </div>
                </div>
            </form>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 flex gap-4 items-start">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600">
                    <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-1">Tips for faster resolution</h4>
                    <ul className="text-blue-700/80 dark:text-blue-400 text-sm space-y-1">
                        <li>• Provide detailed steps to reproduce the issue</li>
                        <li>• Attach screenshots or error messages if available</li>
                        <li>• Check our Knowledge Base for potential solutions</li>
                    </ul>
                </div>
            </div>

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
