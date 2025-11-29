import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Paperclip, AlertCircle, Clock, Tag, Monitor, Box, FileText, Save, Trash2 } from 'lucide-react';
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

export const BentoCreateTicketPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
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
                toast.info('Draft restored', { description: 'Your previous unsaved ticket has been restored.' });
            }
        } catch (error) {
            logger.error('Failed to load draft:', error);
        }
        fetchAttributes();
    }, []);

    // Auto-save draft every 10 seconds when form has content
    const saveDraft = useCallback(() => {
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
    }, [formData]);

    // Auto-save on form change (debounced)
    useEffect(() => {
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
    }, [formData, saveDraft]);

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
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('priority', formData.priority);
            formDataToSend.append('category', formData.category);
            if (formData.device) formDataToSend.append('device', formData.device);
            if (formData.software) formDataToSend.append('software', formData.software);

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
            
            toast.success('Ticket created successfully!');
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

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Create New Ticket</h1>
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
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                            isSelected 
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
