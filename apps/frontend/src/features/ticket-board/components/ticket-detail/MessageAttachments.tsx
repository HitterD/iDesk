import React, { useState } from 'react';
import { Download, Eye, ImageOff } from 'lucide-react';
import { getAttachmentUrl, isImageUrl } from './utils';
import { attachmentKind, extensionOf, type AttachmentInfo } from './attachmentKind';
import { formatFileSize } from '@/lib/file-validation';
import { cn } from '@/lib/utils';

interface MessageAttachmentsProps {
    attachments: string[];
    /** Original names and sizes, matched to `attachments` by path. */
    attachmentInfo?: AttachmentInfo[] | null;
    onImageClick: (url: string) => void;
    onPdfClick?: (url: string, filename: string) => void;
    isRequester: boolean;
}

/** Last path segment, query stripped. */
const fileNameOf = (url: string, fallback: string): string => {
    const path = url.split(/[?#]/)[0];
    return decodeURIComponent(path.substring(path.lastIndexOf('/') + 1)) || fallback;
};

/**
 * A failed image used to `display: none` itself, leaving a bare clickable box that
 * opened a lightbox onto nothing. Falls back to a labelled download link instead.
 */
const ImageAttachment: React.FC<{
    fullUrl: string;
    name: string;
    isRequester: boolean;
    onImageClick: (url: string) => void;
}> = ({ fullUrl, name, isRequester, onImageClick }) => {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isRequester ? 'bg-slate-900/10 hover:bg-slate-900/20' : 'bg-white/10 hover:bg-white/20'}`}
            >
                <ImageOff className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs truncate max-w-[120px]" title={name}>{name}</span>
                <Download className="w-3 h-3 opacity-50" aria-hidden="true" />
            </a>
        );
    }

    return (
        <button
            type="button"
            className="group relative inline-block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onImageClick(fullUrl)}
            aria-label={`Open image ${name}`}
        >
            <img
                src={fullUrl}
                alt={name}
                loading="lazy"
                className={`max-w-[180px] max-h-[120px] rounded-lg object-cover border-2 transition-colors ${isRequester
                    ? 'border-slate-800/20 group-hover:border-slate-800/50'
                    : 'border-white/20 group-hover:border-primary/50'
                    }`}
                onError={() => setFailed(true)}
            />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                <span className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded ${isRequester ? 'bg-slate-900/70 text-white' : 'bg-black/60 text-white'}`}>
                    Perbesar
                </span>
            </span>
        </button>
    );
};

/** File card: type icon, original name, size; PDFs preview in-app, everything else downloads. */
const FileAttachment: React.FC<{
    fullUrl: string;
    name: string;
    size?: number;
    isRequester: boolean;
    onPreview?: () => void;
}> = ({ fullUrl, name, size, isRequester, onPreview }) => {
    const { Icon, label, tone } = attachmentKind(name);
    const meta = size ? `${label} · ${formatFileSize(size)}` : label;
    const cardClass = cn(
        'w-full max-w-[280px] flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors',
        isRequester
            ? 'bg-slate-100 hover:bg-slate-200/70 border-transparent dark:bg-slate-700/50 dark:hover:bg-slate-700'
            : 'bg-white/10 hover:bg-white/20 border-white/10',
    );
    const body = (
        <>
            <span className={cn('p-2 rounded-md shrink-0', tone)}>
                <Icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate" title={name}>{name}</span>
                <span className="block text-[11px] opacity-70">{meta}</span>
            </span>
            {onPreview
                ? <Eye className="w-4 h-4 opacity-60 shrink-0" aria-hidden="true" />
                : <Download className="w-4 h-4 opacity-60 shrink-0" aria-hidden="true" />}
        </>
    );

    if (onPreview) {
        return (
            <button type="button" onClick={onPreview} className={cardClass} aria-label={`Preview ${name}`}>
                {body}
            </button>
        );
    }
    return (
        <a href={fullUrl} download={name} target="_blank" rel="noopener noreferrer" className={cardClass} aria-label={`Download ${name}`}>
            {body}
        </a>
    );
};

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments, attachmentInfo, onImageClick, onPdfClick, isRequester }) => {
    if (!attachments || attachments.length === 0) return null;

    // Filter out invalid telegram file ID formats and ensure url is a string
    const validAttachments = attachments.filter(url =>
        typeof url === 'string' && !url.startsWith('telegram:photo:') && !url.startsWith('telegram:document:')
    );

    if (validAttachments.length === 0) return null;

    const infoByPath = new Map((attachmentInfo ?? []).map((info) => [info.path, info]));

    return (
        <div className="mt-1.5 first:mt-0.5 space-y-1.5">
            {validAttachments.map((url, idx) => {
                const fullUrl = getAttachmentUrl(url);
                if (!fullUrl) return null; // Skip empty URLs

                const info = infoByPath.get(url);
                const name = info?.name || fileNameOf(url, `File ${idx + 1}`);

                if (isImageUrl(url)) {
                    return (
                        <ImageAttachment
                            key={idx}
                            fullUrl={fullUrl}
                            name={name}
                            isRequester={isRequester}
                            onImageClick={onImageClick}
                        />
                    );
                }
                const canPreview = extensionOf(url) === '.pdf' && onPdfClick;
                return (
                    <FileAttachment
                        key={idx}
                        fullUrl={fullUrl}
                        name={name}
                        size={info?.size}
                        isRequester={isRequester}
                        onPreview={canPreview ? () => onPdfClick(fullUrl, name) : undefined}
                    />
                );
            })}
        </div>
    );
};
