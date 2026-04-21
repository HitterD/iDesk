import React from 'react';
import { FileText, Download } from 'lucide-react';
import { getAttachmentUrl, isImageUrl } from './utils';

interface MessageAttachmentsProps {
    attachments: string[];
    onImageClick: (url: string) => void;
    onPdfClick?: (url: string, filename: string) => void;
    isRequester: boolean;
}

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
                        <div
                            key={idx}
                            className="cursor-pointer group relative inline-block"
                            onClick={() => onImageClick(fullUrl)}
                        >
                            <img
                                src={fullUrl}
                                alt={`Attachment ${idx + 1}`}
                                className={`max-w-[180px] max-h-[120px] rounded-lg object-cover border-2 transition-colors ${isRequester
                                    ? 'border-slate-800/20 group-hover:border-slate-800/50'
                                    : 'border-white/20 group-hover:border-primary/50'
                                    }`}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-colors flex items-center justify-center">
                                <span className={`opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded ${isRequester ? 'bg-slate-900/70 text-white' : 'bg-black/60 text-white'
                                    }`}>
                                    🔍 Perbesar
                                </span>
                            </div>
                        </div>
                    );
                } else if (url.toLowerCase().endsWith('.pdf')) {
                    const filename = url.split('/').pop() || `File ${idx + 1}`;
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
                            <span className="text-xs truncate max-w-[120px]">
                                {url.split('/').pop() || `File ${idx + 1}`}
                            </span>
                            <Download className="w-3 h-3 opacity-50" />
                        </a>
                    );
                }
            })}
        </div>
    );
};
