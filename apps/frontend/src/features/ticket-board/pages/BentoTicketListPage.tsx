import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Columns3,
    TableProperties,
    UserCheck,
    Search,
    Clock,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    MessageSquare,
    X,
    ChevronRight,
    Inbox,
    TrendingUp,
    Flame,
    Calendar,
    RefreshCw,
    Plus,
    Ticket,
    Filter,
    ChevronDown,
    Check,
    Download
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { toast } from 'sonner';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Agent } from '../components/ticket-detail/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { format } from 'date-fns';
import { SavedFiltersDropdown } from '@/components/ui/SavedFiltersDropdown';
import { useSavedFilters, SavedFilter } from '@/hooks/useSavedFilters';
import { ExportMenu } from '@/components/ui/ExportMenu';

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    category: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
    source: 'WEB' | 'TELEGRAM' | 'EMAIL';
    isOverdue: boolean;
    slaTarget?: string;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
    user: {
        id?: string;
        fullName: string;
        role: string;
        email?: string;
        avatarUrl?: string;
        department?: {
            name: string;
        };
    };
    messages?: any[];
}

const StatsCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bgColor: string;
    highlight?: boolean;
}> = ({ icon: Icon, label, value, color, bgColor, highlight }) => (
    <div className={cn(
        "glass-card p-4 hover:glass-shadow-medium transition-all duration-300",
        highlight && value > 0 && "ring-2 ring-red-500/50"
    )}>
        <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor)}>
                <Icon className={cn("w-6 h-6", color)} />
            </div>
            <div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
        </div>
    </div>
);

const CustomDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    icon?: React.ElementType;
    placeholder?: string;
}> = ({ value, onChange, options, icon: Icon = Filter, placeholder = 'Filter' }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Use a unique ref for each dropdown instance
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-all min-w-[130px] justify-between text-sm"
            >
                <div className="flex items-center gap-2 truncate">
                    <Icon className="w-3.5 h-3.5 opacity-70" />
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors",
                                    value === option.value
                                        ? "bg-primary/10 text-primary font-medium dark:bg-primary/20"
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PriorityDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const Icon = config.icon;
    const isSystemLocked = config.isSystemLocked === true;

    // Show as static badge if disabled or system-locked (e.g., HARDWARE_INSTALLATION)
    if (disabled || isSystemLocked) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", config.badgeColor)}>
                {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                <span className={cn("w-2 h-2 rounded-full", config.dot)} />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 border-0 text-xs font-medium px-2 gap-1", config.badgeColor)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1">
                        {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                        <span className={cn("w-2 h-2 rounded-full", config.dot)} />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(PRIORITY_CONFIG)
                    .filter(([, cfg]) => !cfg.isSystemLocked) // Exclude system-locked priorities
                    .map(([key, cfg]) => {
                        const PIcon = cfg.icon;
                        return (
                            <SelectItem key={key} value={key}>
                                <span className="inline-flex items-center gap-1.5">
                                    {PIcon && <PIcon className={cn("w-3 h-3", cfg.iconClass)} />}
                                    <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                                    {cfg.label}
                                </span>
                            </SelectItem>
                        );
                    })}
            </SelectContent>
        </Select>
    );
};

const StatusDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.TODO;
    const Icon = config.icon;

    if (disabled) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", config.color)}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 border-0 text-xs font-medium px-2 gap-1", config.color)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'CANCELLED').map(([key, cfg]) => {
                    const SIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                <SIcon className="w-3 h-3" />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

const TargetDateCell: React.FC<{ slaTarget?: string; status: string }> = ({ slaTarget, status }) => {
    if (!slaTarget || status === 'RESOLVED' || status === 'CANCELLED') {
        return <span className="text-xs text-slate-400">-</span>;
    }

    const target = new Date(slaTarget);
    const now = new Date();
    const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isOverdue = diffHours < 0;
    const isApproaching = diffHours > 0 && diffHours <= 4;

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
            isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isApproaching && !isOverdue && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            !isOverdue && !isApproaching && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        )}>
            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />}
            {isApproaching && !isOverdue && <Clock className="w-3.5 h-3.5" />}
            {!isOverdue && !isApproaching && <Calendar className="w-3.5 h-3.5" />}
            <span>{format(target, 'dd MMM HH:mm')}</span>
            {isOverdue && <span className="text-[10px]">(Overdue)</span>}
        </div>
    );
};

