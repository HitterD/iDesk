import React from 'react';
import { Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { quoteKind, toDisplayName } from './messageThread';

interface QuoteSnippetProps {
    sender: string;
    quote: string;
    /** Inside an own (accent-coloured) bubble the quote is drawn in white tints. */
    onAccent?: boolean;
    onClick?: () => void;
    className?: string;
}

/** The quoted message shown at the top of a reply bubble and above the composer. */
export const QuoteSnippet: React.FC<QuoteSnippetProps> = ({ sender, quote, onAccent, onClick, className }) => {
    const kind = quoteKind(quote);
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            title={onClick ? 'Lihat pesan asli' : undefined}
            className={cn(
                'flex w-full min-w-0 items-stretch gap-2 rounded-lg py-1.5 pl-2 pr-2.5 text-left',
                onAccent ? 'bg-white/15' : 'bg-slate-900/[0.04] dark:bg-white/[0.06]',
                onClick && 'cursor-pointer transition-colors',
                onClick && (onAccent ? 'hover:bg-white/25' : 'hover:bg-slate-900/[0.07] dark:hover:bg-white/10'),
                className,
            )}
        >
            <span aria-hidden="true" className={cn('w-[3px] shrink-0 rounded-full', onAccent ? 'bg-white/70' : 'bg-primary')} />
            <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-xs font-semibold', onAccent ? 'text-white' : 'text-primary')}>
                    {toDisplayName(sender)}
                </span>
                <span className={cn(
                    'mt-0.5 flex items-center gap-1 text-xs leading-snug',
                    onAccent ? 'text-white/80' : 'text-slate-500 dark:text-slate-400',
                )}>
                    {kind === 'photo' && <ImageIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    {kind === 'file' && <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span className="line-clamp-2 break-words">
                        {kind === 'photo' ? 'Foto' : kind === 'file' ? 'File' : quote}
                    </span>
                </span>
            </span>
        </Tag>
    );
};

interface ReplyPreviewProps {
    senderName: string;
    content: string;
    onClose: () => void;
}

/** Bar above the composer while a reply is being written. */
export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ senderName, content, onClose }) => (
    <div className="mb-2 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
        <QuoteSnippet sender={`Membalas ${toDisplayName(senderName)}`} quote={content} className="flex-1" />
        <button
            type="button"
            onClick={onClose}
            aria-label="Batal membalas"
            title="Batal (Esc)"
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
            <X className="h-4 w-4" />
        </button>
    </div>
);
