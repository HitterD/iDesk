/** The multipart body of POST /tickets/:id/reply, shared by the agent and requester pages. */
export function buildReplyForm({ content, files, isInternal, replyToId }: {
    content: string;
    files?: FileList | File[] | null;
    isInternal?: boolean;
    /** The message this reply answers; its quote is already in `content`. */
    replyToId?: string | null;
}): FormData {
    const form = new FormData();
    form.append('content', content);
    form.append('isInternal', String(Boolean(isInternal)));
    if (replyToId) form.append('replyToId', replyToId);
    Array.from(files ?? []).forEach((file) => form.append('files', file));
    return form;
}
