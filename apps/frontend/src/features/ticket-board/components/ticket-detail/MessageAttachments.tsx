import React from 'react';
import { FileText, Download } from 'lucide-react';
import { getAttachmentUrl, isImageUrl } from './utils';

interface MessageAttachmentsProps {
    attachments: string[];
    onImageClick: (url: string) => void;
    isRequester: boolean;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments, onImageClick, isRequester }) => {
    if (!attachments || attachments.length === 0) return null;

    return (
        <div className="mt-2 pt-2 border-t border-black/10 space-y-2">
            {attachments.map((url, idx) => {
                const fullUrl = getAttachmentUrl(url);

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
