import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, FileText, Loader2, Download, Users, Eye, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ExportPdfDialogProps {
    isOpen: boolean;
    onClose: () => void;
    siteFilter: string;
    totalUsers: number;
}

interface PdfOptions {
    includeStats: boolean;
    includePerformance: boolean;
    includeInactive: boolean;
    pageSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
}

export const ExportPdfDialog: React.FC<ExportPdfDialogProps> = ({
    isOpen,
    onClose,
    siteFilter,
    totalUsers
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [options, setOptions] = useState<PdfOptions>({
        includeStats: true,
        includePerformance: true,
        includeInactive: false,
        pageSize: 'A4',
        orientation: 'landscape'
    });

    const handleExport = async () => {
        setIsExporting(true);

        try {
            // Create a printable HTML document
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                toast.error('Please allow popups to export PDF');
                setIsExporting(false);
                return;
            }

            // Generate PDF-friendly HTML content
            const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Agent Report - ${siteFilter === 'ALL' ? 'All Sites' : siteFilter}</title>
                    <style>
                        @page {
                            size: ${options.pageSize} ${options.orientation};
                            margin: 1cm;
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            color: #1e293b;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            padding-bottom: 20px;
                            border-bottom: 2px solid #e2e8f0;
                        }
                        .header h1 {
                            font-size: 24px;
                            margin: 0 0 10px 0;
                            color: #0f172a;
                        }
                        .header p {
                            color: #64748b;
                            margin: 0;
                            font-size: 14px;
                        }
                        .stats-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 16px;
                            margin-bottom: 30px;
                        }
                        .stat-card {
                            padding: 16px;
                            background: #f8fafc;
                            border-radius: 8px;
                            text-align: center;
                        }
                        .stat-value {
                            font-size: 28px;
                            font-weight: bold;
                            color: #0f172a;
                        }
                        .stat-label {
                            font-size: 12px;
                            color: #64748b;
                            text-transform: uppercase;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                        }
                        th, td {
                            padding: 10px 12px;
                            text-align: left;
                            border-bottom: 1px solid #e2e8f0;
                        }
                        th {
                            background: #f1f5f9;
                            font-weight: 600;
                            text-transform: uppercase;
                            font-size: 11px;
                            color: #475569;
                        }
                        tr:hover {
                            background: #f8fafc;
                        }
                        .badge {
                            display: inline-block;
                            padding: 2px 8px;
                            border-radius: 4px;
                            font-size: 10px;
                            font-weight: 600;
                        }
                        .badge-admin { background: #f3e8ff; color: #7c3aed; }
                        .badge-manager { background: #fef3c7; color: #d97706; }
                        .badge-agent { background: #dbeafe; color: #2563eb; }
                        .badge-user { background: #f1f5f9; color: #475569; }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #e2e8f0;
                            text-align: center;
                            font-size: 11px;
                            color: #94a3b8;
                        }
                        @media print {
                            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Agent Performance Report</h1>
                        <p>Site: ${siteFilter === 'ALL' ? 'All Sites' : siteFilter} | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                    </div>
                    
                    ${options.includeStats ? `
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${totalUsers}</div>
                            <div class="stat-label">Total Agents</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">--</div>
                            <div class="stat-label">Active</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">--</div>
                            <div class="stat-label">Inactive</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">--</div>
                            <div class="stat-label">Resolved (Month)</div>
                        </div>
                    </div>
                    ` : ''}

                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Site</th>
                                <th>Status</th>
                                ${options.includePerformance ? '<th>Open</th><th>In Progress</th><th>Resolved</th><th>SLA %</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colspan="${options.includePerformance ? 9 : 5}" style="text-align: center; color: #94a3b8; padding: 40px;">
                                    Data will be populated when printing from the application
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>iDesk Agent Management System | Confidential Report</p>
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(content);
            printWindow.document.close();

            // Wait for content to load then trigger print
            setTimeout(() => {
                printWindow.print();
                toast.success('PDF export initiated - use your browser\'s print dialog to save');
            }, 250);

        } catch (error) {
            toast.error('Failed to generate PDF');
        } finally {
            setIsExporting(false);
            onClose();
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-500" />
                            Export to PDF
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Preview Info */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4">
                        <Users className="w-8 h-8 text-blue-500" />
                        <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{totalUsers} agents</p>
                            <p className="text-sm text-slate-500">Site: {siteFilter === 'ALL' ? 'All Sites' : siteFilter}</p>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Settings className="w-4 h-4" />
                            <span>Export Options</span>
                        </div>

                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={options.includeStats}
                                onChange={(e) => setOptions({ ...options, includeStats: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Include Stats Summary</span>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={options.includePerformance}
                                onChange={(e) => setOptions({ ...options, includePerformance: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Include Performance Metrics</span>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={options.includeInactive}
                                onChange={(e) => setOptions({ ...options, includeInactive: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Include Inactive Agents</span>
                        </label>

                        <div className="flex items-center gap-2">
                            <select
                                value={options.pageSize}
                                onChange={(e) => setOptions({ ...options, pageSize: e.target.value as 'A4' | 'Letter' })}
                                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            >
                                <option value="A4">A4</option>
                                <option value="Letter">Letter</option>
                            </select>
                            <select
                                value={options.orientation}
                                onChange={(e) => setOptions({ ...options, orientation: e.target.value as 'portrait' | 'landscape' })}
                                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            >
                                <option value="landscape">Landscape</option>
                                <option value="portrait">Portrait</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export PDF
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
