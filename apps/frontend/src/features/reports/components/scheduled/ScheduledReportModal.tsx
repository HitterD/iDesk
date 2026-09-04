import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
    X,
    Clock,
    Users,
    BarChart3,
    FileSpreadsheet,
    Building2,
    Search,
    Check,
    Loader2,
    Info,
    Calendar,
    Send,
    Mail,
    Sparkles
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import {
    ScheduledReportConfig,
    ReportType,
    ScheduleType,
    TargetAgentCategory,
    RecipientUser,
    SiteOption
} from './types';

interface ScheduledReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingConfig: ScheduledReportConfig | null;
    currentSiteId?: string;
    onSave: (payload: {
        name: string;
        reportType: ReportType;
        schedule: ScheduleType;
        sendTime: string;
        siteId: string;
        recipientUserIds: string[];
        targetAgentCategory: TargetAgentCategory;
    }) => void;
    isSaving: boolean;
}

export const ScheduledReportModal: React.FC<ScheduledReportModalProps> = ({
    isOpen,
    onClose,
    editingConfig,
    currentSiteId,
    onSave,
    isSaving,
}) => {
    // Form state
    const [name, setName] = useState('');
    const [reportType, setReportType] = useState<ReportType>('MONTHLY_SUMMARY');
    const [schedule, setSchedule] = useState<ScheduleType>('DAILY');
    const [sendTime, setSendTime] = useState('08:00');
    const [siteId, setSiteId] = useState('');
    const [recipientUserIds, setRecipientUserIds] = useState<string[]>([]);
    const [targetAgentCategory, setTargetAgentCategory] = useState<TargetAgentCategory>(null);

    // UI state
    const [recipientSearch, setRecipientSearch] = useState('');
    const [activeRecipientTab, setActiveRecipientTab] = useState<'ALL' | 'REGULAR' | 'ORACLE'>('ALL');

    // Body scroll lock on open
    useEffect(() => {
        if (isOpen) {
            lockBodyScroll();
            return () => {
                unlockBodyScroll();
            };
        }
    }, [isOpen]);

    // Sync state with editingConfig or defaults when modal opens
    useEffect(() => {
        if (isOpen) {
            if (editingConfig) {
                setName(editingConfig.name || '');
                setReportType(editingConfig.reportType || 'MONTHLY_SUMMARY');
                setSchedule(editingConfig.schedule || 'DAILY');
                setSendTime(editingConfig.sendTime || '08:00');
                setSiteId(editingConfig.siteId || currentSiteId || '');
                setRecipientUserIds([...(editingConfig.recipientUserIds || [])]);
                setTargetAgentCategory(editingConfig.targetAgentCategory || null);
            } else {
                setName('');
                setReportType('MONTHLY_SUMMARY');
                setSchedule('DAILY');
                setSendTime('08:00');
                setSiteId(currentSiteId || '');
                setRecipientUserIds([]);
                setTargetAgentCategory(null);
            }
            setRecipientSearch('');
            setActiveRecipientTab('ALL');
        }
    }, [isOpen, editingConfig, currentSiteId]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !isSaving) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSaving, onClose]);

    // Fetch Active Sites
    const { data: sitesData = [] } = useQuery<SiteOption[]>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
    });

    // Auto-select first site if none selected
    useEffect(() => {
        if (isOpen && !siteId && sitesData.length > 0) {
            setSiteId(sitesData[0].id);
        }
    }, [isOpen, siteId, sitesData]);

    // Fetch Eligible Recipients at the selected site
    const { data: recipientsData, isLoading: recipientsLoading } = useQuery<{
        success: boolean;
        data: RecipientUser[];
    }>({
        queryKey: ['reports', 'scheduled', 'recipients', siteId],
        queryFn: async () => {
            if (!siteId) return { success: true, data: [] };
            const response = await api.get(`/reports/scheduled/recipients?siteId=${encodeURIComponent(siteId)}`);
            return response.data;
        },
        enabled: isOpen && !!siteId,
        staleTime: 60000,
    });

    const siteUsers = useMemo(() => recipientsData?.data || [], [recipientsData]);

    const regularAgents = useMemo(
        () => siteUsers.filter((u) => u.role !== 'AGENT_ORACLE'),
        [siteUsers]
    );
    const oracleAgents = useMemo(
        () => siteUsers.filter((u) => u.role === 'AGENT_ORACLE'),
        [siteUsers]
    );

    // Filter agents by search query & tab
    const filteredAgents = useMemo(() => {
        let list = siteUsers;
        if (activeRecipientTab === 'REGULAR') {
            list = regularAgents;
        } else if (activeRecipientTab === 'ORACLE') {
            list = oracleAgents;
        }

        if (!recipientSearch.trim()) return list;

        const q = recipientSearch.toLowerCase();
        return list.filter(
            (u) =>
                u.fullName.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q)
        );
    }, [siteUsers, regularAgents, oracleAgents, activeRecipientTab, recipientSearch]);

    // Toggle single recipient
    const toggleRecipient = (userId: string) => {
        setRecipientUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    // Bulk selection helpers
    const selectAllInList = (users: RecipientUser[]) => {
        const idsToAdd = users.map((u) => u.id);
        setRecipientUserIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    };

    const clearAllInList = (users: RecipientUser[]) => {
        const idsToRemove = new Set(users.map((u) => u.id));
        setRecipientUserIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!siteId) return;
        if (recipientUserIds.length === 0) return;

        onSave({
            name: name.trim(),
            reportType,
            schedule,
            sendTime,
            siteId,
            recipientUserIds,
            targetAgentCategory: reportType === 'AGENT_PERFORMANCE' ? targetAgentCategory : null,
        });
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-hidden animate-fade-in">
            {/* Full-screen Frosted Dark Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Card - Responsive 2-Column Desktop Layout */}
            <div className="relative w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-in">
                {/* Header (Fixed Non-Scrolling) */}
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                {editingConfig ? 'Edit Scheduled Report' : 'New Scheduled Report'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Configure recurring report frequency and recipient agents for automated dispatch.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Container with 2-Column Split */}
                <form
                    id="scheduled-report-form"
                    onSubmit={handleSubmit}
                    className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 custom-scrollbar"
                >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        {/* LEFT COLUMN: Report Config & Schedule (5 cols) */}
                        <div className="md:col-span-5 space-y-4">
                            {/* Schedule Name */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Schedule Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Daily Summary — Sepanjang"
                                    required
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                />
                            </div>

                            {/* Target Site */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                    Target Site <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <select
                                        value={siteId}
                                        onChange={(e) => {
                                            setSiteId(e.target.value);
                                            setRecipientUserIds([]); // Reset on site change
                                        }}
                                        required
                                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    >
                                        <option value="" disabled>Select target site...</option>
                                        {sitesData.map((s) => (
                                             <option key={s.id} value={s.id}>
                                                {s.code} — {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Info className="w-3 h-3 text-slate-400 shrink-0" />
                                    Data & recipients are strictly site-isolated.
                                </p>
                            </div>

                            {/* Report Type Tiles */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                                    Report Type <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-2">
                                    {[
                                        {
                                            type: 'MONTHLY_SUMMARY' as ReportType,
                                            label: 'Monthly Summary',
                                            desc: 'Volume & performance overview',
                                            icon: FileSpreadsheet,
                                            color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60',
                                        },
                                        {
                                            type: 'AGENT_PERFORMANCE' as ReportType,
                                            label: 'Agent Performance',
                                            desc: 'Resolution rates, SLA & workload',
                                            icon: Users,
                                            color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60',
                                        },
                                        {
                                            type: 'TICKET_VOLUME' as ReportType,
                                            label: 'Ticket Volume',
                                            desc: 'Daily trends & category distribution',
                                            icon: BarChart3,
                                            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
                                        },
                                    ].map((item) => {
                                        const isSelected = reportType === item.type;
                                        const ItemIcon = item.icon;
                                        return (
                                            <button
                                                key={item.type}
                                                type="button"
                                                onClick={() => setReportType(item.type)}
                                                className={cn(
                                                    "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all duration-150",
                                                    isSelected
                                                        ? "border-primary bg-primary/5 dark:bg-primary/20 shadow-xs ring-1 ring-primary/40"
                                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                                                        <ItemIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                            {item.label}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                            {item.desc}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0 ml-2">
                                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Target Category (Agent Performance Only) */}
                                {reportType === 'AGENT_PERFORMANCE' && (
                                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 animate-fade-in">
                                        <label className="block text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Agent Category Filter:
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { key: null, label: 'All' },
                                                { key: 'REGULAR' as TargetAgentCategory, label: 'Regular' },
                                                { key: 'ORACLE' as TargetAgentCategory, label: 'Oracle' },
                                            ].map((opt) => (
                                                <button
                                                    key={String(opt.key)}
                                                    type="button"
                                                    onClick={() => setTargetAgentCategory(opt.key)}
                                                    className={cn(
                                                        "py-1 text-[11px] font-semibold rounded-lg border text-center transition-colors",
                                                        targetAgentCategory === opt.key
                                                            ? "bg-primary text-white border-primary shadow-xs"
                                                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Frequency & Send Time */}
                            <div className="space-y-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Frequency Cadence <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {[
                                            { value: 'DAILY' as ScheduleType, label: 'Daily' },
                                            { value: 'WEEKLY' as ScheduleType, label: 'Weekly (Mon)' },
                                            { value: 'MONTHLY' as ScheduleType, label: 'Monthly (1st)' },
                                        ].map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() => setSchedule(item.value)}
                                                className={cn(
                                                    "py-1.5 px-2 rounded-xl border text-center transition-all",
                                                    schedule === item.value
                                                        ? "border-primary bg-primary/10 dark:bg-primary/20 text-primary font-bold ring-1 ring-primary/30"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                                                )}
                                            >
                                                <div className="text-[11px]">{item.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                                        Send Time <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            <input
                                                type="time"
                                                value={sendTime}
                                                onChange={(e) => setSendTime(e.target.value)}
                                                required
                                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                            />
                                        </div>
                                        <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                            WIB
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Recipient Selector (7 cols) */}
                        <div className="md:col-span-7 flex flex-col space-y-3 bg-slate-50/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                            {/* Recipients Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Recipients (Site Agents) <span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                        Choose active agents who will receive email dispatches.
                                    </p>
                                </div>
                                <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors",
                                    recipientUserIds.length > 0
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                )}>
                                    {recipientUserIds.length} Selected
                                </span>
                            </div>

                            {/* Search Box */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={recipientSearch}
                                    onChange={(e) => setRecipientSearch(e.target.value)}
                                    placeholder="Filter agents by name or email..."
                                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                {recipientSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setRecipientSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Segment Tabs & Quick Actions */}
                            <div className="flex items-center justify-between text-xs pt-0.5">
                                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setActiveRecipientTab('ALL')}
                                        className={cn(
                                            "px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors",
                                            activeRecipientTab === 'ALL'
                                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        )}
                                    >
                                        All ({siteUsers.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveRecipientTab('REGULAR')}
                                        className={cn(
                                            "px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors",
                                            activeRecipientTab === 'REGULAR'
                                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        )}
                                    >
                                        Regular ({regularAgents.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveRecipientTab('ORACLE')}
                                        className={cn(
                                            "px-2 py-0.5 text-[11px] rounded-md font-medium transition-colors",
                                            activeRecipientTab === 'ORACLE'
                                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold"
                                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                        )}
                                    >
                                        Oracle ({oracleAgents.length})
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => selectAllInList(filteredAgents)}
                                        className="text-[11px] font-semibold text-primary hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <button
                                        type="button"
                                        onClick={() => clearAllInList(filteredAgents)}
                                        className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Agent Items List */}
                            <div className="h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-1.5 space-y-1 bg-white dark:bg-slate-950 shadow-inner custom-scrollbar">
                                {recipientsLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary mb-1.5" />
                                        <span className="text-xs">Loading site agents...</span>
                                    </div>
                                ) : filteredAgents.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                                        {recipientSearch
                                            ? `No agents matching "${recipientSearch}"`
                                            : siteId
                                            ? 'No active agents found at this site.'
                                            : 'Please select a target site first.'}
                                    </div>
                                ) : (
                                    filteredAgents.map((u) => {
                                        const isSelected = recipientUserIds.includes(u.id);
                                        const isOracle = u.role === 'AGENT_ORACLE';

                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => toggleRecipient(u.id)}
                                                className={cn(
                                                    "px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all duration-100 select-none",
                                                    isSelected
                                                        ? "bg-primary/5 dark:bg-primary/20 border-primary/40 dark:border-primary/50 shadow-xs"
                                                        : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {/* Checkbox Icon */}
                                                    <div
                                                        className={cn(
                                                            "w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0",
                                                            isSelected
                                                                ? "bg-primary border-primary text-white"
                                                                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                                        )}
                                                    >
                                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>

                                                    {/* Avatar */}
                                                    <UserAvatar
                                                        user={{
                                                            id: u.id,
                                                            fullName: u.fullName,
                                                            avatarUrl: u.avatarUrl || undefined,
                                                        }}
                                                        size="xs"
                                                    />

                                                    {/* Agent Info */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                                {u.fullName}
                                                            </span>
                                                            <span
                                                                className={cn(
                                                                    "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider",
                                                                    isOracle
                                                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                                                                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                                                                    )}
                                                            >
                                                                {isOracle ? 'Oracle' : 'Regular'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                                                            {u.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer (Fixed Non-Scrolling) */}
                <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
                    <div className="text-xs">
                        {recipientUserIds.length > 0 ? (
                            <span className="text-slate-600 dark:text-slate-400">
                                Ready to dispatch to <strong className="text-primary font-bold">{recipientUserIds.length}</strong> site agent{recipientUserIds.length !== 1 ? 's' : ''}.
                            </span>
                        ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                <Info className="w-3.5 h-3.5" /> Please select at least 1 recipient
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="scheduled-report-form"
                            disabled={isSaving || !name.trim() || !siteId || recipientUserIds.length === 0}
                            className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                        >
                            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{editingConfig ? 'Save Changes' : 'Create Schedule'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
