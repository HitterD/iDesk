import React, { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { attachmentKind } from './attachmentKind';
import { formatFileSize, MAX_ATTACHMENTS_PER_TICKET } from '@/lib/file-validation';
import { cn } from '@/lib/utils';

interface AttachmentTrayProps {
    files: File[];
    onRemove: (index: number) => void;
    /** Upload progress 0-100 while sending; null when idle. */
    progress: number | null;
}

const FileThumb: React.FC<{ file: File }> = ({ file }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isImage = file.type.startsWith('image/');

    useEffect(() => {
        if (!isImage) return;
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isImage]);

    if (isImage && previewUrl) {
        return <img src={previewUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />;
    }
    const { Icon, tone } = attachmentKind(file.name);
    return (
        <span className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', tone)}>
            <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
    );
};

/** Files queued for the next message, shown above the composer. */
export const AttachmentTray: React.FC<AttachmentTrayProps> = ({ files, onRemove, progress }) => {
    if (files.length === 0) return null;
    const isUploading = progress !== null;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return (
        <div className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2 px-0.5 text-xs">
                <Paperclip className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span className="font-bold text-slate-700 dark:text-slate-300">
                    {files.length}/{MAX_ATTACHMENTS_PER_TICKET} file · {formatFileSize(totalSize)}
                </span>
                {isUploading && (
                    <span className="ml-auto font-semibold text-primary tabular-nums">Mengunggah {progress}%</span>
                )}
            </div>
            {isUploading && (
                <div
                    className="h-1 mb-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progress unggah lampiran"
                >
                    <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
                </div>
            )}
            <ul className="grid gap-1.5 sm:grid-cols-2">
                {files.map((file, index) => (
                    <li
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex items-center gap-2.5 p-1.5 pr-1 bg-white dark:bg-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                        <FileThumb file={file} />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate" title={file.name}>{file.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onRemove(index)}
                            disabled={isUploading}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Hapus ${file.name}`}
                            title="Hapus"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
