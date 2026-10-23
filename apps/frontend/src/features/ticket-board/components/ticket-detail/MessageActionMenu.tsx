/**
 * MessageActionMenu: the ⋯ of the message tool pill (mockup ticket-chat.js `bindMore`).
 * Salin · Balas · Edit (own) · Hapus (own, destructive). Edit/Delete have no backend yet,
 * so without handlers they say so instead of pretending to succeed.
 */

import React from 'react';
import { Copy, Ellipsis, Pencil, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageActionMenuProps {
    messageId: string;
    messageContent: string;
    isOwn: boolean;
    isInternal: boolean;
    /** Stickers have no text to copy or edit. */
    isSticker?: boolean;
    onEdit?: (messageId: string, content: string) => void;
    onDelete?: (messageId: string) => void;
    onReply?: (content: string) => void;
    align?: 'start' | 'end';
}

const NOT_AVAILABLE = 'belum tersedia untuk pesan tiket';

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
    messageId,
    messageContent,
    isOwn,
    isSticker = false,
    onEdit,
    onDelete,
    onReply,
    align = 'start',
}) => {
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(messageContent);
            toast.success('Pesan disalin ke clipboard');
        } catch {
            toast.error('Gagal menyalin pesan');
        }
    };

    const handleEdit = () => {
        if (onEdit) onEdit(messageId, messageContent);
        else toast.info(`Edit pesan ${NOT_AVAILABLE}`);
    };

    const handleDelete = () => {
        if (onDelete) onDelete(messageId);
        else toast.info(`Hapus pesan ${NOT_AVAILABLE}`);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Aksi lainnya" title="Aksi lainnya">
                    <Ellipsis aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} variant="compact" aria-label="Aksi pesan">
                <DropdownMenuItem onSelect={handleCopy} disabled={isSticker}><Copy />Salin</DropdownMenuItem>
                {onReply && <DropdownMenuItem onSelect={() => onReply(messageContent)}><Reply />Balas</DropdownMenuItem>}
                {isOwn && !isSticker && <DropdownMenuItem onSelect={handleEdit}><Pencil />Edit</DropdownMenuItem>}
                {isOwn && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={handleDelete}><Trash2 />Hapus</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default MessageActionMenu;
