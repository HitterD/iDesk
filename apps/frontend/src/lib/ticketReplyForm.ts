/** The multipart body of POST /tickets/:id/reply, shared by the agent and requester pages. */
export function buildReplyForm({ content, files, isInternal, replyToId, mentionedUserIds }: {
    content: string;
    files?: FileList | File[] | null;
    isInternal?: boolean;
    /** The message this reply answers; its quote is already in `content`. */
    replyToId?: string | null;
    /** People picked with @ (the server keeps only those who may be mentioned). */
    mentionedUserIds?: string[];
}): FormData {
    const form = new FormData();
    form.append('content', content);
    form.append('isInternal', String(Boolean(isInternal)));
    if (replyToId) form.append('replyToId', replyToId);
    if (mentionedUserIds?.length) form.append('mentionedUserIds', JSON.stringify(mentionedUserIds));
    Array.from(files ?? []).forEach((file) => form.append('files', file));
    return form;
}
