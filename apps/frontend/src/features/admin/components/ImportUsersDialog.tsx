import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface ImportUsersDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ImportSummary {
    success: number;
    failed: number;
    errors: string[];
}

export const ImportUsersDialog: React.FC<ImportUsersDialogProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);

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
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Import process completed');
        },
        onError: (error: any) => {
            console.error('Import failed:', error);
            toast.error('Failed to import users');
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setSummary(null);
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            mutation.mutate(selectedFile);
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setSummary(null);
        onClose();
    };

    const downloadTemplate = () => {
        const headers = 'email,fullName,employeeId,departmentCode,role';
        const sample = 'john@example.com,John Doe,EMP001,IT,USER';
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${sample}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'users_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-navy-main border border-white/10 rounded-xl shadow-2xl z-50 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-xl font-bold text-white">
                            Import Users
                        </Dialog.Title>
                        <button
                            onClick={handleClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {!summary ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-navy-light border border-white/10 rounded-lg space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-white">1. Download Template</h3>
                                    <button
                                        onClick={downloadTemplate}
                                        className="text-xs text-neon-blue hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download CSV
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Use this template to ensure your data is formatted correctly.
                                    Required columns: email, fullName, role.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-white">2. Upload CSV File</h3>
                                <div
                                    className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:border-neon-green/50 transition-colors cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                    />
                                    <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                    {selectedFile ? (
                                        <p className="text-sm text-neon-green font-medium">
                                            {selectedFile.name}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-slate-400">
                                            Click to select or drag and drop CSV file
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!selectedFile || mutation.isPending}
                                    className="px-4 py-2 bg-neon-green text-navy-main font-bold rounded-lg hover:bg-neon-green/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {mutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4" />
                                    )}
                                    Import Users
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Import Complete</h3>
                                <p className="text-slate-400 text-sm">
                                    Here's the summary of your import process.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-400">{summary.success}</p>
                                    <p className="text-xs text-green-300/70 uppercase tracking-wider">Success</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-400">{summary.failed}</p>
                                    <p className="text-xs text-red-300/70 uppercase tracking-wider">Failed</p>
                                </div>
                            </div>

                            {summary.errors.length > 0 && (
                                <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                                    <h4 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Error Log
                                    </h4>
                                    <ul className="space-y-1">
                                        {summary.errors.map((err, idx) => (
                                            <li key={idx} className="text-xs text-red-300/80 font-mono">
                                                • {err}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={handleClose}
                                className="w-full py-2 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
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
