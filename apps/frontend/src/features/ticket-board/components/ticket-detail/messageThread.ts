/**
 * Pure helpers for the ticket conversation thread: reply quotes, sender names and
 * day separators. Replies are stored as plain text (`↩ Sender: snippet\n\nbody`)
 * with no link to the quoted message, so the original is found by sender + prefix.
 */

export const QUOTE_SNIPPET_MAX = 80;
const QUOTE_MARK = '↩';
const QUOTE_PATTERN = /^↩️?\s*([^:\r\n]+?):\s*(.*?)\r?\n(?:\r?\n)?([\s\S]*)$/;
const TIME_ZONE = 'Asia/Jakarta';
const ELLIPSIS = '…';
/** Content of a message that is only a photo, as written by the Telegram/WA bridges. */
export const PHOTO_ONLY_PATTERN = /^\[?(📷\s*)?\[?Photo\]?\]?$/i;
/** Quote text used when the replied-to message has attachments but no text. */
export const ATTACHMENT_QUOTE = '[Lampiran]';
/** What a reply shows when the message it quotes was deleted (same text the server writes). */
export const DELETED_QUOTE = 'Pesan telah dihapus';
/** Consecutive messages from one sender within this window share a bubble group. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface ParsedQuote {
    sender: string;
    quote: string;
    body: string;
}

interface ThreadMessage {
    id: string;
    content?: string | null;
    createdAt: string;
    sender?: { fullName?: string | null } | null;
}

export function parseQuote(content: string | null | undefined): ParsedQuote | null {
    if (!content || !content.startsWith(QUOTE_MARK)) return null;
    const match = content.match(QUOTE_PATTERN);
    if (!match) return null;
    const [, sender, quote, body] = match;
    return { sender: sender.trim(), quote: quote.trim(), body };
}

/** Text shown when a message is quoted: a reply quotes only its own body. */
export function quotableText(content: string | null | undefined): string {
    const parsed = parseQuote(content);
    return (parsed ? parsed.body : content ?? '').trim();
}

export function buildQuotedContent(senderName: string, quotedContent: string, body: string): string {
    const flat = quotableText(quotedContent).replace(/\s+/g, ' ');
    const snippet = flat.length > QUOTE_SNIPPET_MAX ? `${flat.slice(0, QUOTE_SNIPPET_MAX)}${ELLIPSIS}` : flat;
    return `${QUOTE_MARK} ${senderName}: ${snippet}\n\n${body}`;
}

export type QuoteKind = 'text' | 'photo' | 'file';

export function quoteKind(quote: string): QuoteKind {
    if (PHOTO_ONLY_PATTERN.test(quote)) return 'photo';
    if (!quote || quote === ATTACHMENT_QUOTE) return 'file';
    return 'text';
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/** Latest message before `replyId` whose sender and text match the quote, or null. */
export function findQuotedMessageId(
    messages: ThreadMessage[],
    replyId: string,
    quote: ParsedQuote,
): string | null {
    const sender = normalize(quote.sender);
    const prefix = normalize(quote.quote.endsWith(ELLIPSIS) ? quote.quote.slice(0, -1) : quote.quote);
    if (!prefix) return null;

    const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const replyIndex = sorted.findIndex(m => m.id === replyId);
    const candidates = replyIndex === -1 ? sorted : sorted.slice(0, replyIndex);

    for (let i = candidates.length - 1; i >= 0; i--) {
        const candidate = candidates[i];
        if (normalize(candidate.sender?.fullName ?? '') !== sender) continue;
        if (normalize(quotableText(candidate.content)).startsWith(prefix)) return candidate.id;
    }
    return null;
}

/** Title-cases names stored in all caps ("MOH. ARIS" → "Moh. Aris"); mixed case is left alone. */
export function toDisplayName(name: string | null | undefined): string {
    if (!name) return '';
    if (name !== name.toUpperCase()) return name;
    return name.toLowerCase().replace(/(^|[\s.\-'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Whether `next` continues the bubble group started by `prev` (same sender, visibility, day, within the window). */
export function continuesGroup(
    prev: { senderId?: string | null; isInternal?: boolean; createdAt: string } | null,
    next: { senderId?: string | null; isInternal?: boolean; createdAt: string },
): boolean {
    if (!prev || !prev.senderId || prev.senderId !== next.senderId) return false;
    if (Boolean(prev.isInternal) !== Boolean(next.isInternal)) return false;
    if (!isSameDay(prev.createdAt, next.createdAt)) return false;
    return new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime() <= GROUP_WINDOW_MS;
}

const dayKey = (date: string | Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(date));

export function isSameDay(a: string | Date, b: string | Date): boolean {
    return dayKey(a) === dayKey(b);
}

export function dateSeparatorLabel(date: string | Date, now: Date = new Date()): string {
    if (isSameDay(date, now)) return 'Hari ini';
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (isSameDay(date, yesterday)) return 'Kemarin';
    return new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(date));
}

export function formatMessageTime(date: string | Date): string {
    return new Intl.DateTimeFormat('id-ID', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
        .format(new Date(date));
}

export type ReadTick = 'pending' | 'sent' | 'read';

/** The page shows a message right away with a `temp-` id until the server has it. */
export const isPendingMessage = (id: string) => id.startsWith('temp-');

/** One tick until the other side's read marker reaches the message, then two (WhatsApp-style). */
export function readTick(createdAt: string, counterpartLastReadAt: string | null | undefined): ReadTick {
    if (!counterpartLastReadAt) return 'sent';
    return new Date(counterpartLastReadAt).getTime() >= new Date(createdAt).getTime() ? 'read' : 'sent';
}

/** How long after sending the sender may still edit a message (mirrors the server rule). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export interface EditableMessage {
    createdAt: string;
    isSystemMessage: boolean;
    isInternal?: boolean;
    isDeleted?: boolean;
    source?: string;
    sender?: { id?: string } | null;
}

/** Live public chat messages only: system, e-mail, archived internal and deleted messages are locked. */
const isChangeable = (m: EditableMessage, ticketClosed: boolean) =>
    !ticketClosed && !m.isSystemMessage && m.source !== 'EMAIL' && !m.isInternal && !m.isDeleted;

export function canEditMessage(m: EditableMessage, viewerId: string | undefined, ticketClosed: boolean, now: number = Date.now()): boolean {
    if (!viewerId || m.sender?.id !== viewerId || !isChangeable(m, ticketClosed)) return false;
    return now - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
}

export function canDeleteMessage(
    m: EditableMessage,
    viewer: { id?: string; role?: string } | null | undefined,
    ticketClosed: boolean,
): boolean {
    if (!viewer?.id || !isChangeable(m, ticketClosed)) return false;
    return m.sender?.id === viewer.id || viewer.role === 'ADMIN';
}

/** Any participant may pin a live public chat message (system, internal and deleted ones are not pinnable). */
export function canPinMessage(m: EditableMessage, ticketClosed: boolean): boolean {
    return !ticketClosed && !m.isSystemMessage && !m.isInternal && !m.isDeleted;
}
