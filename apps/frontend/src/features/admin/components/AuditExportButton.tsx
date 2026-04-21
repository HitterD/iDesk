import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../../lib/api';
import { toast } from 'sonner';

interface AuditExportButtonProps {
    filters?: {
        userId?: string;
        action?: string;
        entityType?: string;
        startDate?: string;
        endDate?: string;
    };
}

export function AuditExportButton({ filters }: AuditExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const buildQueryString = () => {
        const params = new URLSearchParams();
        if (filters?.userId) params.append('userId', filters.userId);
        if (filters?.action) params.append('action', filters.action);
        if (filters?.entityType) params.append('entityType', filters.entityType);
        if (filters?.startDate) params.append('startDate', filters.startDate);
        if (filters?.endDate) params.append('endDate', filters.endDate);
        return params.toString();
    };

    const handleExportCsv = async () => {
        setIsExporting(true);
        try {
            const queryString = buildQueryString();
            const response = await api.get(`/audit/export/csv${queryString ? `?${queryString}` : ''}`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('CSV exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export CSV');
        } finally {
            setIsExporting(false);
            setIsOpen(false);
        }
    };

    const handleExportXlsx = async () => {
        setIsExporting(true);
        try {
            const queryString = buildQueryString();
            const response = await api.get(`/audit/export/xlsx${queryString ? `?${queryString}` : ''}`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Excel file exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export Excel file');
        } finally {
            setIsExporting(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
                Export
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg overflow-hidden z-50"
                    >
                        <button
                            onClick={handleExportCsv}
                            disabled={isExporting}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <FileText className="w-4 h-4 text-[hsl(var(--success-500))]" />
                            Export as CSV
                        </button>
                        <button
                            onClick={handleExportXlsx}
                            disabled={isExporting}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-[hsl(var(--border))]"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-[hsl(var(--info-500))]" />
                            Export as Excel
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
