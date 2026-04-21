import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
    filename: string;
    title: string;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
    isOpen,
    onClose,
    pdfUrl,
    filename,
    title,
}) => {
    const [loading, setLoading] = useState(true);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && pdfUrl) {
            setLoading(true);
            setError(null);

            api.get(pdfUrl, { responseType: 'blob' })
                .then((response) => {
                    const blob = new Blob([response.data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    setPdfBlobUrl(url);
                    setLoading(false);
                })
                .catch((err) => {
                    logger.error('Failed to load PDF preview:', err);
                    setError('Failed to load preview');
                    setLoading(false);
                });

            return () => {
                if (pdfBlobUrl) {
                    window.URL.revokeObjectURL(pdfBlobUrl);
                }
            };
        }
    }, [isOpen, pdfUrl]);

    const handleDownload = () => {
        if (pdfBlobUrl) {
            const link = document.createElement('a');
            link.href = pdfBlobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF downloaded!', { description: filename });
            onClose();
        }
    };

    const handleOpenInNewTab = () => {
        if (pdfBlobUrl) {
            window.open(pdfBlobUrl, '_blank');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                            <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                                {title}
                            </h2>
                            <p className="text-xs text-slate-500">{filename}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenInNewTab}
                            disabled={!pdfBlobUrl}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!pdfBlobUrl}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Download PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
                            <p className="text-slate-600 dark:text-slate-300 font-medium">
                                Generating preview...
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <FileText className="w-12 h-12 text-slate-400" />
                            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-500 hover:bg-slate-600 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {!loading && !error && pdfBlobUrl && (
                        <iframe
                            src={pdfBlobUrl}
                            className="w-full h-full border-0"
                            title="PDF Preview"
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// Hook for managing PDF preview state
export const usePDFPreview = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [previewConfig, setPreviewConfig] = useState<{
        url: string;
        filename: string;
        title: string;
    } | null>(null);

    const openPreview = (url: string, filename: string, title: string) => {
        setPreviewConfig({ url, filename, title });
        setIsOpen(true);
    };

    const closePreview = () => {
        setIsOpen(false);
        setPreviewConfig(null);
    };

    return {
        isOpen,
        previewConfig,
        openPreview,
        closePreview,
    };
};

export default PDFPreviewModal;
