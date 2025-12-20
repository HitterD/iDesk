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
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                        <Dialog.Title className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                            Export Preview
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Applied Filters */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Filter className="w-4 h-4" />
                                <span>Filters Applied:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2 py-1 rounded-lg text-xs font-bold",
                                    siteFilter === 'ALL'
                                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                        : SITE_COLORS[siteFilter] || "bg-slate-100 text-slate-600"
                                )}>
                                    Site: {siteFilter}
                                </span>
                                {roleFilter && roleFilter !== 'ALL' && (
                                    <span className={cn(
                                        "px-2 py-1 rounded-lg text-xs font-bold",
                                        ROLE_COLORS[roleFilter] || "bg-slate-100 text-slate-600"
                                    )}>
                                        Role: {roleFilter}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Record Count */}
                        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                            <Users className="w-8 h-8 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {isLoading ? '...' : previewData?.total || 0}
                                </p>
                                <p className="text-sm text-blue-500">Records to export</p>
                            </div>
                        </div>

                        {/* Preview Table */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Eye className="w-4 h-4" />
                                <span>Preview (first 10 rows)</span>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Site</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </td>
                                            </tr>
                                        ) : error ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                                                    Failed to load preview
                                                </td>
                                            </tr>
                                        ) : previewData?.preview.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                                    No users match the current filters
                                                </td>
                                            </tr>
                                        ) : (
                                            previewData?.preview.map((user, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{user.email}</td>
                                                    <td className="px-4 py-2 text-slate-800 dark:text-white font-medium">{user.fullName}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={cn("px-2 py-0.5 rounded text-xs font-bold", ROLE_COLORS[user.role])}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {user.siteCode ? (
                                                            <span className={cn("px-2 py-0.5 rounded text-xs font-bold", SITE_COLORS[user.siteCode])}>
                                                                {user.siteCode}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-xs font-bold",
                                                            user.isActive
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        )}>
                                                            {user.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {previewData && previewData.total > 10 && (
                                <p className="text-xs text-slate-400 text-center">
                                    ...and {previewData.total - 10} more records
                                </p>
                            )}
                        </div>

                        {/* Format Selection */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500">Export format:</span>
                            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <button
                                    onClick={() => setFormat('csv')}
                                    className={cn(
                                        "px-3 py-1.5 rounded text-sm font-medium transition-all",
                                        format === 'csv'
                                            ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={() => setFormat('xlsx')}
                                    className={cn(
                                        "px-3 py-1.5 rounded text-sm font-medium transition-all",
                                        format === 'xlsx'
                                            ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    Excel (XLSX)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting || isLoading || !previewData?.total}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export {previewData?.total || 0} Records
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
