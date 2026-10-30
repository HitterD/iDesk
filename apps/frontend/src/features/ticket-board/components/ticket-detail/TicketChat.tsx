import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Wifi, Lock, FileText, Pin, ChevronDown, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { CLOSED_TICKET_NOTICE } from './constants';
import { MessageAttachments } from './MessageAttachments';
import { SystemMessageEvent } from './SystemMessageEvent';
import { legacyActivityEvent } from './legacyActivity';
import { MessageBubble } from './MessageBubble';
import { ActivityEvent, linkedTicketMove } from './ActivityEvent';
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
import { ProposeHardwareDialog, TicketHardwareMessage, canProposeHardware } from '../ticket-hardware';
import { ProposeEFormDialog, TicketEFormMessage, canProposeEForm } from '../ticket-eform';

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
/** The opening report message is written in the same transaction as the ticket, so within seconds of it. */
const GENESIS_WINDOW_MS = 60_000;

const isResolutionStatement = (content?: string) =>
    Boolean(content?.includes('Tiket Dinyatakan Selesai') || content?.includes('Tiket Diselesaikan (Resolved)'));

const DateSeparator: React.FC<{ date: string }> = ({ date }) => (
    <div className="chat-day">{dateSeparatorLabel(date)}</div>
);

/**
 * Announcement for the newest incoming bubble. Messages present on mount and the viewer's own
 * sends are not announced; a keyed node per message lets repeat senders be read again.
 */
