import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Wifi, Lock, FileText, Pin, ChevronDown, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { CLOSED_TICKET_NOTICE } from './constants';
import { MessageAttachments } from './MessageAttachments';
import { SystemMessageEvent } from './SystemMessageEvent';
import { MessageBubble } from './MessageBubble';
import { ChatComposer, ReplyTarget, STICKERS } from './ChatComposer';
import {
    continuesGroup,
    dateSeparatorLabel,
    findQuotedMessageId,
    isSameDay,
    parseQuote,
    quotableText,
    toDisplayName,
} from './messageThread';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

interface TicketChatProps {
    ticket: TicketDetail;
    isConnected: boolean;
    /** Rejects when the message was not sent; the draft is kept for a retry. */
    onSendMessage: (
        content: string,
        files?: FileList | null,
        isInternal?: boolean,
        onUploadProgress?: (percent: number) => void,
    ) => Promise<void>;
    onImageClick: (url: string) => void;
    typingUsers?: { [key: string]: string };
    onTypingStart?: () => void;
    onTypingStop?: () => void;
    showCannedResponses?: boolean;
}

type Reaction = { emoji: string; count: number; users: string[]; hasReacted: boolean };
type ChatMessage = NonNullable<TicketDetail['messages']>[number];

const HIGHLIGHT_MS = 1600;

const isResolutionStatement = (content?: string) =>
    Boolean(content?.includes('Tiket Dinyatakan Selesai') || content?.includes('Tiket Diselesaikan (Resolved)'));

const DateSeparator: React.FC<{ date: string }> = ({ date }) => (
    <div className="my-5 flex justify-center first:mt-1">
        <span className="px-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {dateSeparatorLabel(date)}
        </span>
    </div>
);

