import React from 'react';
import { FileText, Download } from 'lucide-react';
import { getAttachmentUrl, isImageUrl } from './ticket-detail/utils';

interface ChatBubbleAttachmentProps {
    attachments: string[];
    onImageClick: (url: string) => void;
}

/** Last path segment, query stripped — good enough to label a download tile. */
const fileNameOf = (url: string): string => {
    const path = url.split(/[?#]/)[0];
    return decodeURIComponent(path.substring(path.lastIndexOf('/') + 1)) || 'attachment';
};

export const ChatBubbleAttachment: React.FC<ChatBubbleAttachmentProps> = ({ attachments, onImageClick }) => {
    if (!attachments || attachments.length === 0) return null;

    return (
        <div className="grid grid-cols-2 gap-2 mt-2">
            {attachments.map((url, index) => {
                const fullUrl = getAttachmentUrl(url);
                if (!fullUrl) return null;

                const name = fileNameOf(url);

                // PDFs, docs and zips used to be piped into <img> too, which could only
                // ever render a broken-image icon with no way to reach the file.
                if (!isImageUrl(url)) {
                    return (
                        <a
                            key={index}
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 h-24 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                            title={name}
                        >
                            <FileText className="w-5 h-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                            <span className="text-xs text-slate-300 break-all line-clamp-3">{name}</span>
                            <Download className="w-4 h-4 flex-shrink-0 text-slate-500 ml-auto" aria-hidden="true" />
                        </a>
                    );
                }

                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => onImageClick(fullUrl)}
                        className="block w-full rounded-lg overflow-hidden border border-white/10 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Open image ${name}`}
                    >
                        <img
                            src={fullUrl}
                            alt={name}
                            loading="lazy"
                            className="w-full h-24 object-cover"
                        />
                    </button>
                );
            })}
        </div>
    );
};