export const BentoTicketListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const handleNewTicket = useCallback((ticket: any) => {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            toast.info('New Ticket', {
                description: `${ticket.ticketNumber || ''}: ${ticket.title}`,
                action: {
                    label: 'View',
                    onClick: () => navigate(`/tickets/${ticket.id}`),
                },
                duration: 8000,
            });
        }
    }, [user, navigate]);

    useTicketListSocket({ onNewTicket: handleNewTicket });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';

    // Saved Filters
    const { currentFilter, getFilterValues } = useSavedFilters();

    // Apply saved filter on load
    useEffect(() => {
        const filterValues = getFilterValues();
        if (filterValues) {
            if (filterValues.status?.length) setStatusFilter(filterValues.status[0]);
            if (filterValues.priority?.length) setPriorityFilter(filterValues.priority[0]);
            if (filterValues.search) setSearchQuery(filterValues.search);
        }
    }, [currentFilter]);

    // Current filters object for SavedFiltersDropdown
    const currentFilters = useMemo(() => ({
        status: statusFilter ? [statusFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
        search: searchQuery || undefined,
    }), [statusFilter, priorityFilter, searchQuery]);

    const handleApplySavedFilter = (filters: SavedFilter['filters'] | null) => {
        if (!filters) {
            setSearchQuery('');
            setStatusFilter('');
            setPriorityFilter('');
            return;
        }
        if (filters.status?.length) setStatusFilter(filters.status[0]);
        else setStatusFilter('');
        if (filters.priority?.length) setPriorityFilter(filters.priority[0]);
        else setPriorityFilter('');
        if (filters.search) setSearchQuery(filters.search);
        else setSearchQuery('');
    };

    const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
        queryKey: ['tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
    });

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
    });

    const assignTicketMutation = useMutation({
        mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId });
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to assign ticket');
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onSuccess: () => {
            toast.success('Status updated');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to update status');
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onSuccess: () => {
            toast.success('Priority updated');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to update priority');
        },
    });

    const filteredTickets = useMemo(() => {
        let result = tickets;

        if (showAssignedToMe) {
            result = result.filter((t) => t.assignedTo?.id === user?.id);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter((t) =>
                t.title.toLowerCase().includes(query) ||
                t.ticketNumber?.toLowerCase().includes(query) ||
                t.user?.fullName.toLowerCase().includes(query) ||
                t.category?.toLowerCase().includes(query)
            );
        }

        if (statusFilter) {
            result = result.filter((t) => t.status === statusFilter);
        }

        if (priorityFilter) {
            result = result.filter((t) => t.priority === priorityFilter);
        }

        return result;
    }, [tickets, showAssignedToMe, user, searchQuery, statusFilter, priorityFilter]);

    const stats = useMemo(() => ({
        total: tickets.length,
        open: tickets.filter((t) => t.status === 'TODO').length,
        inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
        resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        overdue: tickets.filter((t) => t.isOverdue).length,
        critical: tickets.filter((t) => t.priority === 'CRITICAL').length,
    }), [tickets]);

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPriorityFilter('');
        setSearchParams({});
    };

    const hasActiveFilters = searchQuery || statusFilter || priorityFilter || showAssignedToMe;
    const canEdit = user?.role === 'ADMIN' || user?.role === 'AGENT';

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Ticket className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">All Tickets</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">View and manage all support requests</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* New Ticket Button */}
                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Ticket</span>
                    </button>

                    {/* My Tasks Filter */}
                    {canEdit && (
                        <button
                            onClick={() => {
                                if (showAssignedToMe) {
                                    setSearchParams({});
                                } else {
                                    setSearchParams({ filter: 'assigned_to_me' });
                                }
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-all font-medium",
                                showAssignedToMe
                                    ? 'bg-primary text-slate-900 border-primary shadow-lg shadow-primary/20'
                                    : 'glass-card hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                            )}
                        >
                            <UserCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">My Tasks</span>
                        </button>
                    )}

                    {/* View Toggle */}
                    <div className="flex glass-card p-1 rounded-xl shadow-sm">
                        <button
                            onClick={() => navigate('/kanban')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-primary rounded-lg transition-colors"
                            title="Kanban Board"
                        >
                            <Columns3 className="w-4 h-4" />
                            <span className="text-xs font-medium hidden md:inline">Kanban</span>
                        </button>
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-medium"
                            title="Table View"
                        >
                            <TableProperties className="w-4 h-4" />
                            <span className="text-xs font-medium hidden md:inline">Table</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-slate-600 dark:text-slate-300" bgColor="bg-slate-100 dark:bg-slate-700" />
                <StatsCard icon={Inbox} label="Open" value={stats.open} color="text-blue-600 dark:text-blue-400" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                <StatsCard icon={CircleDot} label="In Progress" value={stats.inProgress} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-100 dark:bg-amber-900/30" />
                <StatsCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="text-green-600 dark:text-green-400" bgColor="bg-green-100 dark:bg-green-900/30" />
                <StatsCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="text-red-600 dark:text-red-400" bgColor="bg-red-100 dark:bg-red-900/30" highlight />
                <StatsCard icon={Flame} label="Critical" value={stats.critical} color="text-red-600 dark:text-red-400" bgColor="bg-red-100 dark:bg-red-900/30" highlight />
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-1 bg-slate-900/5 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800 backdrop-blur-sm relative z-20">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tickets..."
                        className="w-full pl-11 pr-4 py-2 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-0 text-sm"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 px-1 pb-1 lg:pb-0">
                    <CustomDropdown
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val === "ALL" ? "" : val)}
                        placeholder="All Status"
                        options={[
                            { value: 'ALL', label: 'All Status' },
                            { value: 'TODO', label: 'Open' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'WAITING_VENDOR', label: 'Waiting Vendor' },
                            { value: 'RESOLVED', label: 'Resolved' },
                        ]}
                    />

                    <CustomDropdown
                        value={priorityFilter}
                        onChange={(val) => setPriorityFilter(val === "ALL" ? "" : val)}
                        placeholder="All Priority"
                        icon={AlertTriangle}
                        options={[
                            { value: 'ALL', label: 'All Priority' },
                            { value: 'LOW', label: 'Low' },
                            { value: 'MEDIUM', label: 'Medium' },
                            { value: 'HIGH', label: 'High' },
                            { value: 'CRITICAL', label: 'Critical' },
                        ]}
                    />

                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
                        className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors rounded-lg text-slate-500 dark:text-slate-400"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    {/* Saved Filters Dropdown - styled similarly if possible, but kept as component for logic */}
                    <div className="scale-95 origin-center">
                        <SavedFiltersDropdown
                            currentFilters={currentFilters}
                            onApplyFilter={handleApplySavedFilter}
                        />
                    </div>

                    {/* Export Menu */}
                    <div className="scale-95 origin-center">
                        <ExportMenu
                            data={filteredTickets.map(t => ({
                                id: t.id,
                                ticketNumber: t.ticketNumber || t.id.slice(0, 8),
                                title: t.title,
                                status: t.status,
                                priority: t.priority,
                                category: t.category || '',
                                requester: t.user?.fullName || '',
                                assignedTo: t.assignedTo?.fullName || 'Unassigned',
                                createdAt: format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm'),
                            }))}
                            filename={`tickets-${format(new Date(), 'yyyy-MM-dd')}`}
                            columns={[
                                { key: 'ticketNumber', label: 'Ticket #' },
                                { key: 'title', label: 'Title' },
                                { key: 'status', label: 'Status' },
                                { key: 'priority', label: 'Priority' },
                                { key: 'category', label: 'Category' },
                                { key: 'requester', label: 'Requester' },
                                { key: 'assignedTo', label: 'Assigned To' },
                                { key: 'createdAt', label: 'Created At' },
                            ]}
                        />
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="ml-auto lg:ml-0 p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Clear Filters"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tickets List Table */}
            <div className="glass-card overflow-hidden">
                {filteredTickets.length === 0 ? (
                    <div className="p-12 text-center">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No tickets found</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <div className="flex-[3] min-w-0">Ticket</div>
                            <div className="w-28 shrink-0">Priority</div>
                            <div className="w-36 shrink-0">Status</div>
                            <div className="flex-[2] min-w-0">Requester</div>
                            <div className="flex-[2] min-w-0">Assigned To</div>
                            <div className="flex-[2] min-w-0">Target Date</div>
                            <div className="w-20 shrink-0">Created</div>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredTickets.map((ticket, index) => {
                                const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                                const PriorityIcon = priorityConfig.icon;

                                return (
                                    <div
                                        key={ticket.id}
                                        className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 px-4 py-3 hover:bg-white/60 dark:hover:bg-white/5 transition-all cursor-pointer group animate-fade-in-up border-b border-white/20 dark:border-white/5 last:border-0 hover:backdrop-blur-md"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        {/* Ticket Info */}
                                        <div className="flex-[3] flex items-center gap-3 min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <div className={cn("w-1 h-12 rounded-full shrink-0", priorityConfig.barColor)} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-mono text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                    </span>
                                                    {ticket.isOverdue && (
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    )}
                                                    {ticket.priority === 'CRITICAL' && (
                                                        <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    )}
                                                </div>
                                                <h3 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">
                                                    {ticket.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Priority Dropdown */}
                                        <div className="w-28 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <PriorityDropdown
                                                value={ticket.priority}
                                                onChange={(value) => updatePriorityMutation.mutate({ ticketId: ticket.id, priority: value })}
                                                disabled={!canEdit}
                                            />
                                        </div>

                                        {/* Status Dropdown */}
                                        <div className="w-36 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <StatusDropdown
                                                value={ticket.status}
                                                onChange={(value) => updateStatusMutation.mutate({ ticketId: ticket.id, status: value })}
                                                disabled={!canEdit}
                                            />
                                        </div>

                                        {/* Requester */}
                                        <div className="flex-[2] flex items-center gap-2 min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <UserAvatar
                                                user={ticket.user}
                                                size="sm"
                                            />
                                            <div className="min-w-0 hidden md:block">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ticket.user?.fullName || 'Unknown'}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{ticket.user?.department?.name || '-'}</p>
                                            </div>
                                        </div>

                                        {/* Assigned To Dropdown */}
                                        <div className="flex-[2] min-w-0" onClick={(e) => e.stopPropagation()}>
                                            {canEdit ? (
                                                <Select
                                                    value={ticket.assignedTo?.id || "unassigned"}
                                                    onValueChange={(value) => {
                                                        if (value && value !== "unassigned") {
                                                            assignTicketMutation.mutate({ ticketId: ticket.id, assigneeId: value });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 w-full text-xs bg-transparent border-slate-200 dark:border-slate-700">
                                                        <SelectValue placeholder="Unassigned" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                                        {agents.map((agent) => (
                                                            <SelectItem key={agent.id} value={agent.id}>
                                                                {agent.fullName}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {ticket.assignedTo ? (
                                                        <>
                                                            <UserAvatar
                                                                user={ticket.assignedTo}
                                                                size="xs"
                                                            />
                                                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                                {ticket.assignedTo.fullName}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Target Date */}
                                        <div className="flex-[2] min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <TargetDateCell slaTarget={ticket.slaTarget} status={ticket.status} />
                                        </div>

                                        {/* Created Date & Actions */}
                                        <div className="w-20 shrink-0 flex items-center justify-between gap-1" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <span>{format(new Date(ticket.createdAt), 'dd MMM')}</span>
                                                {ticket.messages && ticket.messages.length > 0 && (
                                                    <span className="flex items-center gap-0.5">
                                                        <MessageSquare className="w-3 h-3" />
                                                        {ticket.messages.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Results Count */}
            {filteredTickets.length > 0 && (
                <div className="text-center text-sm text-slate-400">
                    Showing {filteredTickets.length} of {tickets.length} tickets
                </div>
            )}
        </div>
    );
};
