import React, { useEffect, useRef, useState } from 'react';
import { Ban, Check, CheckCheck, Lock, Pin, Reply, SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MessageReactions, ReactionPicker, type Reaction } from '@/components/ui/ChatReactions';
import { MessageAttachments } from './MessageAttachments';
import { highlightMentions } from './MentionPicker';
import { MessageActionMenu } from './MessageActionMenu';
import { QuoteSnippet } from './QuoteBlock';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { DELETED_QUOTE, formatMessageTime, parseQuote, PHOTO_ONLY_PATTERN, toDisplayName, type ReadTick } from './messageThread';
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
    /** Arrived after the thread was opened: plays the entrance animation. */
    isArriving?: boolean;
    /** Small badge after the name, e.g. "Pemohon" (agent view) or "IT Support" (requester view). */
    roleLabel?: string;
    /** Name shown for the viewer's own messages (requester view: "Anda"). */
    ownLabel?: string;
    /** Read tick for the viewer's outgoing public messages; absent = no tick (incoming, internal). */
    tick?: ReadTick;
    reactions: Reaction[];
    onAddReaction: (emoji: string) => void;
    onRemoveReaction: (emoji: string) => void;
    onReply: (content: string) => void;
    /** False on archived internal notes and closed tickets, where the server refuses reactions. */
    canReact?: boolean;
    /** Present only when the viewer may edit / delete this message right now. */
    onEdit?: () => void;
    onDelete?: () => void;
    onPin?: () => void;
    onUnpin?: () => void;
    onQuoteClick: () => void;
    onImageClick: (url: string) => void;
    onPdfClick: (url: string, filename: string) => void;
}

/** Touch: press and hold a bubble to reveal its tool pill (mockup ticket-chat.js LONG_PRESS_MS). */
const LONG_PRESS_MS = 450;

