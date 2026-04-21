import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportableData {
  id: string;
  [key: string]: any;
}

interface ExportMenuProps<T extends ExportableData> {
  data: T[];
  filename?: string;
  columns?: { key: keyof T; label: string }[];
  className?: string;
}

// Download helper
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Format value for CSV
const formatCsvValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function ExportMenu<T extends ExportableData>({
  data,
  filename = 'export',
  columns,
  className
}: ExportMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Default columns from first data item
  const exportColumns = columns || (data.length > 0
    ? Object.keys(data[0])
      .filter(key => key !== 'id' && typeof data[0][key] !== 'object')
      .map(key => ({ key: key as keyof T, label: key }))
    : []
  );

  const exportToCSV = async () => {
    setIsExporting('csv');
    try {
      // Headers
      const headers = exportColumns.map(col => formatCsvValue(col.label)).join(',');

      // Rows
      const rows = data.map(item =>
        exportColumns.map(col => formatCsvValue(item[col.key])).join(',')
      );

      const csv = [headers, ...rows].join('\n');
      downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8');
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(null);
      setIsOpen(false);
    }
  };

  const exportToJSON = async () => {
    setIsExporting('json');
    try {
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `${filename}.json`, 'application/json');
      toast.success('JSON exported successfully');
    } catch (error) {
      toast.error('Failed to export JSON');
    } finally {
      setIsExporting(null);
      setIsOpen(false);
    }
  };

  if (data.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Export data"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Export
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            role="menu"
            aria-label="Export options"
            className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-scale-in"
          >
            <div className="p-1">
              <button
                onClick={exportToCSV}
                disabled={isExporting !== null}
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {isExporting === 'csv' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">Export as CSV</p>
                  <p className="text-xs text-slate-500">Comma-separated values</p>
                </div>
              </button>

              <button
                onClick={exportToJSON}
                disabled={isExporting !== null}
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                {isExporting === 'json' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">Export as JSON</p>
                  <p className="text-xs text-slate-500">JavaScript object notation</p>
                </div>
              </button>
            </div>

            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">
                {data.length} {data.length === 1 ? 'item' : 'items'} will be exported
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple export button for single format
interface QuickExportButtonProps<T extends ExportableData> {
  data: T[];
  filename?: string;
  format?: 'csv' | 'json';
  className?: string;
}

export function QuickExportButton<T extends ExportableData>({
  data,
  filename = 'export',
  format = 'csv',
  className,
}: QuickExportButtonProps<T>) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      if (format === 'csv') {
        const keys = Object.keys(data[0]).filter(k => k !== 'id');
        const headers = keys.join(',');
        const rows = data.map(item =>
          keys.map(key => formatCsvValue(item[key])).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `${filename}.json`, 'application/json');
      }
      toast.success('Export completed');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || data.length === 0}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50",
        className
      )}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      Export
    </button>
  );
}

export default ExportMenu;
