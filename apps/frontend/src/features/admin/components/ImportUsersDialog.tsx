import React, { useState, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download, AlertTriangle, ChevronLeft, Eye, FileWarning } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Papa from 'papaparse';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';

interface ImportUsersDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ImportSummary {
    success: number;
    failed: number;
    errors: string[];
}

interface ParsedRow {
    email: string;
    fullName: string;
    role: string;
    siteCode: string;
    departmentCode?: string;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    isActive?: string;
}

interface RowValidation {
    row: ParsedRow;
    errors: string[];
    warnings: string[];
    isValid: boolean;
}

type DialogStep = 'upload' | 'preview' | 'result';

const VALID_ROLES = ['USER', 'AGENT', 'MANAGER', 'ADMIN'];
const VALID_SITES = ['SPJ', 'SMG', 'KRW', 'JTB'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate a single row
const validateRow = (row: ParsedRow, index: number): RowValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field: email
    if (!row.email || !row.email.trim()) {
        errors.push('Email is required');
    } else if (!EMAIL_REGEX.test(row.email.trim())) {
        errors.push('Invalid email format');
    }

    // Required field: fullName
    if (!row.fullName || !row.fullName.trim()) {
        errors.push('Full name is required');
    }

    // Required field: role (with validation)
    if (!row.role || !row.role.trim()) {
        errors.push('Role is required');
    } else if (!VALID_ROLES.includes(row.role.toUpperCase().trim())) {
        errors.push(`Invalid role: ${row.role}. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Optional but validated: siteCode
    if (row.siteCode && row.siteCode.trim() && !VALID_SITES.includes(row.siteCode.toUpperCase().trim())) {
        warnings.push(`Unknown site: ${row.siteCode}`);
    }

    // Optional warnings
    if (!row.siteCode || !row.siteCode.trim()) {
        warnings.push('No site assigned');
    }

    return {
        row,
        errors,
        warnings,
        isValid: errors.length === 0
    };
};

export const ImportUsersDialog: React.FC<ImportUsersDialogProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [step, setStep] = useState<DialogStep>('upload');
    const [previewData, setPreviewData] = useState<RowValidation[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    const mutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/users/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        onSuccess: (data) => {
            setSummary(data);
            setStep('result');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Import process completed');
        },
        onError: (error: any) => {
            console.error('Import failed:', error);
            toast.error(error.response?.data?.message || 'Failed to import users');
        },
    });

    // File validation and parsing
    const handleFileSelect = useCallback((file: File) => {
        setParseError(null);
        setPreviewData([]);

        // Validate file type
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            setParseError('Invalid file type. Please upload a CSV file.');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setParseError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            return;
        }

        setSelectedFile(file);
        setIsParsing(true);

        // Parse CSV client-side for preview
        Papa.parse<ParsedRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setIsParsing(false);
                setTotalRows(results.data.length);

                if (results.errors.length > 0) {
                    setParseError(`CSV parsing error: ${results.errors[0].message}`);
                    return;
                }

                if (results.data.length === 0) {
                    setParseError('CSV file is empty or has no valid data rows.');
                    return;
                }

                // Validate all rows and store for preview
                const validatedRows = results.data.map((row, idx) => validateRow(row, idx));
                setPreviewData(validatedRows);
                setStep('preview');
            },
            error: (error) => {
                setIsParsing(false);
                setParseError(`Failed to parse file: ${error.message}`);
            }
        });
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);

    const handleUpload = () => {
        if (selectedFile) {
            mutation.mutate(selectedFile);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setSummary(null);
        setStep('upload');
        setPreviewData([]);
        setParseError(null);
        onClose();
    };

    const handleBack = () => {
        setStep('upload');
        setPreviewData([]);
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const downloadTemplate = async () => {
        try {
            const response = await api.get('/users/import-template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'import-users-template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Template downloaded');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    // Stats for preview
    const validCount = previewData.filter(r => r.isValid).length;
    const errorCount = previewData.filter(r => !r.isValid).length;
    const warningCount = previewData.filter(r => r.warnings.length > 0 && r.isValid).length;

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className={cn(
                    "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50",
                    step === 'preview' ? "w-full max-w-4xl max-h-[85vh] overflow-hidden" : "w-full max-w-md p-6"
                )}>
                    {/* Header */}
                    <div className={cn(
                        "flex justify-between items-center",
                        step === 'preview' ? "px-6 py-4 border-b border-slate-200 dark:border-white/10" : "mb-6"
                    )}>
                        <div className="flex items-center gap-3">
                            {step === 'preview' && (
                                <button
                                    onClick={handleBack}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                                </button>
                            )}
                            <Dialog.Title className="text-xl font-bold text-slate-800 dark:text-white">
                                {step === 'upload' && 'Import Users'}
                                {step === 'preview' && 'Preview Import'}
                                {step === 'result' && 'Import Complete'}
                            </Dialog.Title>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-slate-800 dark:text-white">1. Download Template</h3>
                                    <button
                                        onClick={downloadTemplate}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download CSV
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Use this template to ensure your data is formatted correctly.<br />
                                    <span className="text-slate-400 dark:text-slate-500">Columns:</span> email, fullName, role, siteCode, departmentCode, employeeId, jobTitle, phoneNumber, isActive<br />
                                    <span className="text-slate-400 dark:text-slate-500">Roles:</span> USER, AGENT, MANAGER, ADMIN<br />
                                    <span className="text-slate-400 dark:text-slate-500">Sites:</span> SPJ, SMG, KRW, JTB
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-slate-800 dark:text-white">2. Upload CSV File</h3>
                                <div
                                    className={cn(
                                        "border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-150 cursor-pointer",
                                        parseError
                                            ? "border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-900/10"
                                            : "border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                                    )}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                    />
                                    {isParsing ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                            <p className="text-sm text-slate-500">Parsing CSV file...</p>
                                        </div>
                                    ) : parseError ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <FileWarning className="w-10 h-10 text-red-500" />
                                            <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
                                            <p className="text-xs text-slate-400">Click to select a different file</p>
                                        </div>
                                    ) : (
                                        <>
                                            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Click to select or drag and drop CSV file
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">Maximum file size: 5MB</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 'preview' && (
                        <div className="flex flex-col max-h-[calc(85vh-80px)]">
                            {/* Summary Stats */}
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-slate-500" />
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                Previewing <span className="font-bold text-slate-800 dark:text-white">{totalRows}</span> rows
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1.5 text-sm">
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                <span className="text-green-600 dark:text-green-400 font-medium">{validCount} valid</span>
                                            </span>
                                            {errorCount > 0 && (
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    <span className="text-red-600 dark:text-red-400 font-medium">{errorCount} errors</span>
                                                </span>
                                            )}
                                            {warningCount > 0 && (
                                                <span className="flex items-center gap-1.5 text-sm">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium">{warningCount} warnings</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                                        {selectedFile?.name}
                                    </span>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="flex-1 overflow-auto px-6 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Site</th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Issues</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {previewData.map((item, idx) => (
                                            <tr
                                                key={idx}
                                                className={cn(
                                                    "transition-colors",
                                                    !item.isValid && "bg-red-50 dark:bg-red-900/10",
                                                    item.isValid && item.warnings.length > 0 && "bg-amber-50 dark:bg-amber-900/10"
                                                )}
                                            >
                                                <td className="px-3 py-2 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="px-3 py-2">
                                                    {!item.isValid ? (
                                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                                    ) : item.warnings.length > 0 ? (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                    ) : (
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                    )}
                                                </td>
                                                <td className={cn("px-3 py-2", !item.row.email && "text-red-500 italic")}>
                                                    {item.row.email || '(empty)'}
                                                </td>
                                                <td className={cn("px-3 py-2", !item.row.fullName && "text-red-500 italic")}>
                                                    {item.row.fullName || '(empty)'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-xs font-bold",
                                                        VALID_ROLES.includes(item.row.role?.toUpperCase())
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                    )}>
                                                        {item.row.role || '(empty)'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {item.row.siteCode ? (
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-xs font-bold",
                                                            VALID_SITES.includes(item.row.siteCode?.toUpperCase())
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                        )}>
                                                            {item.row.siteCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {item.errors.length > 0 && (
                                                        <span className="text-xs text-red-600 dark:text-red-400">
                                                            {item.errors[0]}
                                                        </span>
                                                    )}
                                                    {item.errors.length === 0 && item.warnings.length > 0 && (
                                                        <span className="text-xs text-amber-600 dark:text-amber-400">
                                                            {item.warnings[0]}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Actions */}
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    {errorCount > 0 ? (
                                        <span className="text-red-600 dark:text-red-400">
                                            {errorCount} rows have errors and will be skipped during import.
                                        </span>
                                    ) : (
                                        <span className="text-green-600 dark:text-green-400">
                                            All rows are valid and ready to import!
                                        </span>
                                    )}
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleBack}
                                        className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleUpload}
                                        disabled={validCount === 0 || mutation.isPending}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {mutation.isPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4" />
                                        )}
                                        Import {validCount} Users
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Result */}
                    {step === 'result' && summary && (
                        <div className="space-y-6 p-6 animate-in fade-in zoom-in-95">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Import Complete</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                    Here's the summary of your import process.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 p-4 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.success}</p>
                                    <p className="text-xs text-green-500 uppercase tracking-wider">Success</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 p-4 rounded-xl text-center">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</p>
                                    <p className="text-xs text-red-500 uppercase tracking-wider">Failed</p>
                                </div>
                            </div>

                            {summary.errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/10 rounded-xl p-4 max-h-[150px] overflow-y-auto">
                                    <h4 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Error Log
                                    </h4>
                                    <ul className="space-y-1">
                                        {summary.errors.map((err, idx) => (
                                            <li key={idx} className="text-xs text-red-500 font-mono">
                                                • {err}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={handleClose}
                                className="w-full py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
