import React, { useState } from 'react';
import { FileText, Download, ImageOff } from 'lucide-react';
import { getAttachmentUrl, isImageUrl } from './utils';

interface MessageAttachmentsProps {
    attachments: string[];
    onImageClick: (url: string) => void;
    onPdfClick?: (url: string, filename: string) => void;
    isRequester: boolean;
}

/** Last path segment, query stripped. */
const fileNameOf = (url: string, fallback: string): string => {
    const path = url.split(/[?#]/)[0];
    return decodeURIComponent(path.substring(path.lastIndexOf('/') + 1)) || fallback;
};

const isPdfUrl = (url: string): boolean => url.split(/[?#]/)[0].toLowerCase().endsWith('.pdf');

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

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments, onImageClick, onPdfClick, isRequester }) => {
    if (!attachments || attachments.length === 0) return null;

    // Filter out invalid telegram file ID formats and ensure url is a string
    const validAttachments = attachments.filter(url =>
        typeof url === 'string' && !url.startsWith('telegram:photo:') && !url.startsWith('telegram:document:')
    );

    if (validAttachments.length === 0) return null;

    return (
        <div className="mt-2 pt-2 border-t border-black/10 space-y-2">
            {validAttachments.map((url, idx) => {
                const fullUrl = getAttachmentUrl(url);
                if (!fullUrl) return null; // Skip empty URLs

                if (isImageUrl(url)) {
                    return (
                        <ImageAttachment
                            key={idx}
                            fullUrl={fullUrl}
                            name={fileNameOf(url, `Attachment ${idx + 1}`)}
                            isRequester={isRequester}
                            onImageClick={onImageClick}
                        />
                    );
                } else if (isPdfUrl(url)) {
                    const filename = fileNameOf(url, `File ${idx + 1}`);
                    return (
                        <button
                            key={idx}
                            onClick={() => onPdfClick && onPdfClick(fullUrl, filename)}
                            type="button"
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-colors ${isRequester
                                ? 'bg-slate-900/10 hover:bg-slate-900/20 border-slate-900/10'
                                : 'bg-white/10 hover:bg-white/20 border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-1.5 rounded-md ${isRequester ? 'bg-slate-900/10 text-slate-700' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    <FileText className="w-4 h-4" />
                                </div>
                                <span className={`text-sm font-medium truncate max-w-[150px] ${isRequester ? 'text-slate-800' : 'text-slate-200'}`}>
                                    {filename}
                                </span>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-md ${isRequester ? 'bg-slate-900/10' : 'bg-white/20'}`}>
                                Preview
                            </div>
                        </button>
                    );
                } else {
                    return (
                        <a
                            key={idx}
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isRequester
                                ? 'bg-slate-900/10 hover:bg-slate-900/20'
                                : 'bg-white/10 hover:bg-white/20'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-xs truncate max-w-[120px]" title={fileNameOf(url, `File ${idx + 1}`)}>
                                {fileNameOf(url, `File ${idx + 1}`)}
                            </span>
                            <Download className="w-3 h-3 opacity-50" />
                        </a>
                    );
                }
            })}
        </div>
    );
};
