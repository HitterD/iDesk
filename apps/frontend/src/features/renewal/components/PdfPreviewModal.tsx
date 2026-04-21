import React, { useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RenewalContract } from '../types/renewal.types';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    contract: RenewalContract | null;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    isOpen,
    onClose,
    contract,
}) => {
    const [zoom, setZoom] = useState(100);
    const [rotation, setRotation] = useState(0);

    if (!isOpen || !contract) return null;

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
    const pdfUrl = contract.filePath ? `${baseUrl}${contract.filePath}` : null;

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleDownload = () => {
        if (pdfUrl) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = contract.originalFileName || 'contract.pdf';
            link.click();
        }
    };

    const handleOpenNewTab = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-[90vw] h-[90vh] max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white truncate">
                            {contract.originalFileName || 'Contract Preview'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {contract.poNumber || 'No PO Number'} • {contract.vendorName || 'Unknown Vendor'}
                        </p>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 mx-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 min-w-[3rem] text-center">
                            {zoom}%
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRotate}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenNewTab}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-800 p-4">
                    {pdfUrl ? (
                        <div
                            className="flex items-center justify-center min-h-full"
                            style={{
                                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.2s ease'
                            }}
                        >
                            <iframe
                                src={`${pdfUrl}#view=FitH`}
                                className="w-full h-full min-h-[70vh] bg-white rounded-lg shadow-lg"
                                title="PDF Preview"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <p className="text-lg font-medium">No PDF attached</p>
                            <p className="text-sm">This contract was created manually without a file</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
