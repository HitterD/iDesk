import type { AttachmentInfo } from '../entities/ticket-message.entity';

/** The fields a chat message needs to be shown (entity rows and socket payloads both fit). */
export interface PresentableMessage {
    content: string;
    senderId?: string | null;
    attachments?: string[] | null;
    attachmentInfo?: AttachmentInfo[] | null;
    deletedAt?: Date | string | null;
    deletedById?: string | null;
}

export type PresentedMessage<T extends PresentableMessage> = Omit<T, 'deletedById'> & {
    isDeleted: boolean;
    deletedByAdmin: boolean;
};

/**
 * The one shape a ticket message leaves the server in. A deleted message keeps its place in the
 * thread but never its text or files: those are blanked here, not hidden by the client.
 */
export function presentMessage<T extends PresentableMessage>(message: T): PresentedMessage<T> {
    const { deletedById, ...rest } = message;
    if (!message.deletedAt) return { ...rest, isDeleted: false, deletedByAdmin: false };
    return {
        ...rest,
        content: '',
        attachments: [],
        attachmentInfo: null,
        isDeleted: true,
        deletedByAdmin: Boolean(deletedById && deletedById !== message.senderId),
    };
}

/** What a reply shows of the message it answers. */
export interface ReplySummary {
    id: string;
    senderName: string;
    snippet: string;
    isDeleted: boolean;
}

export interface ThreadMessage extends PresentableMessage {
    id: string;
    sender?: { fullName?: string | null } | null;
    replyToId?: string | null;
    pinnedAt?: Date | string | null;
    pinnedById?: string | null;
    pinnedBy?: { fullName?: string | null } | null;
}

export type PresentedThreadMessage<T extends ThreadMessage> = Omit<PresentedMessage<T>, 'pinnedById' | 'pinnedBy'> & {
    replyTo: ReplySummary | null;
    isPinned: boolean;
    pinnedAt: Date | string | null;
    pinnedByName: string | null;
};

const QUOTE_MARK = '↩';
/** Same shape the chat writes: `↩ Sender: snippet` then a blank line, then the reply body. */
const QUOTE_PATTERN = /^↩️?\s*([^:\r\n]+?):\s*(.*?)\r?\n(?:\r?\n)?([\s\S]*)$/;
export const DELETED_QUOTE = 'Pesan telah dihapus';
const SNIPPET_MAX = 80;

const snippetOf = (content: string): string => {
    const body = content.match(QUOTE_PATTERN)?.[3] ?? content;
    const text = body.trim().replace(/\s+/g, ' ');
    return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX - 1)}…` : text;
};

/** A reply keeps its own words; only the quoted line of a deleted original is replaced. */
export const withDeletedQuote = (content: string, senderName: string): string => {
    const match = content.match(QUOTE_PATTERN);
    if (!content.startsWith(QUOTE_MARK) || !match) return content;
    return `${QUOTE_MARK} ${match[1] || senderName}: ${DELETED_QUOTE}\n\n${match[3]}`;
};

export function summarizeReply(original: ThreadMessage): ReplySummary {
    const isDeleted = Boolean(original.deletedAt);
    return {
        id: original.id,
        senderName: original.sender?.fullName ?? '',
        snippet: isDeleted ? '' : snippetOf(original.content),
        isDeleted,
    };
}

/**
 * A message as part of its ticket's thread: blanked when deleted, linked to the message it replies
 * to, and with its pin state. `original` is the replied-to message when the caller has it.
 */
export function presentInThread<T extends ThreadMessage>(message: T, original?: ThreadMessage | null): PresentedThreadMessage<T> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pinnedById, pinnedBy, ...rest } = presentMessage(message) as PresentedMessage<T> & Pick<ThreadMessage, 'pinnedById' | 'pinnedBy'>;
    const replyTo = original ? summarizeReply(original) : null;
    const content = replyTo?.isDeleted && !message.deletedAt ? withDeletedQuote(rest.content, replyTo.senderName) : rest.content;
    return {
        ...rest,
        content,
        replyTo,
        isPinned: Boolean(message.pinnedAt) && !message.deletedAt,
        pinnedAt: message.pinnedAt ?? null,
        pinnedByName: message.pinnedAt ? (pinnedBy?.fullName ?? null) : null,
    } as PresentedThreadMessage<T>;
}

/** Every message of one ticket, replies resolved against the same list. */
export function presentThread<T extends ThreadMessage>(messages: T[]): PresentedThreadMessage<T>[] {
    const byId = new Map(messages.map((m) => [m.id, m]));
    return messages.map((m) => presentInThread(m, m.replyToId ? byId.get(m.replyToId) : null));
}
