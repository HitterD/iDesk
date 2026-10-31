import type { JSONContent } from '@tiptap/react';

export interface NoteUser { id: string; fullName: string; avatarUrl?: string }
export interface TicketNote {
    id: string; ticketId: string; title: string; createdById: string;
    document: JSONContent; contentVersion: number; eventSequence: number;
    hasUnread: boolean; hasMention: boolean; ticketStatus?: string; lastReadSequence?: number;
    members?: NoteUser[]; selectedSolutionMessageId?: string | null; selectedById?: string | null; selectedAt?: string;
}
export interface NoteMessage {
    id: string; authorId: string; content: string; sequence: number; createdAt: string;
    mentionedUserIds: string[]; attachmentIds: string[];
}
export interface NoteSession { sessionId: string; leaseUntil: string; contentVersion: number; document: JSONContent }
export const notePath = (ticketId: string, noteId?: string) => `/tickets/${ticketId}/notes${noteId ? `/${noteId}` : ''}`;