export const TicketChat: React.FC<TicketChatProps> = ({
    ticket,
    isConnected,
    onSendMessage,
    onImageClick,
    typingUsers = {},
    onTypingStart,
    onTypingStop,
    showCannedResponses
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef<HTMLDivElement>(null);
    const rootIssueRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
    const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
    const [highlightedId, setHighlightedId] = useState<string | null>(null);
    const [messageReactions, setMessageReactions] = useState<Record<string, Reaction[]>>({});
    const { user } = useAuth();
    const pdfPreview = usePDFPreview();
    const isTicketClosed = ticket.status === 'CLOSED';

    const handleAddReaction = useCallback((messageId: string, emoji: string) => {
        const currentUserName = user?.fullName || 'User';
        setMessageReactions(prev => {
            const list = prev[messageId] || [];
            const existing = list.find(r => r.emoji === emoji);
            if (existing) {
                if (existing.hasReacted) return prev;
                return {
                    ...prev,
                    [messageId]: list.map(r => r.emoji === emoji ? {
                        ...r,
                        count: r.count + 1,
                        users: [...r.users, currentUserName],
                        hasReacted: true,
                    } : r)
                };
            }
            return {
                ...prev,
                [messageId]: [...list, { emoji, count: 1, users: [currentUserName], hasReacted: true }]
            };
        });
    }, [user?.fullName]);

    const handleRemoveReaction = useCallback((messageId: string, emoji: string) => {
        const currentUserName = user?.fullName || 'User';
        setMessageReactions(prev => {
            const list = prev[messageId] || [];
            return {
                ...prev,
                [messageId]: list.map(r => {
                    if (r.emoji === emoji) {
                        return {
                            ...r,
                            count: Math.max(0, r.count - 1),
                            users: r.users.filter(u => u !== currentUserName),
                            hasReacted: false,
                        };
                    }
                    return r;
                }).filter(r => r.count > 0)
            };
        });
    }, [user?.fullName]);

    const ticketVariables = useMemo(() => ({
        user_name: (ticket as any).requester?.fullName || (ticket as any).customerSession?.fullName || ticket.user?.fullName || 'Customer',
        agent_name: user?.fullName || 'Agent',
        ticket_id: ticket.ticketNumber || ticket.id?.slice(0, 8) || '',
        category: ticket.category || '',
    }), [ticket, user]);

    const isStaff = Boolean(user?.role && user.role !== 'USER');
    const canAddInternalNote = (user?.role === 'ADMIN' || user?.role === 'AGENT') && ticket.viewerAccess !== 'requester';

    // Initial Attachments from the report
    const initialMessage = ticket.messages?.find(
        m => !m.isSystemMessage && m.attachments?.length > 0
    );
    const initialAttachments = initialMessage?.attachments ?? [];

    const sortedMessages = useMemo(
        () => [...(ticket.messages ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        [ticket.messages],
    );

    // Identify the initial ticket creation message that is already displayed in Root Issue Card
    const genesisMessageId = useMemo(() => {
        if (sortedMessages.length === 0 || !ticket.description) return null;
        const first = sortedMessages[0];
        if (
            first.content?.trim() === ticket.description?.trim() &&
            (!first.sender?.id || first.sender?.id === ticket.user?.id)
        ) {
            return first.id;
        }
        return null;
    }, [sortedMessages, ticket.description, ticket.user?.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (ticket?.messages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [ticket?.messages, typingUsers]);

    useEffect(() => () => {
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    }, []);

    const isOwnTicket = Boolean(user?.id && ticket.user?.id === user.id);
    const isOwn = useCallback((message: ChatMessage) => Boolean(
        (message.sender?.id && user?.id && message.sender.id === user.id) ||
        (user?.fullName && message.sender?.fullName === user.fullName)
    ), [user?.id, user?.fullName]);

    const jumpToQuoted = (message: ChatMessage) => {
        const quote = parseQuote(message.content);
        if (!quote) return;
        const targetId = findQuotedMessageId(sortedMessages, message.id, quote);
        const target = targetId
            ? streamRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(targetId)}"]`)
            : null;
        if (!targetId || !target) {
            toast.info('Pesan asli tidak tersedia');
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(targetId);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    };

    const handleSendSticker = async (sticker: string) => {
        await onSendMessage(sticker, null, false);
    };

    const typingUserNames = Object.values(typingUsers);

    const scrollToRootIssue = () => {
        rootIssueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const isBubble = (m: ChatMessage | undefined) =>
        Boolean(m && !m.isSystemMessage && !isResolutionStatement(m.content));
    /** Messages in display order; system cards stay in place, internal notes only for staff. */
    const visibleMessages = sortedMessages.filter(m =>
        m.id !== genesisMessageId && !(isBubble(m) && m.isInternal && !canAddInternalNote)
    );
    const groupKey = (m: ChatMessage) => ({ senderId: m.sender?.id || m.sender?.fullName, isInternal: m.isInternal, createdAt: m.createdAt });

    return (
        <div className="relative flex h-full flex-col overflow-hidden">

            {/* ── Pinned issue bar (hidden on mobile for a cleaner view) ── */}
            <div className="z-10 hidden shrink-0 items-center justify-between gap-3 border-b border-[hsl(var(--idesk-border)/0.7)] px-5 py-2 sm:flex">
                <button
                    type="button"
                    onClick={scrollToRootIssue}
                    className="group flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                    title="Lompat ke laporan awal"
                >
                    <Pin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-semibold text-slate-900 transition-colors group-hover:text-primary dark:text-white">
                                {ticket.title}
                            </span>
                            {initialAttachments.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                                    <Paperclip className="h-3 w-3" />
                                    {initialAttachments.length}
                                </span>
                            )}
                        </div>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {ticket.description || 'Tidak ada deskripsi'}
                        </p>
                    </div>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                    <span
                        className={cn(
                            'flex items-center gap-1.5 text-[11px] font-medium',
                            isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        )}
                        title={isConnected ? 'Terhubung real-time' : 'Offline'}
                    >
                        <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                        {isConnected ? 'Live' : 'Offline'}
                    </span>

                    <button
                        type="button"
                        onClick={() => setIsPinnedExpanded(prev => !prev)}
                        className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        aria-label={isPinnedExpanded ? 'Ciutkan detail' : 'Tampilkan detail'}
                        aria-expanded={isPinnedExpanded}
                    >
                        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isPinnedExpanded && 'rotate-180')} />
                    </button>
                </div>
            </div>

            {/* Expanded Pinned Drawer */}
            {isPinnedExpanded && (
                <div className="custom-scrollbar z-10 hidden max-h-60 shrink-0 space-y-3 overflow-y-auto border-b border-slate-200/70 bg-white p-5 shadow-sm animate-in slide-in-from-top-2 duration-200 dark:border-slate-800 dark:bg-slate-900 sm:block">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Dilaporkan oleh <strong className="font-semibold text-slate-900 dark:text-white">{toDisplayName(ticket.user.fullName)}</strong>
                            {' · '}{formatDateTimeID(ticket.createdAt)} ({formatRelativeTime(ticket.createdAt)})
                        </span>
                        {ticket.device && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {ticket.device}
                            </span>
                        )}
                    </div>
                    <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                        {ticket.description || <span className="italic text-slate-400">Tidak ada deskripsi</span>}
                    </p>
                    {initialAttachments.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium text-slate-500">Lampiran awal ({initialAttachments.length})</p>
                            <MessageAttachments
                                attachments={initialAttachments}
                                attachmentInfo={initialMessage?.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Messages Stream ── */}
            <div ref={streamRef} className="chat-stream custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">

                {/* Root issue card (genesis message) */}
                <div ref={rootIssueRef} className={cn('chat-bubble-in mb-2 max-w-3xl rounded-[18px] p-4 sm:p-5', isOwnTicket && 'ml-auto')}>
                    <div className="mb-3 flex items-center gap-3">
                        <UserAvatar user={ticket.user} size="sm" className="h-9 w-9 rounded-full" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    {toDisplayName(ticket.user.fullName)}
                                </h3>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                    Pembuat tiket
                                </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {formatDateTimeID(ticket.createdAt)} · {formatRelativeTime(ticket.createdAt)}
                            </p>
                        </div>
                        <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Laporan awal
                        </span>
                    </div>

                    <h4 className="mb-1.5 hidden text-[15px] font-semibold text-slate-900 dark:text-white sm:block">
                        {ticket.title}
                    </h4>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
                        {ticket.description || <span className="italic text-slate-400">Tidak ada deskripsi tambahan.</span>}
                    </p>

                    {initialAttachments.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                Lampiran ({initialAttachments.length})
                            </p>
                            <MessageAttachments
                                attachments={initialAttachments}
                                attachmentInfo={initialMessage?.attachmentInfo}
                                onImageClick={onImageClick}
                                onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                isRequester={false}
                            />
                        </div>
                    )}
                </div>

                {/* Chat messages */}
                <div>
                    {visibleMessages.map((message, index) => {
                        const prev = visibleMessages[index - 1];
                        const next = visibleMessages[index + 1];
                        const newDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
                        const separator = newDay ? <DateSeparator date={message.createdAt} /> : null;

                        if (!isBubble(message)) {
                            return (
                                <React.Fragment key={message.id}>
                                    {separator}
                                    <div className="chat-system-event my-3" data-system-event={message.id}>
                                        <SystemMessageEvent
                                            content={message.content}
                                            createdAt={message.createdAt}
                                            attachments={message.attachments}
                                            onImageClick={onImageClick}
                                        />
                                    </div>
                                </React.Fragment>
                            );
                        }

                        const isGroupStart = !isBubble(prev) || !prev || !continuesGroup(groupKey(prev), groupKey(message));
                        const isGroupEnd = !isBubble(next) || !next || !continuesGroup(groupKey(message), groupKey(next));

                        return (
                            <React.Fragment key={message.id}>
                                {separator}
                                <MessageBubble
                                    message={message}
                                    isOwn={isOwn(message)}
                                    isSticker={STICKERS.includes(message.content?.trim() || '')}
                                    isGroupStart={isGroupStart || newDay}
                                    isGroupEnd={isGroupEnd}
                                    isHighlighted={highlightedId === message.id}
                                    reactions={messageReactions[message.id] || []}
                                    onAddReaction={(emoji) => handleAddReaction(message.id, emoji)}
                                    onRemoveReaction={(emoji) => handleRemoveReaction(message.id, emoji)}
                                    onReply={() => {
                                        setReplyTo({
                                            id: message.id,
                                            senderName: message.sender?.fullName || 'Unknown',
                                            content: quotableText(message.content),
                                        });
                                        messageInputRef.current?.focus();
                                    }}
                                    onQuoteClick={() => jumpToQuoted(message)}
                                    onImageClick={onImageClick}
                                    onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                />
                            </React.Fragment>
                        );
                    })}

                    {typingUserNames.length > 0 && (
                        <div className="chat-bubble-in mt-3 ml-10 flex w-fit items-center gap-2 rounded-[20px] px-3.5 py-2 text-xs">
                            <span className="flex gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 delay-0" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 delay-100" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 delay-200" />
                            </span>
                            <span>{typingUserNames.map(toDisplayName).join(', ')} sedang mengetik…</span>
                        </div>
                    )}
                </div>
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            {isTicketClosed ? (
                <div
                    role="status"
                    className="chat-composer flex items-center justify-center gap-2 text-xs font-medium text-slate-600 safe-area-pb dark:text-slate-300"
                >
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>{CLOSED_TICKET_NOTICE}</span>
                </div>
            ) : (
                <ChatComposer
                    inputRef={messageInputRef}
                    isStaff={isStaff}
                    canAddInternalNote={canAddInternalNote}
                    showCannedResponses={showCannedResponses !== false}
                    ticketVariables={ticketVariables}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    onSend={(content, files, isInternal, onProgress) => onSendMessage(content, files, isInternal, onProgress)}
                    onSendSticker={handleSendSticker}
                    onTypingStart={onTypingStart}
                    onTypingStop={onTypingStop}
                />
            )}

            <PDFPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={pdfPreview.closePreview}
                pdfUrl={pdfPreview.previewConfig?.url || ''}
                filename={pdfPreview.previewConfig?.filename || ''}
                title={pdfPreview.previewConfig?.title || ''}
            />
        </div>
    );
};
