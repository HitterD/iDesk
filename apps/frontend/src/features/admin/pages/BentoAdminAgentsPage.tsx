import React, { useState, useMemo } from 'react';
import { Users, Upload, Plus, Mail, Shield, Building, Key, Trash2, Award, Clock, CheckCircle, TrendingUp, BarChart3, Ticket, CircleDot, X, Eye } from 'lucide-react';
import { ImportUsersDialog } from '../components/ImportUsersDialog';
import { AddUserDialog } from '../components/AddUserDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
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
    department?: { name: string };
    createdAt: string;
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all">
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

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await api.delete(`/users/${userId}`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'User deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete user');
        },
    });

    const handleDeleteUser = (user: User) => {
        if (window.confirm(`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`)) {
            deleteMutation.mutate(user.id);
        }
    };

    const table = useReactTable({
        data: users,
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
        <div className="space-y-6">
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
        </div >
    );
};
