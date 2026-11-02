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
