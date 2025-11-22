import React from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { Edit, Trash2 } from 'lucide-react';

interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE';
}

const columnHelper = createColumnHelper<Agent>();

const columns = [
    columnHelper.accessor('fullName', {
        header: 'Name',
        cell: (info) => (
            <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center mr-3 font-bold">
                    {info.getValue().charAt(0)}
                </div>
                <span className="text-white font-medium">{info.getValue()}</span>
            </div>
        ),
    }),
    columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => <span className="text-slate-400">{info.getValue()}</span>,
    }),
    columnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => (
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">
                {info.getValue()}
            </span>
        ),
    }),
    columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
            <span
                className={`px-2 py-1 rounded text-xs font-bold border ${info.getValue() === 'ACTIVE'
                        ? 'bg-neon-green/20 text-neon-green border-neon-green/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}
            >
                {info.getValue()}
            </span>
        ),
    }),
    columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: () => (
            <div className="flex space-x-2">
                <button className="p-1 hover:text-neon-green transition-colors">
                    <Edit className="w-4 h-4" />
                </button>
                <button className="p-1 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        ),
    }),
];

export const AgentTable: React.FC<{ data: Agent[] }> = ({ data }) => {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-400 uppercase font-mono text-xs">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th key={header.id} className="px-6 py-3 font-semibold">
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-white/5 bg-navy-main/50">
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
    );
};