const useNewMessageAnnouncement = (latest: ChatMessage | undefined, isOwn: (m: ChatMessage) => boolean) => {
    const lastSeenId = useRef(latest?.id);
    const [announcement, setAnnouncement] = useState<{ id: string; text: string } | null>(null);
    useEffect(() => {
        if (!latest || latest.id === lastSeenId.current) return;
        lastSeenId.current = latest.id;
        if (isOwn(latest)) return;
        setAnnouncement({ id: latest.id, text: `Pesan baru dari ${toDisplayName(latest.sender?.fullName) || 'IT Support'}` });
    }, [latest, isOwn]);
    return announcement;
};

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
    const [proposingHardware, setProposingHardware] = useState(false);
    const [proposingEForm, setProposingEForm] = useState(false);
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

    // Messages present when the ticket opens render settled; only later arrivals get the entrance
    // animation (the page is keyed per path, so this resets when another ticket opens).
    const [initialMessageIds] = useState(() => new Set((ticket.messages ?? []).map((m) => m.id)));

    const sortedMessages = useMemo(
        () => [...(ticket.messages ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        [ticket.messages],
    );

    // The opening report is already shown in the "Laporan awal" card, so its message is hidden.
    // It is the first message, repeats the description, and was saved with the ticket. Older
    // tickets filed by an agent on someone's behalf saved it with the agent as sender, so the
    // sender is not part of the test; the creation-time check keeps a later reply that repeats
    // the description visible.
    const genesisMessageId = useMemo(() => {
        if (sortedMessages.length === 0 || !ticket.description) return null;
        const first = sortedMessages[0];
        const savedWithTicket = Math.abs(new Date(first.createdAt).getTime() - new Date(ticket.createdAt).getTime()) <= GENESIS_WINDOW_MS;
        return first.content?.trim() === ticket.description.trim() && savedWithTicket ? first.id : null;
    }, [sortedMessages, ticket.description, ticket.createdAt]);

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
    /** Staff handling the ticket: staff messages sit right (mockup). Requester views: own messages sit right. */
    const isAgentView = isStaff && ticket.viewerAccess !== 'requester';
    const rootIsOutgoing = !isAgentView && isOwnTicket;
    const isOwn = useCallback((message: ChatMessage) => Boolean(
        (message.sender?.id && user?.id && message.sender.id === user.id) ||
        (user?.fullName && message.sender?.fullName === user.fullName)
    ), [user?.id, user?.fullName]);

    const isStaffSender = (message: ChatMessage) => {
        const role = message.sender?.role;
        if (role) return role !== 'USER';
        return isOwn(message) && isStaff;
    };
    const isOutgoing = (message: ChatMessage) => (isAgentView ? isStaffSender(message) : isOwn(message));
    const roleLabel = (message: ChatMessage) => {
        if (isOwn(message)) return undefined;
        if (isAgentView) return message.sender?.id && message.sender.id === ticket.user?.id ? 'Pemohon' : undefined;
        return isStaffSender(message) ? 'IT Support' : undefined;
    };

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
    const latestBubble = [...visibleMessages].reverse().find(isBubble);
    const announcement = useNewMessageAnnouncement(latestBubble, isOwn);

    return (
        <div className="relative flex h-full flex-col overflow-hidden">

            {/* ── Pinned issue bar: one compact row on mobile (title + jump + status dot + details toggle) ── */}
            <div data-pinned-bar className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--idesk-border)/0.7)] px-3 py-1.5 sm:gap-3 sm:px-5 sm:py-2">
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
                        <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
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
                        {/* Mobile: a small status dot; sm+: icon + label. */}
                        <span className={cn('h-2 w-2 rounded-full sm:hidden', isConnected ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden="true" />
                        <Wifi className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">{isConnected ? 'Live' : 'Offline'}</span>
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
                <div data-pinned-drawer className="custom-scrollbar z-10 max-h-[40vh] shrink-0 space-y-3 overflow-y-auto border-b border-slate-200/70 bg-white p-3 shadow-sm animate-in slide-in-from-top-2 duration-200 dark:border-slate-800 dark:bg-slate-900 sm:max-h-60 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
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
            <div ref={streamRef} className="chat-stream custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-[18px]">

                {/* Root issue (genesis report), drawn as the requester's first bubble */}
                <div ref={rootIssueRef} data-root-issue className={cn('chat-msg', rootIsOutgoing && 'is-out')}>
                    <div className="chat-msg-av">
                        <UserAvatar user={ticket.user} size="xs" className="h-7 w-7 rounded-full text-[10.5px]" />
                    </div>
                    <div className="chat-msg-col">
                        <div className="chat-who">
                            {(() => {
                                const parts = [
                                    <b key="n">{isOwnTicket && !isAgentView ? 'Anda' : toDisplayName(ticket.user.fullName)}</b>,
                                    isAgentView && <span key="r" className="chat-role">Pemohon</span>,
                                    <time key="t" dateTime={ticket.createdAt} title={formatDateTimeID(ticket.createdAt)}>{formatDateTimeID(ticket.createdAt)}</time>,
                                    <span key="l" className="inline-flex items-center gap-1"><FileText className="h-3 w-3" aria-hidden="true" />Laporan awal</span>,
                                    // Filed on the requester's behalf: the report is theirs, the filer is named here.
                                    ticket.createdBy && ticket.createdBy.id !== ticket.user.id && <span key="f">Dibuat oleh {toDisplayName(ticket.createdBy.fullName)}</span>,
                                ].filter(Boolean);
                                return rootIsOutgoing ? parts.reverse() : parts;
                            })()}
                        </div>
                        <div className={cn('chat-bubble', rootIsOutgoing ? 'chat-bubble-out' : 'chat-bubble-in')}>
                            <p><b>{ticket.title}</b></p>
                            <p className="whitespace-pre-wrap">
                                {ticket.description || <span className="italic opacity-70">Tidak ada deskripsi tambahan.</span>}
                            </p>
                            {initialAttachments.length > 0 && (
                                <div className="mt-2">
                                    <MessageAttachments
                                        attachments={initialAttachments}
                                        attachmentInfo={initialMessage?.attachmentInfo}
                                        onImageClick={onImageClick}
                                        onPdfClick={(url, filename) => pdfPreview.openPreview(url, filename, 'PDF Attachment')}
                                        isRequester={!rootIsOutgoing}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chat messages */}
                <div>
                    {visibleMessages.map((message, index) => {
                        const prev = visibleMessages[index - 1];
                        const next = visibleMessages[index + 1];
                        const newDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
                        const separator = newDay ? <DateSeparator date={message.createdAt} /> : null;

                        const eformEvent = message.systemEvent?.eformRequest;
                        if (eformEvent) {
                            return (
                                <React.Fragment key={message.id}>
                                    {separator}
                                    <div className="chat-system-event" data-system-event={message.id}>
                                        <TicketEFormMessage ticketId={ticket.id} event={eformEvent} createdAt={message.createdAt}
                                            actorName={message.systemEvent?.actor?.name} reason={message.systemEvent?.reason}
                                            ticketMove={linkedTicketMove(message.systemEvent)}
                                            isRequester={Boolean(user?.id && user.id === ticket.user?.id)} />
                                    </div>
                                </React.Fragment>
                            );
                        }

                        const hardwareEvent = message.systemEvent?.hardwareRequest;
                        if (hardwareEvent) {
                            return (
                                <React.Fragment key={message.id}>
                                    {separator}
                                    <div className="chat-system-event" data-system-event={message.id}>
                                        <TicketHardwareMessage ticketId={ticket.id} event={hardwareEvent} createdAt={message.createdAt}
                                            actorName={message.systemEvent?.actor?.name} reason={message.systemEvent?.reason}
                                            ticketMove={linkedTicketMove(message.systemEvent)}
                                            isRequester={Boolean(user?.id && user.id === ticket.user?.id)} />
                                    </div>
                                </React.Fragment>
                            );
                        }

                        if (!isBubble(message)) {
                            // Messages from before structured events are rebuilt from their text, so history looks alike.
                            const activity = message.systemEvent?.changes?.length ? message.systemEvent : legacyActivityEvent(message.content);
                            return (
                                <React.Fragment key={message.id}>
                                    {separator}
                                    <div className="chat-system-event" data-system-event={message.id}>
                                        {activity ? (
                                            <ActivityEvent event={activity} createdAt={message.createdAt}
                                                audience={isAgentView ? 'staff' : 'requester'} />
                                        ) : <SystemMessageEvent
                                            audience={isAgentView ? 'staff' : 'requester'}
                                            content={message.content}
                                            createdAt={message.createdAt}
                                            attachments={message.attachments}
                                            onImageClick={onImageClick}
                                        />}
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
                                    isOutgoing={isOutgoing(message)}
                                    roleLabel={roleLabel(message)}
                                    ownLabel={isAgentView ? undefined : 'Anda'}
                                    isSticker={STICKERS.includes(message.content?.trim() || '')}
                                    isGroupStart={isGroupStart || newDay}
                                    isGroupEnd={isGroupEnd}
                                    isHighlighted={highlightedId === message.id}
                                    isArriving={!initialMessageIds.has(message.id)}
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
                        <div className="chat-bubble chat-bubble-in mt-3 ml-10 flex w-fit items-center gap-2 rounded-[20px] px-3.5 py-2 text-xs">
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

            {/* Screen readers hear only "Pesan baru dari X"; bubbles, tool pills and the typing indicator stay silent. */}
            <div className="sr-only" role="status" data-testid="chat-announcer">
                {announcement && <p key={announcement.id}>{announcement.text}</p>}
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
                    showCannedResponses={showCannedResponses !== false && isAgentView}
                    ticketVariables={ticketVariables}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    onSend={(content, files, isInternal, onProgress) => onSendMessage(content, files, isInternal, onProgress)}
                    onSendSticker={handleSendSticker}
                    onTypingStart={onTypingStart}
                    onTypingStop={onTypingStop}
                    onProposeHardware={canProposeHardware(ticket, isAgentView) ? () => setProposingHardware(true) : undefined}
                    onProposeEForm={canProposeEForm(ticket, isAgentView, user?.role) ? () => setProposingEForm(true) : undefined}
                />
            )}

            {canProposeHardware(ticket, isAgentView) && (
                <ProposeHardwareDialog open={proposingHardware} onOpenChange={setProposingHardware} ticketId={ticket.id}
                    ticketNumber={ticket.ticketNumber} requesterName={toDisplayName(ticket.user?.fullName)} defaultReason={ticket.title} />
            )}
            {canProposeEForm(ticket, isAgentView, user?.role) && (
                <ProposeEFormDialog open={proposingEForm} onOpenChange={setProposingEForm} ticketId={ticket.id}
                    ticketNumber={ticket.ticketNumber} requesterName={toDisplayName(ticket.user?.fullName)} defaultReason={ticket.title} />
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
