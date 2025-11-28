import React, { useState } from 'react';
import { Users, Upload, Plus, Mail, Shield, Building, Key, Trash2 } from 'lucide-react';
import { ImportUsersDialog } from '../components/ImportUsersDialog';
import { AddUserDialog } from '../components/AddUserDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
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
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Agent Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your support team and users</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setGroupByDivision(!groupByDivision)}
                        className={`flex items-center gap-2 px-6 py-3 border font-bold rounded-2xl transition-all ${groupByDivision
                            ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Building className="w-5 h-5" />
                        {groupByDivision ? 'Ungroup' : 'Group by Division'}
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm transition-all"
                    >
                        <Upload className="w-5 h-5" />
                        Import Users
                    </button>
                    <button
                        onClick={() => setIsAddUserModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-primary text-white dark:text-slate-900 font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-primary/90 hover:shadow-lg hover:scale-105 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Add User
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading users...</div>
            ) : users.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-12 text-center shadow-sm">
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
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
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
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
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
