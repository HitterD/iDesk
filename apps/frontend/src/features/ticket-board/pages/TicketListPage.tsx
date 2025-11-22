import React, { useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, ArrowUpDown } from 'lucide-react';

// Mock Data Type
interface Ticket {
    id: string;
    title: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignee: string;
    createdAt: string;
}

// Mock Data
const defaultData: Ticket[] = [
    { id: 'T-101', title: 'Login Failure on Mobile', status: 'IN_PROGRESS', priority: 'CRITICAL', assignee: 'Agent Smith', createdAt: '2023-10-27' },
    { id: 'T-102', title: 'Update Payment Gateway', status: 'TODO', priority: 'HIGH', assignee: 'Unassigned', createdAt: '2023-10-28' },
    { id: 'T-103', title: 'Fix CSS Glitch', status: 'RESOLVED', priority: 'LOW', assignee: 'Jane Doe', createdAt: '2023-10-26' },
    { id: 'T-104', title: 'Server Downtime', status: 'WAITING_VENDOR', priority: 'MEDIUM', assignee: 'DevOps Team', createdAt: '2023-10-25' },
];

const columnHelper = createColumnHelper<Ticket>();

const columns = [
    columnHelper.accessor('id', {
        header: 'ID',
        cell: (info) => <span className="font-mono text-neon-blue">{info.getValue()}</span>,
    }),
    columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
            const status = info.getValue();
            const colors = {
                TODO: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
                IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                WAITING_VENDOR: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
                RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/50',
            };
            return (
                <span className={`px-2 py-1 rounded-full text-xs border ${colors[status]}`}>
                    {status.replace('_', ' ')}
                </span>
            );
        },
    }),
    columnHelper.accessor('priority', {
        header: ({ column }) => {
            return (
                <button
                    className="flex items-center gap-1 hover:text-white"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Priority
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </button>
            )
        },
        cell: (info) => {
            const priority = info.getValue();
            const colors = {
                LOW: 'text-slate-400',
                MEDIUM: 'text-yellow-400',
                HIGH: 'text-orange-400',
                CRITICAL: 'text-red-500 font-bold',
            };
            return <span className={colors[priority]}>{priority}</span>;
        },
    }),
    columnHelper.accessor('assignee', {
        header: 'Assignee',
        cell: (info) => <span className="text-slate-300">{info.getValue()}</span>,
    }),
    columnHelper.accessor('createdAt', {
        header: 'Created At',
        cell: (info) => <span className="text-slate-400 text-sm">{info.getValue()}</span>,
    }),
];

export const TicketListPage: React.FC = () => {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [data] = useState(() => [...defaultData]);

    const table = useReactTable({
        data,
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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Tickets</h1>
                <div className="flex bg-navy-light p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => navigate('/kanban')}
                        className="p-2 text-slate-400 hover:text-white rounded-md transition-colors"
                        title="Kanban View"
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                        className="p-2 bg-white/10 text-neon-green rounded-md shadow-sm"
                        title="List View"
                    >
                        <List className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="bg-navy-light border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th key={header.id} className="px-6 py-4 text-sm font-medium text-slate-300">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id} className="hover:bg-white/5 transition-colors">
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-6 py-4">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
