import { useState, type ClipboardEvent, type ChangeEvent, type Ref, type RefObject } from 'react';
import { FileArchive, FileSpreadsheet, File as FileIcon, Image as ImageIcon, Maximize2, Paperclip, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATTACHMENT_ACCEPT, FILE_SIZE_LIMITS, MAX_ATTACHMENTS_PER_TICKET, formatFileSize } from '@/lib/file-validation';
import { CharCounter, FieldError, TicketFormRow, DESCRIPTION_MIN } from './TicketFormSection';

const DESCRIPTION_MAX = 5000;
const MIN_TEXTAREA_HEIGHT = 120;

export interface PreviewItem { url: string; name: string; size: number; index: number }

function FileTypeIcon({ name }: { name: string }) {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet aria-hidden="true" className="text-emerald-600 dark:text-emerald-400" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive aria-hidden="true" className="text-amber-600 dark:text-amber-400" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon aria-hidden="true" className="text-blue-600 dark:text-blue-400" />;
    return <FileIcon aria-hidden="true" className="text-primary" />;
}

export interface DescriptionComposerProps {
    id: string;
    textareaRef: Ref<HTMLTextAreaElement>;
    fileInputRef: RefObject<HTMLInputElement | null>;
    value: string;
    error?: string;
    placeholder: string;
    files: File[];
    previews: Map<File, string>;
    onChange: (value: string) => void;
    onPaste: (e: ClipboardEvent) => void;
    onDropFiles: (files: File[]) => void;
    onFileInput: (e: ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile: (index: number) => void;
    onPreview: (item: PreviewItem) => void;
}

/** Details textarea with the attachment tray and toolbar; file rules stay with the caller. */
export function DescriptionComposer(props: DescriptionComposerProps) {
    const { id, textareaRef, fileInputRef, value, error, placeholder, files, previews } = props;
    const [dragging, setDragging] = useState(false);
    return (
        <TicketFormRow label="Detail masalah" htmlFor={id} required meta={<CharCounter value={value} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} />}>
            <div
                className={cn('ct-ta', dragging && 'is-dragging', error && 'is-invalid')}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); props.onDropFiles(Array.from(e.dataTransfer.files || [])); }}
            >
                <textarea id={id} ref={textareaRef} required maxLength={DESCRIPTION_MAX} value={value} placeholder={placeholder}
                    aria-invalid={Boolean(error)} onPaste={props.onPaste}
                    onChange={e => {
                        props.onChange(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.max(MIN_TEXTAREA_HEIGHT, e.target.scrollHeight) + 'px';
                    }} />
                {files.length > 0 && <AttachmentTray files={files} previews={previews} onRemove={props.onRemoveFile} onPreview={props.onPreview} />}
                <div className="ct-tbar">
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={props.onFileInput} accept={ATTACHMENT_ACCEPT} />
                    <button type="button" className="ct-chip ct-attach" onClick={() => fileInputRef.current?.click()} title="Lampirkan File / Screenshot">
                        <Paperclip aria-hidden="true" />Lampirkan
                        {files.length > 0 && <span className="ct-attach-count">{files.length}</span>}
                    </button>
                    <span className="ct-tbar-hint">Tempel gambar (Ctrl+V) atau seret file ke sini</span>
                    <span className="ct-spacer" />
                    <span className="ct-tbar-limit">
                        Maks. {MAX_ATTACHMENTS_PER_TICKET} file · {formatFileSize(FILE_SIZE_LIMITS.ATTACHMENT)}/file, video {formatFileSize(FILE_SIZE_LIMITS.VIDEO)}
                    </span>
                </div>
            </div>
            <FieldError message={error} />
        </TicketFormRow>
    );
}

function AttachmentTray({ files, previews, onRemove, onPreview }: {
    files: File[]; previews: Map<File, string>; onRemove: (index: number) => void; onPreview: (item: PreviewItem) => void;
}) {
    return (
        <div className="ct-tray">
            {files.map((file, index) => {
                const url = previews.get(file);
                const key = `${file.name}-${file.size}-${index}`;
                if (url) {
                    const open = () => onPreview({ url, name: file.name, size: file.size, index });
                    return (
                        <div key={key} className="ct-thumb group">
                            <img src={url} alt={file.name} onClick={open} />
                            <button type="button" onClick={open} className="ct-thumb-zoom" title="Lihat preview gambar" aria-label={`Lihat ${file.name}`}>
                                <Maximize2 aria-hidden="true" />
                            </button>
                            <button type="button" onClick={e => { e.stopPropagation(); onRemove(index); }} className="ct-thumb-remove" title="Hapus gambar" aria-label={`Hapus ${file.name}`}>
                                <X aria-hidden="true" />
                            </button>
                        </div>
                    );
                }
                return (
                    <div key={key} className="ct-file">
                        <FileTypeIcon name={file.name} />
                        <span className="truncate max-w-[150px]" title={file.name}>{file.name}</span>
                        <span className="ct-file-size">{formatFileSize(file.size)}</span>
                        <button type="button" onClick={() => onRemove(index)} className="ct-file-remove" title="Hapus file" aria-label={`Hapus ${file.name}`}>
                            <Trash2 aria-hidden="true" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
