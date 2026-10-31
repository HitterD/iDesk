import { Node, mergeAttributes } from '@tiptap/core';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import StarterKit from '@tiptap/starter-kit';
import api from '@/lib/api';
import { notePath } from './types';

export function noteEditorExtensions(ticketId: string, noteId: string) {
    const Image = Node.create({
        name: 'image', group: 'block', atom: true,
        addAttributes: () => ({ attachmentId: { default: null } }),
        parseHTML: () => [],
        renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes), 'Gambar privat'],
        addNodeView() {
            return ({ node }) => {
                const image = document.createElement('img');
                image.alt = 'Gambar catatan internal'; image.className = 'max-w-full rounded-md my-3';
                let url = ''; let disposed = false;
                void api.get(`${notePath(ticketId, noteId)}/attachments/${node.attrs.attachmentId}`, { responseType: 'blob' })
                    .then(response => { if (!disposed) { url = URL.createObjectURL(response.data); image.src = url; } })
                    .catch(() => { image.alt = 'Gambar tidak dapat dimuat'; });
                return { dom: image, destroy: () => { disposed = true; if (url) URL.revokeObjectURL(url); } };
            };
        },
    });
    return [StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }), TaskList, TaskItem.configure({ nested: true }), Image];
}
