import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadContract, useUpdateContract } from '../hooks/useRenewalApi';
import { UploadResponse, ValidationInfo, isUploadWarning } from '../types/renewal.types';
import { toast } from 'sonner';

interface ContractUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ContractUploadModal: React.FC<ContractUploadModalProps> = ({ isOpen, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
    const [showScannedWarning, setShowScannedWarning] = useState(false);
    const [validationInfo, setValidationInfo] = useState<ValidationInfo | null>(null);
    const [formData, setFormData] = useState({
        poNumber: '',
        vendorName: '',
        description: '',
        startDate: '',
        endDate: '',
    });

    const uploadMutation = useUploadContract();
    const updateMutation = useUpdateContract();

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile?.type === 'application/pdf') {
            setFile(droppedFile);
        } else {
            toast.error('Only PDF files are allowed');
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async (forceUpload = false) => {
        if (!file) return;

        try {
            const result = await uploadMutation.mutateAsync({ file, forceUpload });
            
            // Check if this is a validation warning
            if (isUploadWarning(result)) {
                setValidationInfo(result.validation);
                setShowScannedWarning(true);
                return;
            }

            // Success - process the result
            setUploadResult(result);
            setShowScannedWarning(false);
            setFormData({
                poNumber: result.extraction.poNumber || '',
                vendorName: result.extraction.vendorName || '',
                description: result.extraction.description || '',
                startDate: result.extraction.startDate ? new Date(result.extraction.startDate).toISOString().split('T')[0] : '',
                endDate: result.extraction.endDate ? new Date(result.extraction.endDate).toISOString().split('T')[0] : '',
            });

            // Show appropriate message based on validation
            if (result.validation?.wasForced) {
                toast.warning('PDF uploaded with limited extraction. Please fill in the details manually.');
            } else {
                toast.success('PDF extracted successfully! Please review the data.');
            }
        } catch (error) {
            toast.error('Failed to upload and extract PDF');
        }
    };

    const handleForceUpload = () => {
        setShowScannedWarning(false);
        handleUpload(true);
    };

    const handleCancelWarning = () => {
        setShowScannedWarning(false);
        setFile(null);
        setValidationInfo(null);
    };

    const handleSave = async () => {
        if (!uploadResult) return;

        try {
            await updateMutation.mutateAsync({
                id: uploadResult.contract.id,
                data: {
                    poNumber: formData.poNumber || undefined,
                    vendorName: formData.vendorName || undefined,
                    description: formData.description || undefined,
                    startDate: formData.startDate || undefined,
                    endDate: formData.endDate || undefined,
                },
            });
            toast.success('Contract saved successfully');
            handleClose();
        } catch (error) {
            toast.error('Failed to save contract');
        }
    };

    const handleClose = () => {
        setFile(null);
        setUploadResult(null);
        setShowScannedWarning(false);
        setValidationInfo(null);
        setFormData({
            poNumber: '',
            vendorName: '',
            description: '',
            startDate: '',
            endDate: '',
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Upload Contract</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!uploadResult ? (
                        // Step 1: Upload PDF
                        <div className="space-y-6">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                                    }`}
                            >
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <FileText className="w-10 h-10 text-red-500" />
                                        <div className="text-left">
                                            <p className="font-bold text-slate-800 dark:text-white">{file.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setFile(null)}
                                            className="ml-4 p-2 text-slate-400 hover:text-red-500"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <p className="text-slate-600 dark:text-slate-300 font-medium mb-2">
                                            Drag & drop your PDF file here
                                        </p>
                                        <p className="text-sm text-slate-400 mb-4">or</p>
                                        <label className="inline-block">
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            <span className="px-6 py-2 bg-primary text-slate-900 font-bold rounded-xl cursor-pointer hover:bg-primary/90 transition-colors">
                                                Browse Files
                                            </span>
                                        </label>
                                    </>
                                )}
                            </div>

                            <Button
                                onClick={() => handleUpload(false)}
                                disabled={!file || uploadMutation.isPending}
                                className="w-full bg-primary text-slate-900 font-bold py-6 rounded-xl hover:bg-primary/90"
                            >
                                {uploadMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Extracting Data...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5 mr-2" />
                                        Upload & Extract
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : showScannedWarning ? (
                        // Scanned Image Warning
                        <div className="space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg mb-2">
                                            Scanned Image Detected
                                        </h3>
                                        <p className="text-amber-700 dark:text-amber-400 mb-3">
                                            This file appears to be a scanned image PDF. Only{' '}
                                            <strong>{validationInfo?.characterCount || 0}</strong> characters
                                            were detected, which suggests the text cannot be reliably extracted.
                                        </p>
                                        <p className="text-sm text-amber-600 dark:text-amber-500">
                                            For best results, please upload a digital PDF with selectable text.
                                            If you proceed, you will need to enter contract details manually.
                                        </p>
                                        {validationInfo?.rawTextPreview && (
                                            <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-800">
                                                <p className="text-xs text-slate-500 mb-1">Text preview:</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                                                    "{validationInfo.rawTextPreview || 'No text detected'}..."
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleCancelWarning}
                                    className="flex-1 py-6 rounded-xl"
                                >
                                    Cancel & Upload Different File
                                </Button>
                                <Button
                                    onClick={handleForceUpload}
                                    disabled={uploadMutation.isPending}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-6 rounded-xl"
                                >
                                    {uploadMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Proceed with Manual Entry'
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // Step 2: Review & Edit
                        <div className="space-y-6">
                            {/* Extraction Confidence */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl ${uploadResult.extraction.confidence >= 0.7
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : uploadResult.extraction.confidence >= 0.4
                                    ? 'bg-orange-50 dark:bg-orange-900/20'
                                    : 'bg-red-50 dark:bg-red-900/20'
                                }`}>
                                {uploadResult.extraction.confidence >= 0.7 ? (
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                ) : (
                                    <AlertCircle className="w-6 h-6 text-orange-500" />
                                )}
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">
                                        Extraction Confidence: {Math.round(uploadResult.extraction.confidence * 100)}%
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        Strategy: {uploadResult.extraction.strategy}
                                        {uploadResult.extraction.confidence < 0.7 && ' - Please verify the extracted data'}
                                    </p>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        PO Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.poNumber}
                                        onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Enter PO number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        Vendor Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.vendorName}
                                        onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Enter vendor name"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        placeholder="Enter description"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                        End Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    {!formData.endDate && (
                                        <p className="text-xs text-orange-500 mt-1">
                                            End date is required for reminders
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1 py-6 rounded-xl"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending}
                                    className="flex-1 bg-primary text-slate-900 font-bold py-6 rounded-xl hover:bg-primary/90"
                                >
                                    {updateMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Contract'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