const useLongPress = () => {
    const [open, setOpen] = useState(false);
    /** A touch press is in progress: suppress the native callout / text selection meanwhile. */
    const [pressing, setPressing] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const clear = () => { if (timer.current) clearTimeout(timer.current); };
    const release = () => { clear(); setPressing(false); };

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
        pressing,
        rowRef,
        bind: {
            onPointerDown: (event: React.PointerEvent) => {
                if (event.pointerType !== 'touch') return;
                clear();
                setPressing(true);
                timer.current = setTimeout(() => setOpen(true), LONG_PRESS_MS);
            },
            onPointerUp: release,
            onPointerCancel: release,
            onPointerMove: release,
            // Android fires contextmenu on long-press; only swallow it while our own press is active.
            onContextMenu: (event: React.MouseEvent) => { if (pressing) event.preventDefault(); },
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
    isArriving = false,
    roleLabel,
    ownLabel,
    tick,
    reactions,
    onAddReaction,
    onRemoveReaction,
    onReply,
    canReact = true,
    onEdit,
    onDelete,
    onPin,
    onUnpin,
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

    // WhatsApp-style: the sender's name opens a run of someone else's bubbles, inside the bubble.
    const showName = isGroupStart && !isOwn;
    const meta = (
        <span className="chat-meta">
            {isInternal && <span className="chat-lock"><Lock aria-hidden="true" />Internal</span>}
            {message.isPinned && <Pin role="img" aria-label="Disematkan" className="chat-pin-mark" />}
            {message.editedAt && !message.isDeleted && <span className="chat-edited">diedit</span>}
            <time dateTime={message.createdAt} title={formatDateTimeID(message.createdAt)}>{time}</time>
            {tick === 'read' && <CheckCheck role="img" aria-label="Dibaca" className="chat-tick is-read" />}
            {tick === 'sent' && <Check role="img" aria-label="Terkirim" className="chat-tick" />}
        </span>
    );

    return (
        <div
            ref={press.rowRef}
            data-message-id={message.id}
            data-direction={isOutgoing ? 'out' : 'in'}
            className={cn(
                'chat-msg rounded-2xl transition-colors duration-700',
                isOutgoing && 'is-out',
                isArriving && 'is-arriving',
                isGroupStart ? 'mt-3' : 'mt-0.5',
                press.open && 'tools-open',
                isHighlighted && 'bg-primary/10 dark:bg-primary/15',
            )}
        >
            <div className="chat-msg-av">
                {isGroupStart && <UserAvatar user={message.sender} size="xs" className="h-7 w-7 rounded-full text-[10.5px]" />}
            </div>

            <div className="chat-msg-col">
                {isGroupStart && roleLabel && <div className="chat-who"><span className="chat-role">{roleLabel}</span></div>}

                {message.isDeleted ? (
                    <div className="chat-bubble-wrap">
                        <div className={cn('chat-bubble is-deleted', isGroupStart && 'has-tail')} title={formatDateTimeID(message.createdAt)}>
                            {showName && <b className="chat-bubble-name">{name}</b>}
                            <p><Ban aria-hidden="true" />{message.deletedByAdmin ? 'Dihapus oleh admin' : 'Pesan ini telah dihapus'}</p>
                            <span className="chat-meta">
                                <time dateTime={message.createdAt}>{time}</time>
                            </span>
                        </div>
                    </div>
                ) : (
                <div className={cn('chat-bubble-wrap', press.pressing && 'is-pressing')} {...press.bind}>
                    {isSticker ? (
                        <div className="chat-sticker-wrap">
                            <div className="chat-sticker" role="img" aria-label={`Sticker ${message.content}`} title={formatDateTimeID(message.createdAt)}>
                                {message.content}
                            </div>
                            {meta}
                        </div>
                    ) : (
                        <div
                            title={formatDateTimeID(message.createdAt)}
                            className={cn(
                                'chat-bubble',
                                onAccent && 'chat-bubble-out',
                                !onAccent && !isInternal && 'chat-bubble-in',
                                isInternal && 'is-internal',
                                isGroupStart && 'has-tail',
                            )}
                        >
                            {showName && <b className="chat-bubble-name">{name}</b>}
                            {quote && (
                                <QuoteSnippet
                                    sender={message.replyTo?.senderName || quote.sender}
                                    // The link wins over the stored text: a deleted original reads as deleted.
                                    quote={message.replyTo ? (message.replyTo.isDeleted ? DELETED_QUOTE : message.replyTo.snippet || quote.quote) : quote.quote}
                                    onAccent={onAccent}
                                    onClick={onQuoteClick}
                                    className="mb-1.5"
                                />
                            )}
                            {showText && (
                                <p className="whitespace-pre-wrap">
                                    {highlightMentions(text, message.mentions ?? [], (name, key) => (
                                        <span key={key} className="chat-mention">{name}</span>
                                    ))}
                                </p>
                            )}
                            <MessageAttachments
                                attachments={message.attachments}
                                attachmentInfo={message.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={onPdfClick}
                                isRequester={!onAccent}
                            />
                            {meta}
                        </div>
                    )}

                    <div className="chat-tools" role="toolbar" aria-label="Aksi pesan">
                        {canReact && (
                            <ReactionPicker reactions={reactions} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} align={menuAlign}>
                                <button type="button" aria-label="Tambah reaksi" title="Tambah reaksi">
                                    <SmilePlus aria-hidden="true" />
                                </button>
                            </ReactionPicker>
                        )}
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
                            onEdit={onEdit && (() => onEdit())}
                            onDelete={onDelete && (() => onDelete())}
                            onPin={onPin}
                            onUnpin={onUnpin}
                            align={menuAlign}
                        />
                    </div>
                </div>
                )}

                {!message.isDeleted && (
                    <MessageReactions reactions={reactions} onAddReaction={onAddReaction} onRemoveReaction={onRemoveReaction} />
                )}
            </div>
        </div>
    );
};
