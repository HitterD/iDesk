import React, { useEffect, useRef, useState } from 'react';
import { Lock, Reply, SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MessageReactions, ReactionPicker, type Reaction } from '@/components/ui/ChatReactions';
import { MessageAttachments } from './MessageAttachments';
import { MessageActionMenu } from './MessageActionMenu';
import { QuoteSnippet } from './QuoteBlock';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatMessageTime, parseQuote, PHOTO_ONLY_PATTERN, toDisplayName } from './messageThread';
import type { TicketDetail } from './types';

type ChatMessage = NonNullable<TicketDetail['messages']>[number];

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    /** Sits on the viewer's side (right): staff messages for agents, own messages for requesters. */
    isOutgoing: boolean;
    isSticker: boolean;
    /** First bubble of a run from one sender: shows the avatar and name. */
    isGroupStart: boolean;
    isGroupEnd: boolean;
    isHighlighted: boolean;
    /** Small badge after the name, e.g. "Pemohon" (agent view) or "IT Support" (requester view). */
    roleLabel?: string;
    /** Name shown for the viewer's own messages (requester view: "Anda"). */
    ownLabel?: string;
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    onReply: (content: string) => void;
    onQuoteClick: () => void;
    onImageClick: (url: string) => void;
    onPdfClick: (url: string, filename: string) => void;
}

/** Touch: press and hold a bubble to reveal its tool pill (mockup ticket-chat.js LONG_PRESS_MS). */
const LONG_PRESS_MS = 450;

const useLongPress = () => {
    const [open, setOpen] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const clear = () => { if (timer.current) clearTimeout(timer.current); };

    useEffect(() => {
        if (!open) return undefined;
        const close = (event: PointerEvent) => {
            if (!rowRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);
    useEffect(() => clear, []);

    return {
        open,
        rowRef,
        bind: {
            onPointerDown: (event: React.PointerEvent) => {
                if (event.pointerType !== 'touch') return;
                clear();
                timer.current = setTimeout(() => setOpen(true), LONG_PRESS_MS);
            },
            onPointerUp: clear,
            onPointerCancel: clear,
            onPointerMove: clear,
        },
    };
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isOwn,
    isOutgoing,
    isSticker,
    isGroupStart,
    isHighlighted,
    roleLabel,
    ownLabel,
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
    // Attachment-only bubbles stay neutral so file cards read the same for both sides.
    const onAccent = isOutgoing && !isInternal && showText;
    const time = formatMessageTime(message.createdAt);
    const name = isOwn && ownLabel ? ownLabel : toDisplayName(message.sender?.fullName);
    const press = useLongPress();
    const menuAlign = isOutgoing ? 'end' : 'start';

    const who = [
        isGroupStart && <b key="name">{name}</b>,
        isGroupStart && roleLabel && <span key="role" className="chat-role">{roleLabel}</span>,
        isInternal && <span key="lock" className="chat-lock"><Lock aria-hidden="true" />Internal</span>,
        <time key="time" dateTime={message.createdAt} title={formatDateTimeID(message.createdAt)}>{time}</time>,
    ].filter(Boolean);

    return (
        <div
            ref={press.rowRef}
            data-message-id={message.id}
            data-direction={isOutgoing ? 'out' : 'in'}
            className={cn(
                'chat-msg rounded-2xl transition-colors duration-700',
                isOutgoing && 'is-out',
                isGroupStart ? 'mt-3.5' : 'mt-1.5',
                press.open && 'tools-open',
                isHighlighted && 'bg-primary/10 dark:bg-primary/15',
            )}
        >
            <div className="chat-msg-av">
                {isGroupStart && <UserAvatar user={message.sender} size="xs" className="h-7 w-7 rounded-full text-[10.5px]" />}
            </div>

            <div className="chat-msg-col">
                <div className="chat-who">{isOutgoing ? [...who].reverse() : who}</div>

                <div className="chat-bubble-wrap" {...press.bind}>
                    {isSticker ? (
                        <div className="chat-sticker" role="img" aria-label={`Sticker ${message.content}`} title={formatDateTimeID(message.createdAt)}>
                            {message.content}
                        </div>
                    ) : (
                        <div
                            title={formatDateTimeID(message.createdAt)}
                            className={cn(
                                'chat-bubble',
                                onAccent && 'chat-bubble-out',
                                !onAccent && !isInternal && 'chat-bubble-in',
                                isInternal && 'is-internal',
                            )}
                        >
                            {quote && (
                                <QuoteSnippet
                                    sender={quote.sender}
                                    quote={quote.quote}
                                    onAccent={onAccent}
                                    onClick={onQuoteClick}
                                    className="mb-1.5"
                                />
                            )}
                            {showText && <p className="whitespace-pre-wrap">{text}</p>}
                            <MessageAttachments
                                attachments={message.attachments}
                                attachmentInfo={message.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={onPdfClick}
                                isRequester={!onAccent}
                            />
                        </div>
                    )}

                    <div className="chat-tools" role="toolbar" aria-label="Aksi pesan">
                        <ReactionPicker reactions={reactions} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} align={menuAlign}>
                            <button type="button" aria-label="Tambah reaksi" title="Tambah reaksi">
                                <SmilePlus aria-hidden="true" />
                            </button>
                        </ReactionPicker>
                        <button type="button" aria-label="Balas" title="Balas" onClick={() => onReply(text || '')}>
                            <Reply aria-hidden="true" />
                        </button>
                        <MessageActionMenu
                            messageId={message.id}
                            messageContent={text || ''}
                            isOwn={isOwn}
                            isInternal={isInternal}
                            isSticker={isSticker}
                            onReply={onReply}
                            align={menuAlign}
                        />
                    </div>
                </div>

                <MessageReactions reactions={reactions} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} />
            </div>
        </div>
    );
};
