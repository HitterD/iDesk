import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    CheckCircle2,
    X,
    
    FileText,
    Sparkles,
    ZoomIn,
    Loader2,
    Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ResolveTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: {
        id: string;
        ticketNumber?: string;
        title: string;
    };
    onConfirm: (resolutionNote: string, files: File[]) => Promise<void> | void;
    isLoading?: boolean;
}

const QUICK_TEMPLATES = [
    'Masalah berhasil diperbaiki dan telah dites berjalan normal.',
    'User account berhasil di-unlock dan kredensial telah di-reset.',
    'Konfigurasi sistem & software telah disesuaikan dan berjalan optimal.',
    'Penggantian / perbaikan unit hardware telah selesai dilakukan.',
    'Panduan solusi & verifikasi telah dikonfirmasi bersama user.',
];

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
];

export const ResolveTicketModal: React.FC<ResolveTicketModalProps> = ({
    isOpen,
    onClose,
    ticket,
    onConfirm,
    isLoading = false,
}) => {
    const [resolutionNote, setResolutionNote] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
    const [activeLightboxName, setActiveLightboxName] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Reset state on modal open
    useEffect(() => {
        if (isOpen) {
            setResolutionNote('');
            setFiles([]);
            setIsDragging(false);
            setActiveLightboxUrl(null);
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Generate object URLs for image preview with cleanup
    const filePreviewMap = useMemo(() => {
        const map = new Map<File, string>();
        files.forEach((f) => {
            if (f.type.startsWith('image/')) {
                map.set(f, URL.createObjectURL(f));
            }
        });
        return map;
    }, [files]);

    useEffect(() => {
        return () => {
            filePreviewMap.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [filePreviewMap]);


    const addFiles = (newFiles: FileList | File[]) => {
        const incoming = Array.from(newFiles);
        const validFiles: File[] = [];

        for (const file of incoming) {
            if (files.length + validFiles.length >= MAX_ATTACHMENTS) {
                toast.error(`Maksimal ${MAX_ATTACHMENTS} file lampiran`);
                break;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(`Ukuran file "${file.name}" melebihi batas ${MAX_FILE_SIZE_MB}MB`);
                continue;
            }
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                toast.error(`Tipe berkas "${file.name}" tidak didukung. Harap gunakan format gambar (PNG/JPG/WEBP) atau PDF.`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            setFiles((prev) => [...prev, ...validFiles]);
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // Paste handler for screenshots (Ctrl+V)
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const ext = file.type.split('/')[1] || 'png';
                    const namedFile = new File([file], `screenshot-resolve-${Date.now()}.${ext}`, {
                        type: file.type,
                    });
                    pastedFiles.push(namedFile);
                }
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            addFiles(pastedFiles);
            toast.success(`${pastedFiles.length} screenshot berhasil ditempelkan`);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    const handleFormSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isLoading) return;
        const note = resolutionNote.trim();
        if (!note && files.length === 0) {
            toast.error('Harap isi penjelasan tindakan yang dilakukan untuk menyelesaikan tiket');
            textareaRef.current?.focus();
            return;
        }
        await onConfirm(note || 'Tiket telah diselesaikan.', files);
    };

    const handleModalKeyDown = (e: React.KeyboardEvent) => {
        // Hentikan bubbling keyboard events ke parent component di React tree (e.g. TicketListRow)
        e.stopPropagation();

        // Shortcut Ctrl+Enter atau Cmd+Enter untuk konfirmasi penyelesaian tiket
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleFormSubmit();
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            <TicketActionDialog open={isOpen} onClose={onClose} title="Selesaikan tiket" busy={isLoading}
                onEscapeKeyDown={(event) => {
                    if (activeLightboxUrl) {
                        event.preventDefault();
                        setActiveLightboxUrl(null);
                    }
                }}>
                <div className="ticket-action-inner" onKeyDown={handleModalKeyDown}>
                    {/* Header Banner */}
                    <div className=" p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-white flex items-center justify-center shadow-md shadow-primary-500/20 shrink-0 mt-0.5">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    Selesaikan tiket
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)} · <span className="text-slate-700 dark:text-slate-200 font-semibold">{ticket.title}</span>
                                </p>
                            </div>
                        </div>
                        <Button variant="soft"
                            type="button"
                            aria-label="Tutup dialog"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 space-y-4">
                        {/* Quick Solution Templates */}
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-primary dark:text-primary" />
                                <span>Template Solusi Cepat:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_TEMPLATES.map((tmpl, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setResolutionNote(tmpl)}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer text-left"
                                    >
                                        {tmpl.length > 38 ? `${tmpl.slice(0, 38)}…` : tmpl}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Textarea: Tindakan & Solusi */}
                        <div>
                            <label htmlFor="ticket-resolution-note" className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                                Tindakan &amp; Penjelasan Solusi <span className="text-rose-500">*</span>
                            </label>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={cn(
                                    "relative rounded-xl border bg-slate-50/70 dark:bg-slate-800/50 p-2.5 transition-all",
                                    isDragging
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-slate-300 dark:border-slate-700 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                                )}
                            >
                                <textarea
                                    ref={textareaRef}
                                    id="ticket-resolution-note"
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                            e.preventDefault();
                                            handleFormSubmit();
                                        }
                                    }}
                                    onPaste={handlePaste}
                                    placeholder="Jelaskan tindakan teknis atau solusi yang telah dilakukan untuk menyelesaikan tiket ini..."
                                    rows={4}
                                    className="w-full text-xs bg-transparent border-0 resize-y outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed font-sans"
                                />

                                {/* Composer Bottom Bar */}
                                <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                                    <div className="flex items-center gap-2">
                                        <Button variant="soft"
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-primary transition-colors cursor-pointer shadow-2xs"
                                        >
                                            <Paperclip className="w-3.5 h-3.5" />
                                            <span>Lampirkan Bukti ({files.length}/{MAX_ATTACHMENTS})</span>
                                        </Button>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {resolutionNote.length} karakter
                                    </span>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        addFiles(e.target.files);
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </div>

                        {/* Visual Image Thumbnail Tray */}
                        {files.length > 0 && (
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    Berkas Bukti Foto / Dokumen Lampiran:
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {files.map((file, idx) => {
                                        const previewUrl = filePreviewMap.get(file);
                                        const isImage = file.type.startsWith('image/');

                                        return (
                                            <div
                                                key={idx}
                                                className="group relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-2 overflow-hidden shadow-2xs flex flex-col justify-between"
                                            >
                                                {isImage && previewUrl ? (
                                                    <button type="button" aria-label={`Lihat lampiran ${file.name}`}
                                                        className="relative h-20 w-full rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-900 cursor-pointer mb-1.5"
                                                        onClick={() => {
                                                            setActiveLightboxUrl(previewUrl);
                                                            setActiveLightboxName(file.name);
                                                        }}
                                                    >
                                                        <img
                                                            src={previewUrl}
                                                            alt={file.name}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium gap-1">
                                                            <ZoomIn className="w-3.5 h-3.5" />
                                                            <span>Lihat</span>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div className="h-20 w-full rounded-lg bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 flex flex-col items-center justify-center text-primary dark:text-primary mb-1.5">
                                                        <FileText className="w-6 h-6 mb-1" />
                                                        <span className="text-[10px] font-bold uppercase">PDF Dokumen</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 min-w-0">
                                                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                                                        {file.name}
                                                    </span>
                                                    <span className="shrink-0 font-mono">
                                                        {(file.size / 1024).toFixed(0)}KB
                                                    </span>
                                                </div>

                                                {/* Delete Button */}
                                                <Button variant="soft"
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-90 hover:opacity-100 shadow-sm cursor-pointer"
                                                    title="Hapus"
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                <span>Tekan</span>
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400">
                                    Ctrl+Enter
                                </kbd>
                                <span>untuk kirim</span>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                                <Button variant="soft"
                                    type="button"
                                    onClick={onClose}
                                    disabled={isLoading}
                                >
                                    Batal
                                </Button>
                                <Button variant="primary" aria-busy={isLoading}
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Menyelesaikan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Selesaikan tiket</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>

            {/* Keep preview inside the trapped dialog so pointer and keyboard access remain available. */}
            {activeLightboxUrl && (
                <div
                    className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setActiveLightboxUrl(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-3 bg-slate-950/80 border-b border-white/10 text-white text-xs">
                            <span className="truncate font-semibold">{activeLightboxName}</span>
                            <Button variant="soft"
                                type="button"
                                aria-label="Tutup pratinjau lampiran"
                                onClick={() => setActiveLightboxUrl(null)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="p-2 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
                            <img
                                src={activeLightboxUrl}
                                alt={activeLightboxName}
                                className="max-w-full max-h-[75vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
            </TicketActionDialog>
        </>,
        document.body
    );
};

export default ResolveTicketModal;
