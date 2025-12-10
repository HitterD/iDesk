import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Users, Upload, Plus, Mail, Shield, Building, Key, Trash2, Award, Clock, CheckCircle, TrendingUp, BarChart3, Ticket, CircleDot, X, Eye, Search, Download, Edit2, ToggleLeft, ToggleRight, CheckSquare, Square, ChevronDown, Filter, Check } from 'lucide-react';
import { ImportUsersDialog } from '../components/ImportUsersDialog';
import { AddUserDialog } from '../components/AddUserDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { EditUserDialog } from '../components/EditUserDialog';
import { AgentDetailModal } from '../components/AgentDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from '@tanstack/react-table';

interface User {
    id: string;
    fullName: string;
    email: string;
    role: 'ADMIN' | 'AGENT' | 'USER';
    department?: { id: string; name: string };
    createdAt: string;
    isActive?: boolean;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
}

interface AgentStats {
    id: string;
    fullName: string;
    openTickets: number;
    inProgressTickets: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    avgResponseTime: string;
    slaCompliance: number;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string; bgColor: string }> = ({
    title, value, icon: Icon, color, bgColor
}) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all hover-lift">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
            </div>
            <div className={cn("p-3 rounded-xl", bgColor)}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
        </div>
    </div>
);

const CustomDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === value)?.label || 'Filter';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-800 transition-all min-w-[140px] justify-between"
            >
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>{selectedLabel}</span>
                </div>
                <ChevronDown className="w-4 h-4 opacity-50" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
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
                                        ? "bg-primary/20 text-primary font-medium"
                                        : "text-slate-300 hover:bg-slate-800"
                                )}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const columnHelper = createColumnHelper<User>();

