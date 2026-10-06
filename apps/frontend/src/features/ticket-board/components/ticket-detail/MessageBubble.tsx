import React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MessageReactions } from '@/components/ui/ChatReactions';
import { MessageAttachments } from './MessageAttachments';
import { MessageActionMenu } from './MessageActionMenu';
import { QuoteSnippet } from './QuoteBlock';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatMessageTime, parseQuote, PHOTO_ONLY_PATTERN, toDisplayName } from './messageThread';
import type { TicketDetail } from './types';

type ChatMessage = NonNullable<TicketDetail['messages']>[number];
type Reaction = { emoji: string; count: number; users: string[]; hasReacted: boolean };

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    isSticker: boolean;
    /** First bubble of a run from one sender: shows the name. */
    isGroupStart: boolean;
    /** Last bubble of a run: shows the avatar and the bubble tail. */
    isGroupEnd: boolean;
    isHighlighted: boolean;
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    onReply: (content: string) => void;
    onQuoteClick: () => void;
    onImageClick: (url: string) => void;
    onPdfClick: (url: string, filename: string) => void;
}

const AVATAR_SLOT = 'w-8 shrink-0';

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isOwn,
    isSticker,
    isGroupStart,
    isGroupEnd,
    isHighlighted,
    reactions,
    onAddReaction,
    onRemoveReaction,
    onReply,
    onQuoteClick,
    onImageClick,
    onPdfClick,
}) => {
    const isInternal = Boolean(message.isInternal);
    const quote = parseQuote(message.content);
    const text = quote ? quote.body : message.content;
    const showText = Boolean(text) && !PHOTO_ONLY_PATTERN.test(text.trim());
    const hasAttachments = (message.attachments?.length ?? 0) > 0;
    // Attachment-only bubbles stay neutral so file cards read the same for both sides.
    const onAccent = isOwn && !isInternal && showText;
    const time = formatMessageTime(message.createdAt);
    const hasReactions = reactions.length > 0;
    const reactionProps = {
        reactions,
        onAddReaction,
        onRemoveReaction,
        align: isOwn ? 'right' as const : 'left' as const,
        addButtonClassName: 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity',
    };

    return (
        <div
            data-message-id={message.id}
            className={cn(
                'group flex items-end gap-2 rounded-2xl transition-colors duration-700',
                isOwn && 'flex-row-reverse',
                isGroupStart ? 'mt-3' : 'mt-0.5',
                isHighlighted && 'bg-primary/10 dark:bg-primary/15',
            )}
        >
            <div className={AVATAR_SLOT}>
                {isGroupEnd && !isOwn && (
                    <UserAvatar user={message.sender} size="sm" className="h-8 w-8 rounded-full" />
                )}
            </div>

            <div className={cn('flex min-w-0 max-w-[85%] flex-col sm:max-w-[65%] xl:max-w-[560px]', isOwn ? 'items-end' : 'items-start')}>
                {isGroupStart && !isOwn && (
                    <span className="mb-1 ml-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {toDisplayName(message.sender?.fullName)}
                    </span>
                )}

                <div className={cn('relative flex items-center gap-1', isOwn && 'flex-row-reverse')}>
                    {isSticker ? (
                        <div className="select-none p-1 text-5xl leading-none" title={formatDateTimeID(message.createdAt)}>
                            {message.content}
                        </div>
                    ) : (
                        <div
                            title={formatDateTimeID(message.createdAt)}
                            className={cn(
                                'relative min-w-[72px] rounded-[20px] px-3.5 py-2 text-left',
                                onAccent && 'bg-primary text-primary-foreground',
                                !onAccent && !isInternal && 'bg-white text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:text-slate-100',
                                isInternal && 'bg-amber-50 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-50 dark:ring-amber-900/70',
                                isGroupEnd && (isOwn ? 'rounded-br-md' : 'rounded-bl-md'),
                            )}
                        >
                            {isInternal && (
                                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                    <Lock className="h-3 w-3" aria-hidden="true" />
                                    Catatan internal
                                </p>
                            )}
                            {quote && (
                                <QuoteSnippet
                                    sender={quote.sender}
                                    quote={quote.quote}
                                    onAccent={onAccent}
                                    onClick={onQuoteClick}
                                    className="mb-1.5 mt-0.5"
                                />
                            )}
                            {showText && (
                                <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]">
                                    {text}
                                    {/* Reserves room so the time never overlaps the last line of text. */}
                                    {!hasAttachments && <span aria-hidden="true" className="inline-block w-10" />}
                                </p>
                            )}
                            <MessageAttachments
                                attachments={message.attachments}
                                attachmentInfo={message.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={onPdfClick}
                                isRequester={!onAccent}
                            />
                            <span className={cn(
                                'text-[11px] tabular-nums leading-none',
                                onAccent ? 'text-primary-foreground/70' : 'text-slate-400 dark:text-slate-500',
                                showText && !hasAttachments ? 'absolute bottom-2 right-3' : 'mt-1 block text-right',
                            )}>
                                {time}
                            </span>
                        </div>
                    )}

                    <MessageActionMenu
                        messageId={message.id}
                        messageContent={text || ''}
                        isOwn={isOwn}
                        isInternal={isInternal}
                        onReply={onReply}
                        className="shrink-0"
                    />
                    {/* Without reactions the add button sits beside the bubble so it takes no row of its own. */}
                    {!hasReactions && <MessageReactions {...reactionProps} className="my-0 shrink-0" />}
                </div>

                {hasReactions && (
                    <MessageReactions {...reactionProps} className={cn('my-1', isOwn && 'justify-end')} />
                )}
            </div>
        </div>
    );
};
