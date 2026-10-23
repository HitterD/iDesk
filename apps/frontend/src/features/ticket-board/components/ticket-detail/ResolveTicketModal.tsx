import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CheckCircle2, X, FileText, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

interface ResolveTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: { id: string; ticketNumber?: string; title: string };
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
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export const ResolveTicketModal: React.FC<ResolveTicketModalProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false }) => {
    const [resolutionNote, setResolutionNote] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
    const [activeLightboxName, setActiveLightboxName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setResolutionNote('');
        setFiles([]);
        setIsDragging(false);
        setActiveLightboxUrl(null);
        setError(null);
        const timer = window.setTimeout(() => textareaRef.current?.focus(), 100);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    const filePreviewMap = useMemo(() => new Map(files
        .filter((file) => file.type.startsWith('image/'))
        .map((file) => [file, URL.createObjectURL(file)])), [files]);
    useEffect(() => () => filePreviewMap.forEach((url) => URL.revokeObjectURL(url)), [filePreviewMap]);

    const addFiles = (incoming: FileList | File[]) => {
        const accepted: File[] = [];
        for (const file of Array.from(incoming)) {
            if (files.length + accepted.length >= MAX_ATTACHMENTS) {
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
            accepted.push(file);
        }
        if (accepted.length) setFiles((previous) => [...previous, ...accepted]);
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pasted = Array.from(event.clipboardData.items)
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile()).filter((file): file is File => Boolean(file))
            .map((file) => new File([file], `screenshot-resolve-${Date.now()}.${file.type.split('/')[1] || 'png'}`, { type: file.type }));
        if (pasted.length) {
            event.preventDefault();
            addFiles(pasted);
            toast.success(`${pasted.length} screenshot berhasil ditempelkan`);
        }
    };

    const handleFormSubmit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (isLoading) return;
        const note = resolutionNote.trim();
        if (!note && !files.length) {
            const message = 'Harap isi penjelasan tindakan yang dilakukan untuk menyelesaikan tiket';
            setError(message);
            toast.error(message);
            textareaRef.current?.focus();
            return;
        }
        try {
            setError(null);
            await onConfirm(note || 'Tiket telah diselesaikan.', files);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Gagal menyelesaikan tiket. Coba lagi.');
        }
    };

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Selesaikan tiket" busy={isLoading}
            onEscapeKeyDown={(event) => {
                if (activeLightboxUrl) { event.preventDefault(); setActiveLightboxUrl(null); }
            }}>
            <form className="ticket-action-inner ticket-action-simple" onSubmit={handleFormSubmit}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void handleFormSubmit();
                    }
                }}>
                <header className="ticket-action-header">
                    <div><h2>Selesaikan tiket</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)} · <span>{ticket.title}</span></p></div>
                    <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={isLoading}><X /></Button>
                </header>
                <div className="ticket-action-body"
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                    onDrop={(event) => { event.preventDefault(); setIsDragging(false); if (!isLoading) addFiles(event.dataTransfer.files); }}>
                    <div className="ticket-action-field">
                        <label htmlFor="ticket-resolution-note">Solusi <span>(wajib, atau lampirkan bukti)</span></label>
                        <textarea ref={textareaRef} id="ticket-resolution-note" value={resolutionNote}
                            onChange={(event) => { setResolutionNote(event.target.value); setError(null); }}
                            onPaste={handlePaste} disabled={isLoading} rows={5}
                            aria-invalid={Boolean(error)} aria-describedby={error ? 'ticket-resolution-error' : undefined}
                            data-dragging={isDragging}
                            placeholder="Jelaskan tindakan teknis atau solusi yang telah dilakukan untuk menyelesaikan tiket ini..." />
                        {error && <p id="ticket-resolution-error" role="alert">{error}</p>}
                    </div>
                    <div className="ticket-action-field">
                        <label htmlFor="ticket-resolution-template">Gunakan template <span>(opsional)</span></label>
                        <select id="ticket-resolution-template" defaultValue="" disabled={isLoading}
                            onChange={(event) => { if (event.target.value) { setResolutionNote(event.target.value); setError(null); textareaRef.current?.focus(); } }}>
                            <option value="">Pilih template solusi…</option>
                            {QUICK_TEMPLATES.map((template) => <option key={template} value={template}>{template}</option>)}
                        </select>
                    </div>
                    <div className="ticket-action-attachments">
                        <Button variant="soft" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || files.length >= MAX_ATTACHMENTS}><Paperclip />Lampirkan</Button>
                        <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf" className="hidden"
                            onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
                        <p className="ticket-action-help">Maks. {MAX_ATTACHMENTS} file · {MAX_FILE_SIZE_MB} MB/file<br />JPEG, PNG, WebP, GIF, atau PDF. Bisa tempel atau seret gambar.</p>
                        {files.length > 0 && <ul className="ticket-action-files" aria-label="Lampiran terpilih">
                            {files.map((file, index) => <li key={index}>
                                {filePreviewMap.has(file) ? <button type="button" className="ticket-action-file-preview" aria-label={`Lihat lampiran ${file.name}`}
                                    onClick={() => { setActiveLightboxUrl(filePreviewMap.get(file)!); setActiveLightboxName(file.name); }}>
                                    <img src={filePreviewMap.get(file)} alt="" />
                                </button> : <FileText aria-hidden="true" />}
                                <span>{file.name} <small>{(file.size / 1024).toFixed(0)} KB</small></span>
                                <Button variant="subtle" type="button" aria-label={`Hapus ${file.name}`} disabled={isLoading}
                                    onClick={() => setFiles((previous) => previous.filter((_, position) => position !== index))}><X />Hapus</Button>
                            </li>)}
                        </ul>}
                    </div>
                </div>
                <footer className="ticket-action-footer">
                    <p>Ctrl+Enter untuk menyelesaikan</p>
                    <div><Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Batal</Button>
                        <Button variant="primary" className="ticket-action-complete" type="submit" loading={isLoading} disabled={isLoading}>
                            <CheckCircle2 />{isLoading ? 'Menyelesaikan…' : 'Selesaikan tiket'}
                        </Button></div>
                </footer>
            </form>
            {/* Preview stays inside Radix's focus and pointer boundary. First Escape closes only this preview. */}
            {activeLightboxUrl && <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4" onClick={() => setActiveLightboxUrl(null)}>
                <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden flex flex-col" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between p-3 text-white text-xs gap-3">
                        <span className="truncate">{activeLightboxName}</span>
                        <Button variant="soft" type="button" aria-label="Tutup pratinjau lampiran" onClick={() => setActiveLightboxUrl(null)}><X /></Button>
                    </div>
                    <img src={activeLightboxUrl} alt={activeLightboxName} className="max-w-full max-h-[75vh] object-contain" />
                </div>
            </div>}
        </TicketActionDialog>
    );
};

export default ResolveTicketModal;