const columns = [
    columnHelper.accessor('fullName', {
        header: 'Name',
        cell: (info) => (
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                    {info.getValue().charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="font-bold text-slate-800 dark:text-white">{info.getValue()}</p>
                </div>
            </div>
        ),
    }),
    columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Mail className="w-4 h-4" />
                {info.getValue()}
            </div>
        ),
    }),
    columnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => {
            const role = info.getValue();
            const colors = {
                ADMIN: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
                AGENT: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                USER: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
            };
            return (
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${colors[role]}`}>
                    <Shield className="w-3 h-3" />
                    {role}
                </span>
            );
        },
    }),
    columnHelper.accessor('department', {
        header: 'Department',
        cell: (info) => {
            const dept = info.getValue();
            return dept ? (
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Building className="w-4 h-4" />
                    {dept.name}
                </div>
            ) : <span className="text-slate-400 italic">None</span>;
        },
    }),
];

export const BentoAdminAgentsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedAgentDetail, setSelectedAgentDetail] = useState<User | null>(null);
    const [groupByDivision, setGroupByDivision] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    // New state for enhanced features
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

    const handleResetPassword = (user: User) => {
        setSelectedUser(user);
        setIsResetPasswordOpen(true);
    };

    const { data: users = [], isLoading } = useQuery<User[]>({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/users');
            return res.data;
        },
        staleTime: 0,
        refetchOnMount: 'always',
    });

    // Fetch tickets for agent statistics
    const { data: tickets = [] } = useQuery<any[]>({
        queryKey: ['tickets-for-stats'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
        staleTime: 30000,
    });

    // Compute agent statistics from tickets
    const agentStats = useMemo(() => {
        const agents = users.filter(u => u.role === 'ADMIN' || u.role === 'AGENT');
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        return agents.map(agent => {
            const agentTickets = tickets.filter((t: any) => t.assignedTo?.id === agent.id);
            const openTickets = agentTickets.filter((t: any) => t.status === 'TODO').length;
            const inProgressTickets = agentTickets.filter((t: any) => t.status === 'IN_PROGRESS').length;
            const resolvedThisWeek = agentTickets.filter((t: any) =>
                t.status === 'RESOLVED' && new Date(t.updatedAt) >= weekAgo
            ).length;
            const resolvedThisMonth = agentTickets.filter((t: any) =>
                t.status === 'RESOLVED' && new Date(t.updatedAt) >= monthAgo
            ).length;
            const overdueCount = agentTickets.filter((t: any) => t.isOverdue).length;
            const totalAssigned = agentTickets.length;
            const slaCompliance = totalAssigned > 0 ? Math.round(((totalAssigned - overdueCount) / totalAssigned) * 100) : 100;

            return {
                id: agent.id,
                fullName: agent.fullName,
                email: agent.email,
                role: agent.role,
                department: agent.department,
                openTickets,
                inProgressTickets,
                resolvedThisWeek,
                resolvedThisMonth,
                totalAssigned,
                slaCompliance,
            };
        });
    }, [users, tickets]);

    // Dashboard stats
    const dashboardStats = useMemo(() => {
        const agents = users.filter(u => u.role === 'ADMIN' || u.role === 'AGENT');
        const totalResolved = agentStats.reduce((sum, a) => sum + a.resolvedThisMonth, 0);
        const avgTicketsPerAgent = agents.length > 0 ? Math.round(tickets.length / agents.length) : 0;
        const topPerformer = agentStats.sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth)[0];

        return {
            totalAgents: agents.length,
            totalResolved,
            avgTicketsPerAgent,
            topPerformer: topPerformer?.fullName || '-',
        };
    }, [users, agentStats, tickets]);

    // Filtered users based on search and role filter
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = searchQuery === '' ||
                user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, searchQuery, roleFilter]);

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await api.delete(`/users/${userId}`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'User deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsConfirmDeleteOpen(false);
            setUserToDelete(null);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete user');
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (userIds: string[]) => {
            const res = await api.post('/users/bulk-delete', { userIds });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`${data.deleted} users deleted successfully`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUserIds(new Set());
            setIsBulkDeleteOpen(false);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete users');
        },
    });

    const handleDeleteUser = (user: User) => {
        setUserToDelete(user);
        setIsConfirmDeleteOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsEditUserOpen(true);
    };

    const handleExportUsers = async () => {
        try {
            const res = await api.get('/users/export');
            const { data, filename } = res.data;
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Users exported successfully');
        } catch (error) {
            toast.error('Failed to export users');
        }
    };

    const toggleUserSelection = (userId: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUserIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedUserIds.size === filteredUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const table = useReactTable({
        data: filteredUsers,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Agent Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your support team and track performance</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setGroupByDivision(!groupByDivision)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 border font-medium rounded-xl transition-all",
                            groupByDivision
                                ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        )}
                    >
                        <Building className="w-4 h-4" />
                        {groupByDivision ? 'Ungroup' : 'Group by Division'}
                    </button>
                    <button
                        onClick={handleExportUsers}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <Upload className="w-4 h-4" />
                        Import
                    </button>
                    <button
                        onClick={() => setIsAddUserModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Add User
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-4 p-1 bg-slate-900/5 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800 backdrop-blur-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tickets, articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-0"
                    />
                </div>

                <div className="flex items-center gap-2 pr-1.5">
                    {selectedUserIds.size > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200 mr-2">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden md:inline">
                                {selectedUserIds.size} selected
                            </span>
                            <button
                                onClick={() => setIsBulkDeleteOpen(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-500/20 transition-all text-sm border border-red-500/20"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    )}

                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800 mx-2" />

                    <CustomDropdown
                        value={roleFilter}
                        onChange={setRoleFilter}
                        options={[
                            { value: 'ALL', label: 'All Roles' },
                            { value: 'ADMIN', label: 'Admin' },
                            { value: 'AGENT', label: 'Agent' },
                            { value: 'USER', label: 'User' },
                        ]}
                    />
                </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Agents"
                    value={dashboardStats.totalAgents}
                    icon={Users}
                    color="text-blue-600"
                    bgColor="bg-blue-100 dark:bg-blue-900/30"
                />
                <StatCard
                    title="Resolved (Month)"
                    value={dashboardStats.totalResolved}
                    icon={CheckCircle}
                    color="text-green-600"
                    bgColor="bg-green-100 dark:bg-green-900/30"
                />
                <StatCard
                    title="Avg Tickets/Agent"
                    value={dashboardStats.avgTicketsPerAgent}
                    icon={Ticket}
                    color="text-purple-600"
                    bgColor="bg-purple-100 dark:bg-purple-900/30"
                />
                <StatCard
                    title="Top Performer"
                    value={dashboardStats.topPerformer}
                    icon={Award}
                    color="text-amber-600"
                    bgColor="bg-amber-100 dark:bg-amber-900/30"
                />
            </div>

            {/* Agent Performance Table */}
            {agentStats.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            Agent Performance
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Agent</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Open</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">In Progress</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Resolved (Week)</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Resolved (Month)</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">SLA %</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {agentStats.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {agent.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-white">{agent.fullName}</p>
                                                    <p className="text-xs text-slate-500">{agent.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300">
                                                {agent.openTickets}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400">
                                                {agent.inProgressTickets}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                                {agent.resolvedThisWeek}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                                {agent.resolvedThisMonth}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={cn(
                                                "px-2 py-1 rounded-lg text-sm font-medium",
                                                agent.slaCompliance >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                    agent.slaCompliance >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            )}>
                                                {agent.slaCompliance}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => setSelectedAgentDetail(users.find(u => u.id === agent.id) || null)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4 text-slate-500" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading users...</div>
            ) : users.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-12 text-center shadow-sm">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Users className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">No Users Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        Get started by adding a new user or importing from a CSV file.
                    </p>
                </div>
            ) : groupByDivision ? (
                <div className="space-y-8">
                    {Object.entries(users.reduce((acc, user) => {
                        const deptName = user.department?.name || 'No Department';
                        if (!acc[deptName]) acc[deptName] = [];
                        acc[deptName].push(user);
                        return acc;
                    }, {} as Record<string, User[]>)).map(([deptName, deptUsers]) => (
                        <div key={deptName} className="space-y-4">
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Building className="w-5 h-5" />
                                {deptName}
                                <span className="text-sm font-normal text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                    {deptUsers.length}
                                </span>
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">Name</th>
                                            <th className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">Email</th>
                                            <th className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">Role</th>
                                            <th className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {deptUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                                                            {user.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <p className="font-bold text-slate-800 dark:text-white">{user.fullName}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                        <Mail className="w-4 h-4" />
                                                        {user.email}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : user.role === 'AGENT' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                        <Shield className="w-3 h-3" />
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleResetPassword(user)}
                                                            className="flex items-center gap-1.5 px-3 py-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl text-sm font-medium transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <Key className="w-4 h-4" />
                                                            Reset
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(user)}
                                                            disabled={deleteMutation.isPending}
                                                            className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                    <th className="px-8 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">Actions</th>
                                    <th className="px-4 py-6 text-sm font-bold text-slate-500 dark:text-slate-400">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                            title="Select All"
                                        >
                                            {selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0 ? (
                                                <CheckSquare className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Square className="w-5 h-5 text-slate-400" />
                                            )}
                                        </button>
                                    </th>
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {table.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-8 py-5">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditUser(row.original)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl text-sm font-medium transition-colors"
                                                title="Edit User"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleResetPassword(row.original)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl text-sm font-medium transition-colors"
                                                title="Reset Password"
                                            >
                                                <Key className="w-4 h-4" />
                                                Reset
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(row.original)}
                                                disabled={deleteMutation.isPending}
                                                className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                                                title="Delete User"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5">
                                        <button
                                            onClick={() => toggleUserSelection(row.original.id)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            {selectedUserIds.has(row.original.id) ? (
                                                <CheckSquare className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Square className="w-5 h-5 text-slate-400" />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
            }

            <ImportUsersDialog
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
            <AddUserDialog
                isOpen={isAddUserModalOpen}
                onClose={() => setIsAddUserModalOpen(false)}
            />
            <ResetPasswordDialog
                isOpen={isResetPasswordOpen}
                onClose={() => {
                    setIsResetPasswordOpen(false);
                    setSelectedUser(null);
                }}
                user={selectedUser}
            />
            <EditUserDialog
                isOpen={isEditUserOpen}
                onClose={() => {
                    setIsEditUserOpen(false);
                    setEditingUser(null);
                }}
                user={editingUser}
            />
            <AgentDetailModal
                isOpen={!!selectedAgentDetail}
                onClose={() => setSelectedAgentDetail(null)}
                agent={selectedAgentDetail ? {
                    ...selectedAgentDetail,
                    ...agentStats.find(a => a.id === selectedAgentDetail.id)
                } : null}
            />
            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
                onClose={() => {
                    setIsConfirmDeleteOpen(false);
                    setUserToDelete(null);
                }}
                onConfirm={() => userToDelete && deleteMutation.mutate(userToDelete.id)}
                title="Delete User"
                message={`Are you sure you want to delete ${userToDelete?.fullName}? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedUserIds))}
                title="Delete Multiple Users"
                message={`Are you sure you want to delete ${selectedUserIds.size} users? This action cannot be undone.`}
                confirmText="Delete All"
                variant="danger"
                isLoading={bulkDeleteMutation.isPending}
            />
        </div >
    );
};

