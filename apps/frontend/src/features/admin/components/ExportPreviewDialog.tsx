import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, FileSpreadsheet, Eye, Filter, Users, Loader2, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';

interface ExportPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    siteFilter: string;
    roleFilter?: string;
}

interface UserPreview {
    email: string;
    fullName: string;
    role: string;
    siteCode?: string;
    isActive: boolean;
}

interface ExportPreviewData {
    total: number;
    preview: UserPreview[];
    filters: {
        site: string;
        role?: string;
    };
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    MANAGER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    AGENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    USER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const ExportPreviewDialog: React.FC<ExportPreviewDialogProps> = ({
    isOpen,
    onClose,
    siteFilter,
    roleFilter
}) => {
    const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
    const [isExporting, setIsExporting] = useState(false);

    // Fetch preview data
    const { data: previewData, isLoading, error } = useQuery<ExportPreviewData>({
        queryKey: ['export-preview', siteFilter, roleFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('limit', '10');
            if (siteFilter !== 'ALL') params.set('siteCode', siteFilter);
            if (roleFilter && roleFilter !== 'ALL') params.set('role', roleFilter);

            const res = await api.get(`/users?${params.toString()}`);
            return {
                total: res.data.meta?.total || res.data.data?.length || 0,
                preview: (res.data.data || []).slice(0, 10).map((u: any) => ({
                    email: u.email,
                    fullName: u.fullName,
                    role: u.role,
                    siteCode: u.site?.code,
                    isActive: u.isActive !== false
                })),
                filters: {
                    site: siteFilter,
                    role: roleFilter
                }
            };
        },
        enabled: isOpen,
        staleTime: 30000
    });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await api.get(`/users/export?format=${format}&site=${siteFilter}`, {
                responseType: format === 'xlsx' ? 'blob' : 'json'
            });

            if (format === 'xlsx') {
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users_${siteFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const { data, filename } = res.data;
                const blob = new Blob([data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }
            toast.success(`Exported ${previewData?.total || 0} users successfully`);
            onClose();
        } catch (err) {
            toast.error('Failed to export users');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                        <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                            <FileSpreadsheet className="w-5 h-5 text-slate-500" />
                            Export Configuration Preview
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-white transition-colors rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                        
                        {/* Summary & Filters Row */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Record Count */}
                            <div className="flex-1 flex items-center gap-4 p-5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] border-t-2 border-t-primary rounded-xl shadow-sm">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <Users className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                        {isLoading ? <Loader2 className="w-6 h-6 animate-spin mt-1 text-slate-400" /> : previewData?.total || 0}
                                    </p>
                                    <p className="text-sm font-medium text-slate-500">Target Records for Export</p>
                                </div>
                            </div>
                            
                            {/* Applied Filters Mini-panel */}
                            <div className="flex-1 flex flex-col justify-center p-5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-sm">
                                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2 font-medium">
                                    <Filter className="w-4 h-4" />
                                    Active Constraints
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        Site: {siteFilter}
                                    </span>
                                    {roleFilter && roleFilter !== 'ALL' && (
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                            Role: {roleFilter}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Format Selection Row */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 border border-[hsl(var(--border))] rounded-xl">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">File Output Format</span>
                            <div className="flex items-center gap-1.5 p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
                                <button
                                    onClick={() => setFormat('csv')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-md text-sm font-bold transition-colors duration-150",
                                        format === 'csv'
                                            ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={() => setFormat('xlsx')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-md text-sm font-bold transition-colors duration-150",
                                        format === 'xlsx'
                                            ? "bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    Excel (XLSX)
                                </button>
                            </div>
                        </div>

                        {/* Preview Table */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                                    <Eye className="w-4 h-4 text-slate-400" />
                                    Data Snapshot Preview
                                </div>
                                <span className="text-xs text-slate-400 font-medium tracking-wide">TOP 10 ROWS</span>
                            </div>
                            
                            <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-[hsl(var(--border))]">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 tracking-wider">Name & Email</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[hsl(var(--border))] bg-[hsl(var(--card))]">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-12 text-center">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </td>
                                            </tr>
                                        ) : error ? (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-8 text-center text-red-500 font-medium">
                                                    Failed to load preview snapshot
                                                </td>
                                            </tr>
                                        ) : previewData?.preview.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-12 text-center text-slate-400 font-medium">
                                                    No user records match these constraints
                                                </td>
                                            </tr>
                                        ) : (
                                            previewData?.preview.map((user, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 border-transparent dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-slate-900 dark:text-white">{user.fullName}</div>
                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                        <div className="flex gap-2 mt-1.5">
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                {user.role}
                                                            </span>
                                                            {user.siteCode && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                    {user.siteCode}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 align-top">
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase border",
                                                            user.isActive
                                                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/20"
                                                                : "bg-red-50 dark:bg-red-500/10 text-red-600 border-red-200 dark:border-red-500/20"
                                                        )}>
                                                            {user.isActive ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="px-6 py-4 border-t border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || isLoading || !previewData?.total}
                            className="flex items-center gap-2 px-6 py-2 bg-slate-900 border border-slate-800 dark:bg-slate-100 dark:border-slate-200 text-white dark:text-slate-900 font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isExporting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                            Execute Export
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
